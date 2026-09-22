-- Storage: public voice-previews bucket.
-- Holds short, fixed sample clips (one per voice, same script for everyone)
-- used by the voice-picker UI so users can preview a voice before generating
-- a real meditation. Unlike meditation-audio (private, per-user, signed
-- URLs — see 20260708000000_initial_schema.sql), these clips contain no
-- user data, so the bucket is public: anyone with the URL can read them,
-- no auth/signing required. This simplifies the client (no signed-URL
-- refresh logic) for something this low-sensitivity.
-- Objects are uploaded by an admin process (service role, bypasses RLS),
-- not by app users — there are no insert/update/delete policies for
-- anon/authenticated roles, matching how public.voices itself is
-- admin-managed only (see 20260922000000_add_voices.sql).
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public)
values ('voice-previews', 'voice-previews', true)
on conflict (id) do nothing;

create policy "Anyone can read voice preview clips"
  on storage.objects for select
  to public
  using (bucket_id = 'voice-previews');

-- No insert/update/delete policies: preview clips are managed by admins via
-- the Supabase dashboard/service-role only.
