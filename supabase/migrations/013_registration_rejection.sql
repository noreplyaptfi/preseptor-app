-- v0.4.16 Registration rejection + inactive quota accounting

alter table public.registrations
  add column if not exists rejected_at timestamptz,
  add column if not exists rejected_reason text,
  add column if not exists rejected_by text;

alter table public.registrations drop constraint if exists registrations_lifecycle_status_check;
alter table public.registrations
  add constraint registrations_lifecycle_status_check
  check (lifecycle_status in ('active','withdrawal_requested','withdrawn','rejected'));

create index if not exists registrations_event_lifecycle_mode_idx
  on public.registrations(event_id,lifecycle_status,attendance_mode);
