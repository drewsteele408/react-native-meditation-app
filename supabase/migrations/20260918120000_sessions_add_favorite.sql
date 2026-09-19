-- Add "favorite" flag to sessions (favorites feature)
-- Builds on public.sessions from 20260708000000_initial_schema.sql

alter table public.sessions
  add column is_favorite boolean not null default false;

create index sessions_user_favorite_idx
  on public.sessions (user_id, is_favorite, created_at desc);

-- No new RLS policies needed: the existing policies on public.sessions
-- ("Users can view own sessions" for select, "Users can insert own sessions"
-- for insert, "Users can update own sessions" for update — all defined in
-- 20260708000000_initial_schema.sql) apply at the ROW level via
-- `(select auth.uid()) = user_id`, with no column-level grants/restrictions
-- involved. Postgres RLS policies gate which rows a role can see/touch, not
-- which columns — so a new column on an already-covered table is
-- automatically readable and writable under the same row-level checks.
-- Confirmed: an authenticated user can already select and update
-- is_favorite on their own sessions rows; they still cannot touch another
-- user's rows, since user_id is immutable in the update `with check` and
-- never exposed for cross-user writes.
