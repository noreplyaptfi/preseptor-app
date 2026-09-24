-- v0.4.7: direct-to-Supabase uploads to avoid Vercel Function 4.5 MB request-body limit.
create table if not exists public.registration_upload_sessions (
  id uuid primary key,
  registration_id uuid not null unique,
  event_id uuid not null references public.events(id) on delete cascade,
  payload jsonb not null default '{}'::jsonb,
  files jsonb not null default '{}'::jsonb,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists registration_upload_sessions_expires_idx on public.registration_upload_sessions(expires_at);
alter table public.registration_upload_sessions enable row level security;
-- No public RLS policies: this table is service-role only.
