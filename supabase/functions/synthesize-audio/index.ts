// supabase/functions/synthesize-audio/index.ts
//
// POST { sessionId: string }
// -> { audioUrl: string }   (a 1-hour signed Supabase Storage URL)
//
// Security checks run in this exact order (spec §8.2 / §8.1 / build-plan.md
// Phase 4):
//   SEC-01  Verify Supabase JWT                                -> 401
//   SEC-05  Fetch session by sessionId, verify ownership        -> 403 on
//           mismatch, 400 if the session doesn't exist
//           Call ElevenLabs, upload to Storage                  -> 502 on
//           upstream failure
//
// Never accept raw script text from the client here — only a sessionId.
// This is what prevents a caller from synthesizing arbitrary text (and
// burning another user's rate-limited quota) or reading someone else's
// generated script by guessing an id.

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient, verifyAuth } from '../_shared/auth.ts';

const STORAGE_BUCKET = 'meditation-audio';
const SIGNED_URL_EXPIRY_SECONDS = 60 * 60; // 1 hour, per spec §8.1 / §8.2

// Not pinned by the spec (§8.4 only specifies voice characteristics, not an
// ElevenLabs model id). eleven_multilingual_v2 is ElevenLabs' current
// general-purpose stable TTS model as of implementation time; overridable
// via env without a code change if that changes.
const DEFAULT_ELEVENLABS_MODEL_ID = 'eleven_multilingual_v2';

interface SynthesizeAudioRequestBody {
  sessionId?: unknown;
}

interface SessionRow {
  id: string;
  user_id: string;
  script: string;
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
    const voiceId = Deno.env.get('ELEVENLABS_VOICE_ID');
    if (!elevenLabsApiKey || !voiceId) {
      console.error('ELEVENLABS_API_KEY or ELEVENLABS_VOICE_ID is not configured');
      return errorResponse(500, 'Unable to process request');
    }
    const modelId = Deno.env.get('ELEVENLABS_MODEL_ID') || DEFAULT_ELEVENLABS_MODEL_ID;

    let audioBytes: Uint8Array;
    try {
      const elevenLabsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
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
    const { error: updateError } = await supabaseAdmin
      .from('sessions')
      .update({ audio_path: storagePath })
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
