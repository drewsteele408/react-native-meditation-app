jest.mock('../lib/supabaseClient', () => ({
  supabase: {
    functions: {
      invoke: jest.fn(),
    },
  },
}));

import { generateScript } from './geminiRepository';
import { GeminiError } from '../types';
import { supabase } from '../lib/supabaseClient';

const invokeMock = supabase.functions.invoke as jest.Mock;

beforeEach(() => {
  invokeMock.mockReset();
});

describe('generateScript', () => {
  it('resolves { sessionId, script } on a valid response', async () => {
    invokeMock.mockResolvedValue({
      data: { sessionId: 'session-123', script: 'A calm meditation...' },
      error: null,
    });

    const result = await generateScript('I feel anxious', 10);

    expect(invokeMock).toHaveBeenCalledWith('generate-script', {
      body: { prompt: 'I feel anxious', durationMinutes: 10 },
    });
    expect(result).toEqual({ sessionId: 'session-123', script: 'A calm meditation...' });
  });

  it('throws GeminiError with the underlying message on a 4xx-style failure', async () => {
    invokeMock.mockResolvedValue({
      data: null,
      error: { message: 'Quota exceeded' },
    });

    await expect(generateScript('I feel anxious')).rejects.toThrow(GeminiError);
    await expect(generateScript('I feel anxious')).rejects.toThrow('Quota exceeded');
  });

  it('propagates a network-level rejection from invoke', async () => {
    invokeMock.mockRejectedValue(new Error('Network request failed'));

    await expect(generateScript('I feel anxious')).rejects.toThrow('Network request failed');
  });
});
