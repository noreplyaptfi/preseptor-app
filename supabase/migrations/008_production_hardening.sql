-- APTFI Preseptor v0.4.2
-- Production hardening: durable rate-limit events.
create table if not exists public.request_events (
  id bigint generated always as identity primary key,
  scope text not null,
  key_hash text not null,
  created_at timestamptz not null default now()
);
create index if not exists request_events_scope_key_created_idx
  on public.request_events(scope,key_hash,created_at desc);
alter table public.request_events enable row level security;
-- Intentionally no public policies. Only service_role routes can read/write.
