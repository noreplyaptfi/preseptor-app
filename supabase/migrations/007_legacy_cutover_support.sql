-- APTFI Preseptor v0.4.1
-- Final WordPress cutover support.

alter table public.registrations add column if not exists legacy_contact_email citext;
alter table public.registrations add column if not exists email_needs_update boolean not null default false;
alter table public.registrations add column if not exists legacy_metadata jsonb not null default '{}'::jsonb;
alter table public.registrations add column if not exists legacy_imported_at timestamptz;

create index if not exists registrations_email_needs_update_idx
  on public.registrations(event_id,email_needs_update)
  where email_needs_update=true;

-- Keep legacy rows explicit and auditable. Existing rows remain untouched.
comment on column public.registrations.legacy_contact_email is
  'Original contact email from a legacy source when auth email must be replaced (for example duplicate historical email).';
comment on column public.registrations.email_needs_update is
  'True when the migrated registration cannot activate a participant account until a unique email is assigned.';
comment on column public.registrations.legacy_metadata is
  'Raw migration metadata retained for audit/troubleshooting.';
