-- v0.4.13 — independent registration windows for Online / Offline
-- Safe to run once after v0.4.12. Existing behavior is preserved while these values are NULL.

alter table public.events
  add column if not exists online_registration_opens_at timestamptz null,
  add column if not exists online_registration_closes_at timestamptz null,
  add column if not exists offline_registration_opens_at timestamptz null,
  add column if not exists offline_registration_closes_at timestamptz null;

comment on column public.events.online_registration_opens_at is 'Optional Online registration opening time. NULL falls back to legacy/global registration schedule.';
comment on column public.events.online_registration_closes_at is 'Optional Online registration closing time. NULL falls back to legacy/global registration schedule.';
comment on column public.events.offline_registration_opens_at is 'Optional Offline registration opening time. NULL falls back to legacy/global registration schedule.';
comment on column public.events.offline_registration_closes_at is 'Optional Offline registration closing time. NULL falls back to legacy/global registration schedule.';
