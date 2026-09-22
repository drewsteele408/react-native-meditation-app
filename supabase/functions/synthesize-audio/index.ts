// supabase/functions/synthesize-audio/index.ts
//
// POST { sessionId: string, voiceId?: string }
// -> { audioUrl: string }   (a 1-hour signed Supabase Storage URL)
//
// Security checks run in this exact order (spec §8.2 / §8.1 / build-plan.md
// Phase 4):
//   SEC-01  Verify Supabase JWT                                -> 401
//   SEC-05  Fetch session by sessionId, verify ownership        -> 403 on
//           mismatch, 400 if the session doesn't exist
//           Resolve voiceId (if any) against public.voices      -> 400 if
//           unknown/inactive — never trust a client-supplied ElevenLabs id
//           Call ElevenLabs, upload to Storage                  -> 502 on
//           upstream failure
//
// Never accept raw script text from the client here — only a sessionId.
// This is what prevents a caller from synthesizing arbitrary text (and
// burning another user's rate-limited quota) or reading someone else's
// generated script by guessing an id.
//
// voiceId (optional, request body) is OUR internal public.voices.id uuid —
// never a raw ElevenLabs voice id. The client must never be able to hand us
// a raw ElevenLabs voice id directly: that would let anyone point our
// ElevenLabs API key at arbitrary (and potentially expensive) voices on our
// account. We always resolve it through public.voices server-side and
// require is_active = true. If voiceId is omitted, we fall back to the
// ELEVENLABS_VOICE_ID env var for backwards compatibility during rollout
// (pre-existing clients that don't send voiceId yet).

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient, verifyAuth } from '../_shared/auth.ts';

const STORAGE_BUCKET = 'meditation-audio';
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour, per spec §8.1 / §8.2

// Not pinned by the spec (§8.4 only specifies voice characteristics, not an
// ElevenLabs model id). Verified against https://elevenlabs.io/docs/models
// on 2026-09-18: eleven_flash_v2_5 is ElevenLabs' current recommended
// lower-cost model, billing ~50% less per character than the standard
// models (incl. eleven_multilingual_v2) for API generations — a real cost
// concern here since generation is billed per character of session.script.
// It also supports the same <break time="Xs" /> SSML pause tags used in
// SYSTEM_INSTRUCTION (generate-script/index.ts) — confirmed multilingual_v2,
// flash_v2, and flash_v2.5 all support break tags (eleven_v3 does not), and
// no request-body flag beyond `text` + `model_id` is needed to enable SSML
// parsing. Re-verify against the docs before relying on this if it's been a
// while — ElevenLabs' model lineup and pricing move fast. Overridable via
// env without a code change if that changes.
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_flash_v2_5';

interface SynthesizeAudioRequestBody {
  sessionId?: unknown;
  voiceId?: unknown;
}

interface SessionRow {
  id: string;
  user_id: string;
  script: string;
}

interface VoiceRow {
  id: string;
  elevenlabs_voice_id: string;
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

    let body: SynthesizeAudioRequestBody;
    try {
      body = await req.json();
    } catch {
      return errorResponse(400, 'Request body must be valid JSON');
    }

    const sessionId = body.sessionId;
    if (typeof sessionId !== 'string' || sessionId.trim().length === 0) {
      return errorResponse(400, 'Missing required field: sessionId');
    }

    // voiceId is optional — omitting it means "use the default voice"
    // (see the env-var fallback below). When present it must be a non-empty
    // string; the actual existence/active/ownership-of-ElevenLabs-id check
    // happens after SEC-05, via a lookup against public.voices — never
    // trust this value as an ElevenLabs voice id directly.
    const rawVoiceId = body.voiceId;
    if (rawVoiceId !== undefined && (typeof rawVoiceId !== 'string' || rawVoiceId.trim().length === 0)) {
      return errorResponse(400, 'Invalid field: voiceId');
    }
    const requestedVoiceId = rawVoiceId as string | undefined;

    // SEC-05 — fetch the session and verify ownership. Only session.script
    // (never client-supplied text) is ever passed to ElevenLabs.
    const { data: session, error: fetchError } = await supabaseAdmin
      .from('sessions')
      .select('id, user_id, script')
      .eq('id', sessionId)
      .maybeSingle<SessionRow>();

    if (fetchError) {
      console.error('Failed to fetch session:', fetchError.message);
      return errorResponse(500, 'Unable to process request');
    }
    if (!session) {
      return errorResponse(400, 'Invalid sessionId');
    }
    if (session.user_id !== userId) {
      // Session hijacking attempt — do not reveal whether the id exists
      // for another user vs. not at all; 403 is what the spec/build-plan
      // mandate for this specific case (distinct from the general
      // "not found" 400 above).
      return errorResponse(403, 'You do not have access to this session');
    }

    const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
    if (!elevenLabsApiKey) {
      console.error('ELEVENLABS_API_KEY is not configured');
      return errorResponse(500, 'Unable to process request');
    }

    // Resolve the ElevenLabs voice id to use. `resolvedVoiceRowId` (the
    // public.voices.id, distinct from the ElevenLabs id) is only set when
    // we resolved via the table lookup path, so the sessions.voice_id
    // update below knows whether there's a voices row to record.
    let elevenLabsVoiceId: string;
    let resolvedVoiceRowId: string | null = null;

    if (requestedVoiceId !== undefined) {
      // Client asked for a specific voice — look it up server-side rather
      // than trusting any ElevenLabs id from the request. Require
      // is_active = true so retired/hidden voices can't still be selected.
      const { data: voiceRow, error: voiceFetchError } = await supabaseAdmin
        .from('voices')
        .select('id, elevenlabs_voice_id')
        .eq('id', requestedVoiceId)
        .eq('is_active', true)
        .maybeSingle<VoiceRow>();

      if (voiceFetchError) {
        console.error('Failed to fetch voice:', voiceFetchError.message);
        return errorResponse(500, 'Unable to process request');
      }
      if (!voiceRow) {
        // Do not silently fall back to the default voice — an unknown or
        // inactive voiceId is a client error and should surface as one,
        // not be masked by quietly substituting a different voice.
        return errorResponse(400, 'Invalid voiceId');
      }

      elevenLabsVoiceId = voiceRow.elevenlabs_voice_id;
      resolvedVoiceRowId = voiceRow.id;
    } else {
      // Backwards-compat fallback for rollout before clients send voiceId.
      const envVoiceId = Deno.env.get('ELEVENLABS_VOICE_ID');
      if (!envVoiceId) {
        console.error('ELEVENLABS_VOICE_ID is not configured and no voiceId was provided');
        return errorResponse(500, 'Unable to process request');
      }
      elevenLabsVoiceId = envVoiceId;
    }

    const modelId = Deno.env.get('ELEVENLABS_MODEL_ID') || DEFAULT_ELEVENLABS_MODEL_ID;

    let audioBytes: Uint8Array;
    try {
      const elevenLabsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${elevenLabsVoiceId}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({
            text: session.script,
            model_id: modelId,
          }),
        },
      );

      if (!elevenLabsRes.ok) {
        console.error(`ElevenLabs API returned ${elevenLabsRes.status}: ${await elevenLabsRes.text()}`);
        return errorResponse(502, 'Audio synthesis failed');
      }

      audioBytes = new Uint8Array(await elevenLabsRes.arrayBuffer());
    } catch (err) {
      console.error('ElevenLabs API call failed:', err instanceof Error ? err.message : err);
      return errorResponse(502, 'Audio synthesis failed');
    }

    const storagePath = `${userId}/${sessionId}.mp3`;

    // upsert: true — a retried synthesis for the same session (e.g. after a
    // prior signed-url step failed) should overwrite, not error.
    const { error: uploadError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .upload(storagePath, audioBytes, { contentType: 'audio/mpeg', upsert: true });

    if (uploadError) {
      console.error('Failed to upload audio:', uploadError.message);
      return errorResponse(502, 'Audio synthesis failed');
    }

    const { data: signedUrlData, error: signedUrlError } = await supabaseAdmin.storage
      .from(STORAGE_BUCKET)
      .createSignedUrl(storagePath, SIGNED_URL_EXPIRY_SECONDS);

    if (signedUrlError || !signedUrlData) {
      console.error('Failed to create signed URL:', signedUrlError?.message);
      return errorResponse(500, 'Unable to process request');
    }

    // Persist the Storage object path (never the signed URL, which expires
    // in 1 hour and would be dead on any later read) — spec §8.1/§8.2.
    // Also record which voices row was used, but only when one was
    // actually resolved via the table lookup (resolvedVoiceRowId) — the
    // env-var fallback path has no corresponding public.voices.id to store.
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update(
        resolvedVoiceRowId
          ? { audio_path: storagePath, voice_id: resolvedVoiceRowId }
          : { audio_path: storagePath },
      )
      .eq('id', sessionId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('Failed to update session audio_path:', updateError.message);
      return errorResponse(500, 'Unable to process request');
    }

    return jsonResponse({ audioUrl: signedUrlData.signedUrl });
  } catch (err) {
    console.error('Unhandled error in synthesize-audio:', err instanceof Error ? err.message : err);
    return errorResponse(500, 'Internal server error');
  }
});
