// Shared CORS + JSON response helpers for all Edge Functions.
// supabase.functions.invoke() (used by src/repositories/*) is called from
// the Expo client (web + native), so every response — including errors and
// the OPTIONS preflight — must carry these headers.

export const corsHeaders: Record<string, string> = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

// Structured error body per spec §8.2 — callers must never see stack traces
// or raw DB/upstream error messages, only a short safe message + status.
export function errorResponse(status: number, message: string): Response {
  return jsonResponse({ error: message }, status);
}
