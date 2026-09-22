export type AsyncStatus = 'idle' | 'loading' | 'success' | 'error';

export interface MeditationSession {
    id: string;
    user_id: string;
    prompt: string;
    script: string;
    audio_path: string | null;
    duration_seconds: number | null;
    created_at: string;
    is_favorite: boolean;
    voice_id: string | null;
}

export interface Voice {
    id: string;
    display_name: string;
    description: string | null;
    preview_audio_path: string | null;
}

export class GeminiError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'GeminiError';
    }
}

export class ElevenLabsError extends Error {
    constructor(message: string) {
        super(message);
        this.name = 'ElevenLabsError';
    }
}