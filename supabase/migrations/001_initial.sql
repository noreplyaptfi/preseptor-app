create extension if not exists pgcrypto;
create extension if not exists citext;

create table if not exists public.events (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  title text not null,
  event_start timestamptz,
  event_end timestamptz,
  registration_status text not null default 'open' check (registration_status in ('open','closed','scheduled','maintenance')),
  registration_opens_at timestamptz,
  registration_closes_at timestamptz,
  maintenance_until timestamptz,
  maintenance_message text not null default 'Kami sedang melakukan peningkatan sistem pendaftaran. Pendaftaran akan dibuka kembali setelah pemeliharaan selesai.',
  not_open_message text not null default 'Pendaftaran belum dibuka.',
  closed_message text not null default 'Pendaftaran telah ditutup.',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create sequence if not exists public.preseptor_registration_seq start 1001;
create or replace function public.next_preseptor_registration_code() returns text
language sql security definer set search_path=public as $$
  select 'APT-PRS-' || to_char(now() at time zone 'Asia/Jakarta','YYYYMMDD') || '-' || lpad(nextval('public.preseptor_registration_seq')::text,5,'0');
$$;
revoke all on function public.next_preseptor_registration_code() from public, anon, authenticated;
grant execute on function public.next_preseptor_registration_code() to service_role;

create table if not exists public.registrations (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_code text unique not null,
  full_name text not null,
  email citext not null,
  whatsapp text not null default '',
  university text not null default '',
  attendance_mode text check (attendance_mode in ('Online','Offline') or attendance_mode is null),
  participant_type text check (participant_type in ('practitioner','lecturer','lecturer_practitioner') or participant_type is null),
  practice_type text,
  practice_name text,
  practice_years numeric(5,2) not null default 0,
  teaching_years numeric(5,2) not null default 0,
  requirements_status text not null default 'incomplete' check (requirements_status in ('incomplete','pending','valid','rejected')),
  payment_status text not null default 'pending' check (payment_status in ('pending','verified','rejected')),
  overall_status text not null default 'pending',
  requirements_verified_at timestamptz,
  requirements_verified_by citext,
  payment_verified_at timestamptz,
  payment_verified_by citext,
  legacy_source text,
  legacy_payment_proof_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists registrations_event_email_unique on public.registrations(event_id, lower(email::text));
create index if not exists registrations_status_idx on public.registrations(requirements_status,payment_status);

create table if not exists public.registration_documents (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  document_type text not null check (document_type in ('stra','experience','payment_proof')),
  storage_path text not null,
  original_name text,
  mime_type text,
  file_size bigint,
  status text not null default 'pending' check (status in ('pending','valid','rejected')),
  created_at timestamptz not null default now()
);
create index if not exists registration_documents_reg_idx on public.registration_documents(registration_id,document_type);

create table if not exists public.admin_users (
  id uuid primary key default gen_random_uuid(),
  email citext unique not null,
  role text not null default 'viewer' check (role in ('super_admin','event_admin','document_verifier','payment_verifier','viewer')),
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table if not exists public.activity_logs (
  id bigint generated always as identity primary key,
  registration_id uuid references public.registrations(id) on delete set null,
  actor_type text not null default 'system',
  actor_email citext,
  action text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create table if not exists public.email_logs (
  id bigint generated always as identity primary key,
  registration_id uuid references public.registrations(id) on delete cascade,
  email_type text not null,
  recipient citext not null,
  status text not null,
  provider_id text,
  error_message text,
  created_at timestamptz not null default now()
);

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values ('preseptor-private','preseptor-private',false,5242880,array['image/jpeg','image/png','application/pdf'])
on conflict (id) do update set public=false,file_size_limit=5242880,allowed_mime_types=array['image/jpeg','image/png','application/pdf'];

alter table public.events enable row level security;
alter table public.registrations enable row level security;
alter table public.registration_documents enable row level security;
alter table public.admin_users enable row level security;
alter table public.activity_logs enable row level security;
alter table public.email_logs enable row level security;

create or replace function public.is_aptfi_admin() returns boolean language sql stable security definer set search_path=public as $$
  select exists(select 1 from public.admin_users where active=true and lower(email::text)=lower(coalesce(auth.jwt()->>'email','')));
$$;

create policy "participant reads own registration" on public.registrations for select to authenticated using (lower(email::text)=lower(coalesce(auth.jwt()->>'email','')) or public.is_aptfi_admin());
create policy "participant reads own documents" on public.registration_documents for select to authenticated using (exists(select 1 from public.registrations r where r.id=registration_id and (lower(r.email::text)=lower(coalesce(auth.jwt()->>'email','')) or public.is_aptfi_admin())));
create policy "admins read admin list" on public.admin_users for select to authenticated using (public.is_aptfi_admin());
create policy "admins read activity logs" on public.activity_logs for select to authenticated using (public.is_aptfi_admin());
create policy "admins read email logs" on public.email_logs for select to authenticated using (public.is_aptfi_admin());

insert into public.events (slug,title,event_start,event_end,registration_status,registration_closes_at)
values ('preseptor-2026','Pelatihan Preseptor APTFI','2026-10-07 00:00:00+07','2026-10-08 23:59:59+07','open','2026-10-01 23:59:59+07')
on conflict (slug) do nothing;
