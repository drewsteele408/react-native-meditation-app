import { supabase } from "../lib/supabaseClient";
import type { MeditationSession } from "../types";

const AUDIO_BUCKET = 'meditation-audio';
const SIGNED_URL_TTL_SECONDS = 60 * 60; // 1 hour

export async function getSession(sessionId: string): Promise<MeditationSession> {
    const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('id', sessionId)
    .single();

    if (error) {
        throw new Error(error.message);
    }

    return data as MeditationSession;
}

export async function refreshAudioUrl(sessionId: string): Promise<string> {
    const session = await getSession(sessionId);

    if (!session.audio_path) {
        throw new Error('Session has no audio to refresh.')
    }

    const { data, error } = await supabase.storage
    .from(AUDIO_BUCKET)
    .createSignedUrl(session.audio_path, SIGNED_URL_TTL_SECONDS);

    if (error) {
        throw new Error(error.message);
    }

    return data.signedUrl;
}

export async function setFavorite(sessionId: string, isFavorite: boolean): Promise<void> {
    const { error } = await supabase
    .from('sessions')
    .update({ is_favorite: isFavorite })
    .eq('id', sessionId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function getPreferredVoiceId(userId: string): Promise<string | null> {
    const { data, error } = await supabase
    .from('profiles')
    .select('preferred_voice_id')
    .eq('id', userId)
    .single();

    if (error) {
        throw new Error(error.message);
    }

    return (data as { preferred_voice_id: string | null }).preferred_voice_id;
}

export async function setPreferredVoiceId(userId: string, voiceId: string): Promise<void> {
    const { error } = await supabase
    .from('profiles')
    .update({ preferred_voice_id: voiceId })
    .eq('id', userId);

    if (error) {
        throw new Error(error.message);
    }
}

export async function listFavoriteSessions(): Promise<MeditationSession[]> {
    const { data, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('is_favorite', true)
    .order('created_at', { ascending: false });

    if (error) {
        throw new Error(error.message);
    }

    return data as MeditationSession[];
}
