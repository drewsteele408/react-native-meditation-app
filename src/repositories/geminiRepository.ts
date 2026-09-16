import { supabase } from '../lib/supabaseClient'; 
import { GeminiError } from '../types';

export async function generateScript(
    prompt: string, 
    durationMinutes?: number
): Promise<{ sessionId: string; script: string }> {
    const { data, error } = await supabase.functions.invoke('generate-script', {
        body: { prompt, durationMinutes }, 
    });

    if (error) {
        throw new GeminiError(error.message);
    }

    return data as { sessionId: string; script: string};
}
