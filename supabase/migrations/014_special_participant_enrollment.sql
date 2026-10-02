-- v0.4.17 Special Participant Enrollment
-- Allows admin-created participants while public registration remains closed.

alter table public.registrations
  add column if not exists enrollment_source text not null default 'public',
  add column if not exists special_enrollment_at timestamptz,
  add column if not exists special_enrollment_by text;

create index if not exists registrations_event_enrollment_source_idx
  on public.registrations(event_id,enrollment_source,created_at desc);
