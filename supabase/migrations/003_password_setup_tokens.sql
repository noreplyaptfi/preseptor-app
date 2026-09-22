-- APTFI Preseptor v0.2.1
-- App-owned, one-time activation/reset tokens.

create table if not exists public.auth_password_tokens (
  id bigint generated always as identity primary key,
  token_hash text not null unique,
  email citext not null,
  user_id uuid not null,
  audience text not null check (audience in ('participant','admin')),
  purpose text not null check (purpose in ('activate','reset','invite')),
  next_path text not null default '/dashboard',
  ip_address text,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists auth_password_tokens_email_created_idx
  on public.auth_password_tokens(lower(email::text), created_at desc);

create index if not exists auth_password_tokens_active_idx
  on public.auth_password_tokens(token_hash)
  where used_at is null;

alter table public.auth_password_tokens enable row level security;
