import { supabase } from '../lib/supabaseClient';
import { ElevenLabsError } from '../types';

export async function synthesizeSpeech(sessionId: string, voiceId?: string): Promise<string> {
    const { data, error } = await supabase.functions.invoke('synthesize-audio', {
        body: voiceId ? { sessionId, voiceId } : { sessionId },
    });

    if (error) {
        throw new ElevenLabsError(error.message);
    }

    return (data as { audioUrl: string}).audioUrl;
}
