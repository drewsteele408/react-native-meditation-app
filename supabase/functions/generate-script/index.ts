// supabase/functions/generate-script/index.ts
//
// POST { prompt: string, durationMinutes?: number }
// -> { sessionId: string, script: string }
//
// Security checks run in this exact order (spec §8.2 / build-plan.md Phase 4):
//   SEC-01  Verify Supabase JWT                          -> 401
//   SEC-02  Enforce max prompt length (1,000 chars)       -> 400
//   SEC-03  Atomic per-user hourly rate limit             -> 429
//   SEC-04  Call Gemini, persist script                   -> 502 on upstream failure
//
// See meditation-app-spec.md §8.1-8.3 and §10 for the full request flow and
// sessions table schema.

import { ApiError, GoogleGenAI } from 'npm:@google/genai';
import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient, verifyAuth } from '../_shared/auth.ts';

// SEC-02
const MAX_PROMPT_LENGTH = 1000;

// SEC-03 — max requests per rolling hourly window. check_and_increment_usage
// (supabase/migrations/20260708000000_initial_schema.sql) buckets by
// date_trunc('hour', now()), so this is effectively "N requests per
// wall-clock hour" per user. The spec does not pin an exact number ("e.g.,
// max N requests / hour" — spec §8.2 SEC-03); 10/hour is a deliberately
// conservative prototype default since each request burns paid Gemini +
// (on the follow-up call) ElevenLabs quota. Adjust this single constant if
// product wants a different cap — there is no separate config table.
const MAX_REQUESTS_PER_HOUR = 30;

// Model verified against https://ai.google.dev/gemini-api/docs/models and
// https://ai.google.dev/gemini-api/docs/pricing on 2026-09-16 (three
// independent fetches, consistent results): gemini-2.5-flash (the model
// named in the spec draft) still exists but is superseded;
// gemini-3.8-flash is the current stable, recommended flash-tier model.
// Re-verify against the docs before relying on this if it has been a while
// since this file was last touched — flash-tier naming has moved fast.
const GEMINI_MODEL = 'gemini-3.1-flash-lite';

// ElevenLabs (synthesize-audio/index.ts) bills per character of spoken
// text, but only bills <break> tags for their own literal characters, not
// for the silence they produce. Meditation scripts are naturally
// pause-heavy (breathing cues, silent holds between thoughts), so we ask
// Gemini to express that silence as <break> tags instead of padding it out
// with extra spoken prose — same felt pacing, fewer billed characters.
// Verified against https://elevenlabs.io/docs/models and
// https://elevenlabs.io/docs/help-center/product/core-capabilities/text-to-speech/how-can-i-add-pauses
// on 2026-09-18: a single <break time="Xs" /> tag is only reliable up to
// ~3s, and ElevenLabs' own guidance warns that stacking many consecutive
// break tags in one generation can destabilize output (speech speeding up,
// noise/artifacts) — so breaks must read as natural pauses between
// phrases/sentences, never as a bulk mechanism for minutes of dead air.
// eleven_flash_v2_5 (the model synthesize-audio now defaults to) supports
// break tags with no extra request-body flag needed. Re-verify this
// guidance against current ElevenLabs docs if it's been a while.
const SYSTEM_INSTRUCTION =
  'You are a professional meditation guide. The user will describe how they ' +
  'are feeling or what they want from their meditation session. Write a ' +
  'calming, first-person guided meditation script tailored to their ' +
  'request. Use only plain prose — no bullet points, headers, or markdown ' +
  'formatting. The tone should be warm, slow, and soothing. Begin the ' +
  'script immediately without any preamble. Keep the spoken wording itself ' +
  'natural and unpadded — do not add extra sentences just to fill time. ' +
  'Instead, insert SSML pause tags of the form <break time="Xs" /> (X ' +
  'between 1 and 3, never exceeding 3 seconds per tag) at natural pause ' +
  'points: after breathing instructions, between distinct thoughts or ' +
  'sentences, and at moments meant to be reflective silence. Use single, ' +
  'isolated break tags separated by spoken text — never place multiple ' +
  'break tags back-to-back — so the pacing sounds like natural breathing ' +
  'room rather than dead air.';

// Gemini occasionally returns 503 UNAVAILABLE ("high demand ... temporary")
// or 429 (its own upstream rate limit, distinct from our SEC-03 counter) —
// both are explicitly transient per Google's own error message, so a couple
// of short retries clears most of them instead of failing the whole request
// on a blip. Anything else (bad request, auth, etc.) fails immediately.
const RETRYABLE_STATUS_CODES = new Set([429, 503]);
const MAX_GEMINI_ATTEMPTS = 3;
const RETRY_DELAY_MS = [300, 900];

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

interface GenerateScriptRequestBody {
  prompt?: unknown;
  durationMinutes?: unknown;
}

interface SessionInsert {
  user_id: string;
  prompt: string;
  script: string;
  duration_seconds?: number;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  try {
    const supabaseAdmin = createAdminClient();

    // SEC-01 — must run before any other logic.
    const auth = await verifyAuth(req, supabaseAdmin);
    if (auth.errorResponse) return auth.errorResponse;
    const userId = auth.user.id;

    let body: GenerateScriptRequestBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Request body must be valid JSON');
    }

    const prompt = body.prompt;
    if (typeof prompt !== 'string' || prompt.trim().length === 0) {
      return errorResponse(400, 'Missing required field: prompt');
    }

    // SEC-02
    if (prompt.length > MAX_PROMPT_LENGTH) {
      return errorResponse(400, `Prompt exceeds maximum length of ${MAX_PROMPT_LENGTH} characters`);
    }

    // durationMinutes is optional and client-supplied (src/repositories/
    // geminiRepository.ts always sends it); validate loosely and store it
    // as duration_seconds on the session row when present and sane.
    //
    // Cap at 20 minutes: the product spec (meditation-app-spec.md line 79)
    // only ever intends 5/10/15-minute presets plus a custom value, so 20 is
    // the longest preset (15) plus a 5-minute buffer for custom input — not
    // an arbitrary ceiling. A longer duration is both a cost outlier (a much
    // larger Gemini script billed further at ~1 ElevenLabs credit/char even
    // after the flash_v2_5 discount) and a correctness risk: the spec notes
    // (meditation-app-spec.md line 180) that a long sequential Gemini +
    // ElevenLabs call risks hitting Supabase's 150-second Edge Function
    // timeout.
    let durationSeconds: number | undefined;
    if (body.durationMinutes !== undefined) {
      const durationMinutes = body.durationMinutes;
      if (
        typeof durationMinutes !== 'number' ||
        !Number.isFinite(durationMinutes) ||
        durationMinutes <= 0 ||
        durationMinutes > 20
      ) {
        return errorResponse(400, 'Invalid durationMinutes');
      }
      durationSeconds = Math.round(durationMinutes * 60);
    }

    // SEC-03 — atomic check-and-increment via RPC (service-role only; see
    // migration). Never read-then-write the usage_counters table directly
    // from this function — that would reintroduce the race condition the
    // RPC exists to prevent.
    const { data: withinLimit, error: rpcError } = await supabaseAdmin.rpc(
      'check_and_increment_usage',
      { p_user_id: userId, p_max_requests: MAX_REQUESTS_PER_HOUR },
    );
    if (rpcError) {
      console.error('check_and_increment_usage RPC failed:', rpcError.message);
      return errorResponse(500, 'Unable to process request');
    }
    if (withinLimit === false) {
      return errorResponse(429, 'Rate limit exceeded. Please try again later.');
    }

    // SEC-04
    const geminiApiKey = Deno.env.get('GEMINI_API_KEY');
    if (!geminiApiKey) {
      console.error('GEMINI_API_KEY is not configured');
      return errorResponse(500, 'Unable to process request');
    }

    const ai = new GoogleGenAI({ apiKey: geminiApiKey });
    let script: string | undefined;
    let lastError: unknown;

    for (let attempt = 1; attempt <= MAX_GEMINI_ATTEMPTS; attempt++) {
      try {
        const response = await ai.models.generateContent({
          model: GEMINI_MODEL,
          contents: prompt,
          config: {
            systemInstruction: SYSTEM_INSTRUCTION,
            // gemini-3.8-flash has "thinking" on by default (medium level) and
            // it draws from the same output token budget as the final text —
            // on some prompts it exhausts the budget reasoning and leaves an
            // empty response.text (intermittent 502s in testing). A meditation
            // script needs no chain-of-thought, so disable it outright.
            // thinkingBudget: 0 = disabled (per @google/genai's ThinkingConfig
            // type comment; confirmed against the installed SDK's .d.ts).
            thinkingConfig: { thinkingBudget: 0 },
          },
        });

        // response.text is a property on the current @google/genai SDK, not
        // a method — do not call it as response.text().
        const text = response.text;
        if (!text || typeof text !== 'string' || text.trim().length === 0) {
          console.error(`Gemini returned an empty response (attempt ${attempt})`);
          lastError = new Error('Empty response');
          continue;
        }
        script = text;
        break;
      } catch (err) {
        lastError = err;
        const status = err instanceof ApiError ? err.status : undefined;
        console.error(
          `Gemini API call failed (attempt ${attempt}/${MAX_GEMINI_ATTEMPTS}, status ${status}):`,
          err instanceof Error ? err.message : err,
        );
        if (status === undefined || !RETRYABLE_STATUS_CODES.has(status)) break;
      }

      if (attempt < MAX_GEMINI_ATTEMPTS) {
        await sleep(RETRY_DELAY_MS[attempt - 1]);
      }
    }

    if (script === undefined) {
      console.error('Gemini generation failed after all attempts:', lastError);
      return errorResponse(502, 'Meditation script generation failed');
    }

    // Save to sessions (service-role client; RLS would also allow this
    // insert for the authenticated user directly, but we're already on the
    // admin client for the RPC call above).
    const sessionInsert: SessionInsert = { user_id: userId, prompt, script };
    if (durationSeconds !== undefined) {
      sessionInsert.duration_seconds = durationSeconds;
    }

    const { data: session, error: insertError } = await supabaseAdmin
      .from('sessions')
      .insert(sessionInsert)
      .select('id')
      .single();

    if (insertError || !session) {
      console.error('Failed to save session:', insertError?.message);
      return errorResponse(500, 'Unable to process request');
    }

    return jsonResponse({ sessionId: session.id as string, script });
  } catch (err) {
    console.error('Unhandled error in generate-script:', err instanceof Error ? err.message : err);
    return errorResponse(500, 'Internal server error');
  }
});
