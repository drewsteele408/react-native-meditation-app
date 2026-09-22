-- Seed data: the initial ElevenLabs voice catalog.
-- Inserts the first 4 selectable voices into public.voices (see
-- 20260922000000_add_voices.sql). `preview_audio_path` and `is_active` are
-- left at their column defaults (null / true) — preview clips are uploaded
-- by a separate one-off admin process after this migration runs, which then
-- backfills preview_audio_path. No `on conflict` clause: id is a
-- system-generated uuid with no natural unique key to conflict on, and this
-- is a first-time seed.
-- ---------------------------------------------------------------------------
insert into public.voices (display_name, description, elevenlabs_voice_id, sort_order)
values
  ('Relaxing Rachel', 'Warm and gentle — a soothing, unhurried voice suited to winding down.', 'ROMJ9yK1NAMuu1ggrjDW', 1),
  ('Australian Baritone', 'Deep and grounding, with a calm, measured delivery.', 'KmnvDXRA0HU55Q0aqkPG', 2),
  ('Valory B', 'Smooth and clear, with a naturally calming presence.', '0v5LXbUitV9mxxBsQ7Od', 3),
  ('Oliver Silk', 'Soft-spoken and silky, ideal for a slow, reflective session.', 'jfIS2w2yJi0grJZPyEsk', 4);
