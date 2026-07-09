-- Phase 1: Database Schema & RLS (build-plan.md, spec §8.2 / §10)
-- Tables: profiles, sessions, usage_counters
-- Plus: profile auto-create trigger, private storage bucket + per-user read
-- policy, and an atomic rate-limit counter function for SEC-03.

-- ---------------------------------------------------------------------------
-- profiles — extends auth.users (spec §10)
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  display_name text,
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "Users can view own profile"
  on public.profiles for select
  to authenticated
  using ((select auth.uid()) = id);

create policy "Users can update own profile"
  on public.profiles for update
  to authenticated
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

-- Inserts happen only via the on_auth_user_created trigger (security definer),
-- so no client-facing insert policy is created.

-- ---------------------------------------------------------------------------
-- sessions — one row per generated meditation (spec §10)
-- ---------------------------------------------------------------------------
create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  prompt text not null,
  script text not null,
  audio_path text,              -- Storage object path ({userId}/{sessionId}.mp3), NOT a signed URL
  duration_seconds int,
  created_at timestamptz not null default now()
);

create index sessions_user_id_created_at_idx
  on public.sessions (user_id, created_at desc);

alter table public.sessions enable row level security;

create policy "Users can view own sessions"
  on public.sessions for select
  to authenticated
  using ((select auth.uid()) = user_id);

create policy "Users can insert own sessions"
  on public.sessions for insert
  to authenticated
  with check ((select auth.uid()) = user_id);

create policy "Users can update own sessions"
  on public.sessions for update
  to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- ---------------------------------------------------------------------------
-- usage_counters — per-user hourly rate limiting (SEC-03, spec §8.2 / §10)
-- RLS enabled with NO client-facing policies: only the Edge Functions
-- (service-role client, which bypasses RLS) may read or write counters.
-- ---------------------------------------------------------------------------
create table public.usage_counters (
  user_id uuid not null references auth.users(id) on delete cascade,
  window_start timestamptz not null,
  request_count int not null default 0,
  primary key (user_id, window_start)
);

alter table public.usage_counters enable row level security;

-- Atomic check-and-increment for the current hourly window (spec §8.2:
-- single INSERT ... ON CONFLICT ... RETURNING — never read-then-write).
-- Returns true if the request is within the limit, false if over it.
create or replace function public.check_and_increment_usage(
  p_user_id uuid,
  p_max_requests int
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_window_start timestamptz := date_trunc('hour', now());
  v_count int;
begin
  insert into public.usage_counters (user_id, window_start, request_count)
  values (p_user_id, v_window_start, 1)
  on conflict (user_id, window_start)
  do update set request_count = public.usage_counters.request_count + 1
  returning request_count into v_count;

  return v_count <= p_max_requests;
end;
$$;

-- Callable only by the Edge Functions' service-role client.
revoke execute on function public.check_and_increment_usage(uuid, int)
  from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Profile auto-create trigger — display_name comes from the signUp call's
-- options.data metadata (build-plan.md Phase 1, task 5)
-- ---------------------------------------------------------------------------
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, new.raw_user_meta_data ->> 'display_name');
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ---------------------------------------------------------------------------
-- Storage: private meditation-audio bucket (spec §8.2)
-- Objects are uploaded by the synthesize-audio Edge Function (service role,
-- bypasses RLS) under {userId}/{sessionId}.mp3. Authenticated users may read
-- only their own {userId}/ prefix — this is what allows the client-side
-- refreshAudioUrl / createSignedUrl call (spec §9.13).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('meditation-audio', 'meditation-audio', false)
on conflict (id) do nothing;

create policy "Users can read own audio files"
  on storage.objects for select
  to authenticated
  using (
    bucket_id = 'meditation-audio'
    and (storage.foldername(name))[1] = (select auth.uid())::text
  );
