// supabase/functions/generate-voice-previews/index.ts
//
// ONE-OFF ADMIN TASK — not part of the app's public API surface, not called
// by src/repositories/*, and not deployed under the normal JWT-verified
// flow the other two functions use. Generates a fixed sample clip for every
// public.voices row that doesn't have a preview_audio_path yet, uploads it
// to the public voice-previews bucket, and records the path. Meant to be
// deployed with `--no-verify-jwt`, invoked once per new batch of voices,
// then deleted (`supabase functions delete generate-voice-previews`) —
// there's no reason for this to exist as a standing endpoint between runs.
//
// Auth: gated on ADMIN_TASK_SECRET (a throwaway secret set only for the
// duration of a run), checked via the x-admin-secret header — deliberately
// NOT the SEC-01 user-JWT pattern used elsewhere, since this has no calling
// user or per-user scoping concept, and no app user should ever be able to
// trigger it (it spends ElevenLabs credits and writes to a shared table).

import { corsHeaders, errorResponse, jsonResponse } from '../_shared/cors.ts';
import { createAdminClient } from '../_shared/auth.ts';

const STORAGE_BUCKET = 'voice-previews';

// Same cost-conscious model synthesize-audio defaults to (see that file for
// the verified-against-docs rationale) — no reason for previews to cost
// more per character than real generations do.
const MODEL_ID = 'eleven_flash_v2_5';

// One fixed line, same for every voice, so previews are a fair side-by-side
// comparison. Short by design — this is a sample, not a real session — to
// keep the one-time credit cost per voice small.
const PREVIEW_TEXT =
  'Welcome. Find a comfortable position, and gently close your eyes. Take a slow, deep breath in… and let it go. This is your time to relax.';

interface VoiceRow {
  id: string;
  elevenlabs_voice_id: string;
  display_name: string;
}

interface VoiceResult {
  voice: string;
  status: 'ok' | 'tts_failed' | 'upload_failed' | 'db_update_failed' | 'error';
  detail?: string;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return errorResponse(405, 'Method not allowed');
  }

  const adminSecret = Deno.env.get('ADMIN_TASK_SECRET');
  if (!adminSecret || req.headers.get('x-admin-secret') !== adminSecret) {
    return errorResponse(401, 'Unauthorized');
  }

  const elevenLabsApiKey = Deno.env.get('ELEVENLABS_API_KEY');
  if (!elevenLabsApiKey) {
    return errorResponse(500, 'ELEVENLABS_API_KEY is not configured');
  }

  const supabaseAdmin = createAdminClient();

  // Only voices missing a preview — safe to re-run after adding new voices
  // later without re-billing ones that already have a clip.
  const { data: voices, error: fetchError } = await supabaseAdmin
    .from('voices')
    .select('id, elevenlabs_voice_id, display_name')
    .is('preview_audio_path', null);

  if (fetchError) {
    return errorResponse(500, `Failed to fetch voices: ${fetchError.message}`);
  }

  const results: VoiceResult[] = [];

  for (const voice of (voices ?? []) as VoiceRow[]) {
    try {
      const ttsRes = await fetch(
        `https://api.elevenlabs.io/v1/text-to-speech/${voice.elevenlabs_voice_id}`,
        {
          method: 'POST',
          headers: {
            'xi-api-key': elevenLabsApiKey,
            'Content-Type': 'application/json',
            'Accept': 'audio/mpeg',
          },
          body: JSON.stringify({ text: PREVIEW_TEXT, model_id: MODEL_ID }),
        },
      );

      if (!ttsRes.ok) {
        results.push({ voice: voice.display_name, status: 'tts_failed', detail: await ttsRes.text() });
        continue;
      }

      const audioBytes = new Uint8Array(await ttsRes.arrayBuffer());
      // Keyed by voices.id, not display name — stable even if a voice is
      // renamed later.
      const storagePath = `${voice.id}.mp3`;

      const { error: uploadError } = await supabaseAdmin.storage
        .from(STORAGE_BUCKET)
        .upload(storagePath, audioBytes, { contentType: 'audio/mpeg', upsert: true });

      if (uploadError) {
        results.push({ voice: voice.display_name, status: 'upload_failed', detail: uploadError.message });
        continue;
      }

      const { error: updateError } = await supabaseAdmin
        .from('voices')
        .update({ preview_audio_path: storagePath })
        .eq('id', voice.id);

      if (updateError) {
        results.push({ voice: voice.display_name, status: 'db_update_failed', detail: updateError.message });
        continue;
      }

      results.push({ voice: voice.display_name, status: 'ok' });
    } catch (err) {
      results.push({
        voice: voice.display_name,
        status: 'error',
        detail: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return jsonResponse({ results });
});
