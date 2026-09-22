import { supabase } from '../lib/supabaseClient';
import type { Voice } from '../types';

const VOICE_PREVIEWS_BUCKET = 'voice-previews';

interface VoiceRow {
    id: string;
    display_name: string;
    description: string | null;
    preview_audio_path: string | null;
}

export async function listVoices(): Promise<Voice[]> {
    const { data, error } = await supabase
        .from('voices')
        .select('id, display_name, description, preview_audio_path')
        .eq('is_active', true)
        .order('sort_order', { ascending: true });

    if (error) {
        throw new Error(error.message);
    }

    return (data as VoiceRow[]).map((row) => ({
        id: row.id,
        display_name: row.display_name,
        description: row.description,
        preview_audio_path: row.preview_audio_path,
    }));
}

// voice-previews is a public bucket (see supabase/migrations) — a public URL
// needs no signing/expiry handling, unlike the private meditation-audio
// bucket's signed URLs.
export function getVoicePreviewUrl(previewAudioPath: string): string {
    const { data } = supabase.storage.from(VOICE_PREVIEWS_BUCKET).getPublicUrl(previewAudioPath);
    return data.publicUrl;
}
