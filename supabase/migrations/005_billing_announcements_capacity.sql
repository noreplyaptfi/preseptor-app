-- APTFI Preseptor v0.3.0
-- Billing documents, announcements, XLSX export support, and event capacity.

alter table public.events add column if not exists registration_fee bigint not null default 1000000;
alter table public.events add column if not exists quota_total integer not null default 200;
alter table public.events add column if not exists quota_online integer not null default 150;
alter table public.events add column if not exists quota_offline integer not null default 50;

alter table public.registrations add column if not exists amount_due bigint not null default 1000000;

update public.events
set registration_fee=1000000,
    quota_total=200,
    quota_online=150,
    quota_offline=50,
    updated_at=now()
where slug='preseptor-2026';

update public.registrations r
set amount_due=e.registration_fee
from public.events e
where r.event_id=e.id and (r.amount_due is null or r.amount_due<=0);

create table if not exists public.announcements (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  subject text not null,
  body_html text not null,
  audience text not null default 'all' check (audience in ('all','online','offline','verified')),
  created_by citext,
  published_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
create index if not exists announcements_event_published_idx on public.announcements(event_id,published_at desc);

create table if not exists public.announcement_reads (
  announcement_id uuid not null references public.announcements(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (announcement_id,registration_id)
);
create index if not exists announcement_reads_registration_idx on public.announcement_reads(registration_id,read_at desc);

alter table public.announcements enable row level security;
alter table public.announcement_reads enable row level security;

-- Capacity enforcement is serialized through the event row lock. Legacy imports are
-- allowed so historical WordPress data can always be migrated; after import the
-- public form will naturally show zero remaining capacity if a quota is exceeded.
create or replace function public.enforce_preseptor_capacity() returns trigger
language plpgsql security definer set search_path=public as $$
declare
  ev public.events%rowtype;
  total_count integer;
  mode_count integer;
begin
  if new.legacy_source is not null then
    return new;
  end if;

  select * into ev from public.events where id=new.event_id for update;
  if not found then
    return new;
  end if;

  select count(*) into total_count from public.registrations where event_id=new.event_id;
  if ev.quota_total > 0 and total_count >= ev.quota_total then
    raise exception using errcode='P0001', message='quota_total_full';
  end if;

  if new.attendance_mode='Online' then
    select count(*) into mode_count from public.registrations where event_id=new.event_id and attendance_mode='Online';
    if ev.quota_online > 0 and mode_count >= ev.quota_online then
      raise exception using errcode='P0001', message='quota_online_full';
    end if;
  elsif new.attendance_mode='Offline' then
    select count(*) into mode_count from public.registrations where event_id=new.event_id and attendance_mode='Offline';
    if ev.quota_offline > 0 and mode_count >= ev.quota_offline then
      raise exception using errcode='P0001', message='quota_offline_full';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists registrations_capacity_guard on public.registrations;
create trigger registrations_capacity_guard
before insert on public.registrations
for each row execute function public.enforce_preseptor_capacity();
