-- Multi-voice support for ElevenLabs text-to-speech (previously a single
-- voice ID lived in a Supabase secret). Adds a shared voice catalog table
-- plus voice references on sessions and profiles.
-- Builds on public.sessions and public.profiles from
-- 20260708000000_initial_schema.sql.

-- ---------------------------------------------------------------------------
-- voices — shared reference table of selectable ElevenLabs voices.
-- Admin-managed only (Supabase dashboard / service-role); no per-user
-- ownership concept, so there are no insert/update/delete policies for
-- authenticated/anon roles, matching how this schema treats other
-- admin-managed reference data (e.g. usage_counters has zero client-facing
-- policies).
-- ---------------------------------------------------------------------------
create table public.voices (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  description text,                    -- short blurb, e.g. "Warm and gentle, ideal for evening wind-down"
  elevenlabs_voice_id text not null,    -- real ElevenLabs voice ID; not secret, just an identifier
  preview_audio_path text,              -- Storage object path for a pre-generated preview clip, filled in later
  is_active boolean not null default true,  -- lets us retire a voice without deleting history that references it
  sort_order int not null default 0,    -- controls display order in the picker UI
  created_at timestamptz not null default now()
);

alter table public.voices enable row level security;

create policy "Authenticated users can view active voices"
  on public.voices for select
  to authenticated
  using (is_active = true);

-- No insert/update/delete policies: voices are managed by admins via the
-- Supabase dashboard/service-role only.

-- ---------------------------------------------------------------------------
-- sessions — record which voice was used to synthesize the audio.
-- Nullable so existing rows and any session that fails to get a voice
-- assigned do not break.
-- ---------------------------------------------------------------------------
alter table public.sessions
  add column voice_id uuid references public.voices(id);

-- No new RLS policies needed on sessions: the existing policies
-- ("Users can view own sessions" for select, "Users can insert own sessions"
-- for insert, "Users can update own sessions" for update — all defined in
-- 20260708000000_initial_schema.sql) apply at the ROW level via
-- `(select auth.uid()) = user_id`, with no column-level grants/restrictions
-- involved. A new column on an already-covered table is automatically
-- readable and writable under the same row-level checks.

-- ---------------------------------------------------------------------------
-- profiles — user's preferred voice for future generations. Nullable.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column preferred_voice_id uuid references public.voices(id);

-- No new RLS policies needed on profiles: the existing policies
-- ("Users can view own profile" for select, "Users can update own profile"
-- for update — both defined in 20260708000000_initial_schema.sql) apply at
-- the ROW level via `(select auth.uid()) = id`, so this new column is
-- automatically covered.

-- No rows are seeded here — real ElevenLabs voice IDs will be inserted in a
-- follow-up migration once the actual voices are chosen.
