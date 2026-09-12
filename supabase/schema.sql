-- Resume — Supabase migration
-- Run in: Supabase Dashboard → SQL Editor → New query → Run
--
-- We build on the existing `reminders` table rather than creating a competing
-- one. These changes are ADDITIVE and non-breaking: existing columns and any
-- code already written against them keep working untouched.
--
--   reminders (existing)
--     id, device_id, activity, summary, next_step, source, created_at
--
--   added below
--     title      — short task name shown on the card ("Slack Integration")
--     remembers  — the bulleted context list, as a JSON array of strings

alter table public.reminders
  add column if not exists title text;

alter table public.reminders
  add column if not exists remembers jsonb not null default '[]'::jsonb;

-- Dashboard reads newest-first; this keeps that fast as rows accumulate.
create index if not exists reminders_created_at_idx
  on public.reminders (created_at desc);

-- Per-device lookup (the extension stamps a device_id on each capture).
create index if not exists reminders_device_id_idx
  on public.reminders (device_id);
