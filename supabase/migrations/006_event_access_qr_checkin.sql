-- APTFI Preseptor v0.4.0
-- Event access release controls, offline check-in QR, and online Zoom QR.

alter table public.events add column if not exists offline_qr_enabled boolean not null default false;
alter table public.events add column if not exists offline_qr_release_at timestamptz;
alter table public.events add column if not exists online_access_enabled boolean not null default false;
alter table public.events add column if not exists online_access_release_at timestamptz;
alter table public.events add column if not exists zoom_url text;

alter table public.registrations add column if not exists checkin_token uuid not null default gen_random_uuid();
alter table public.registrations add column if not exists checked_in_at timestamptz;
alter table public.registrations add column if not exists checked_in_by citext;

create unique index if not exists registrations_checkin_token_unique_idx
  on public.registrations(checkin_token);

create index if not exists registrations_event_checkin_idx
  on public.registrations(event_id, attendance_mode, checked_in_at);

-- Access remains disabled after migration. Admin publishes it explicitly from
-- Dashboard Panitia > Akses Acara when operational details are ready.
update public.events
set offline_qr_enabled = coalesce(offline_qr_enabled,false),
    online_access_enabled = coalesce(online_access_enabled,false),
    updated_at = now()
where slug='preseptor-2026';
