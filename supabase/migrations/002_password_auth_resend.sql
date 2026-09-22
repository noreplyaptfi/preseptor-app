-- APTFI Preseptor v0.2.0
-- Password-based auth + custom Resend recovery/invite flow.

alter table public.admin_users add column if not exists display_name text;
alter table public.admin_users add column if not exists updated_at timestamptz not null default now();

create table if not exists public.auth_email_requests (
  id bigint generated always as identity primary key,
  email citext not null,
  audience text not null check (audience in ('participant','admin')),
  request_type text not null check (request_type in ('activate','reset','invite')),
  ip_address text,
  created_at timestamptz not null default now()
);

create index if not exists auth_email_requests_email_created_idx
  on public.auth_email_requests(lower(email::text), created_at desc);

alter table public.auth_email_requests enable row level security;
-- No public policies: only the service_role used by server routes can access this table.

-- Optional display name for the first super admin can be set later from the dashboard.
