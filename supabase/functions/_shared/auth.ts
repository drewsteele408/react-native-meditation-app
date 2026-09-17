// Shared Supabase admin client + SEC-01 JWT verification helper, used by
// both generate-script and synthesize-audio. Supabase bundles each Edge
// Function independently at deploy time, so importing from a local
// `_shared/` module (the standard Supabase convention) does not create a
// runtime cross-function dependency.

import {
  createClient,
  type SupabaseClient,
  type User,
} from 'https://esm.sh/@supabase/supabase-js@2';
import { errorResponse } from './cors.ts';

// Service-role client: bypasses RLS. Required to
//   - verify arbitrary caller JWTs via auth.getUser(token)
//   - call check_and_increment_usage (EXECUTE revoked from anon/authenticated)
//   - write sessions.audio_path and upload to the private storage bucket
// Never expose SUPABASE_SERVICE_ROLE_KEY to the client app.
export function createAdminClient(): SupabaseClient {
  const url = Deno.env.get('SUPABASE_URL');
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !serviceRoleKey) {
    // Fails the request with a 500 upstream rather than leaking which
    // secret is missing; see callers' top-level try/catch.
    throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  }
  return createClient(url, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export type AuthOutcome =
  | { user: User; errorResponse?: undefined }
  | { user?: undefined; errorResponse: Response };

// SEC-01 — verify the Supabase JWT sent by the client in the Authorization
// header. supabase.functions.invoke() attaches this automatically from the
// caller's session. Validated via the service-role client's auth.getUser(),
// which checks the token against Supabase Auth directly (no anon key
// needed). Callers must check `errorResponse` and return it immediately —
// no business logic may run before this passes.
export async function verifyAuth(
  req: Request,
  supabaseAdmin: SupabaseClient,
): Promise<AuthOutcome> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return { errorResponse: errorResponse(401, 'Missing or malformed authorization header') };
  }

  const token = authHeader.slice('Bearer '.length).trim();
  if (!token) {
    return { errorResponse: errorResponse(401, 'Missing bearer token') };
  }

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data.user) {
    return { errorResponse: errorResponse(401, 'Invalid or expired token') };
  }

  return { user: data.user };
}
