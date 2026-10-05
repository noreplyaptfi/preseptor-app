-- APTFI Preseptor v0.5.0 — Day-H Core
-- Presensi per hari (check-in only), akun uji/dummy, dan command center Hari-H.

alter table public.events
  add column if not exists day_h_enabled boolean not null default false;

alter table public.registrations
  add column if not exists is_test_account boolean not null default false;

alter table public.registrations drop constraint if exists registrations_lifecycle_status_check;
alter table public.registrations
  add constraint registrations_lifecycle_status_check
  check (lifecycle_status in ('active','withdrawal_requested','withdrawn','rejected','test'));

create index if not exists registrations_test_account_idx
  on public.registrations(event_id,is_test_account,lifecycle_status);

create table if not exists public.event_days (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  day_number integer not null check (day_number > 0),
  title text not null,
  event_date date not null,
  checkin_open_at timestamptz,
  checkin_close_at timestamptz,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(event_id,day_number),
  unique(event_id,event_date)
);

create table if not exists public.attendance_records (
  id uuid primary key default gen_random_uuid(),
  registration_id uuid not null references public.registrations(id) on delete cascade,
  event_day_id uuid not null references public.event_days(id) on delete cascade,
  attendance_type text not null default 'checkin' check (attendance_type = 'checkin'),
  channel text not null check (channel in ('offline_qr','online_self','manual')),
  occurred_at timestamptz not null default now(),
  operator_email citext,
  notes text,
  created_at timestamptz not null default now(),
  unique(registration_id,event_day_id,attendance_type)
);

create index if not exists attendance_records_day_idx
  on public.attendance_records(event_day_id,occurred_at desc);
create index if not exists attendance_records_registration_idx
  on public.attendance_records(registration_id,event_day_id);

alter table public.event_days enable row level security;
alter table public.attendance_records enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='event_days' and policyname='admins read event days'
  ) then
    create policy "admins read event days"
      on public.event_days for select to authenticated
      using (public.is_aptfi_admin());
  end if;

  if not exists (
    select 1 from pg_policies
    where schemaname='public' and tablename='attendance_records' and policyname='participant reads own attendance'
  ) then
    create policy "participant reads own attendance"
      on public.attendance_records for select to authenticated
      using (
        public.is_aptfi_admin()
        or exists (
          select 1 from public.registrations r
          where r.id = registration_id
            and lower(r.email::text) = lower(coalesce(auth.jwt()->>'email',''))
        )
      );
  end if;
end $$;

-- Default jadwal sesuai keputusan operasional. Super Admin dapat override dari Command Center.
insert into public.event_days(event_id,day_number,title,event_date,checkin_open_at,checkin_close_at,active)
select e.id,1,'Hari 1','2026-10-07'::date,
       '2026-10-07 07:00:00+07'::timestamptz,
       '2026-10-07 09:00:00+07'::timestamptz,
       true
from public.events e where e.slug='preseptor-2026'
on conflict(event_id,day_number) do update set
  title=excluded.title,
  event_date=excluded.event_date,
  checkin_open_at=coalesce(public.event_days.checkin_open_at,excluded.checkin_open_at),
  checkin_close_at=coalesce(public.event_days.checkin_close_at,excluded.checkin_close_at);

insert into public.event_days(event_id,day_number,title,event_date,checkin_open_at,checkin_close_at,active)
select e.id,2,'Hari 2','2026-10-08'::date,
       '2026-10-08 07:00:00+07'::timestamptz,
       '2026-10-08 09:00:00+07'::timestamptz,
       true
from public.events e where e.slug='preseptor-2026'
on conflict(event_id,day_number) do update set
  title=excluded.title,
  event_date=excluded.event_date,
  checkin_open_at=coalesce(public.event_days.checkin_open_at,excluded.checkin_open_at),
  checkin_close_at=coalesce(public.event_days.checkin_close_at,excluded.checkin_close_at);

-- day_h_enabled sengaja tetap FALSE. Super Admin mengaktifkan setelah test selesai.


-- Akun uji tetap menggunakan lifecycle_status='active' agar perilaku UI peserta normal,
-- tetapi tidak boleh memakai kuota.
create or replace function public.enforce_preseptor_capacity()
returns trigger language plpgsql as $$
declare v_quota_total integer; v_quota_online integer; v_quota_offline integer; v_active_total integer; v_active_mode integer;
begin
  if coalesce(new.is_test_account,false) then return new; end if;
  if coalesce(new.lifecycle_status,'active') not in ('active','withdrawal_requested') then return new; end if;
  select e.quota_total,e.quota_online,e.quota_offline into v_quota_total,v_quota_online,v_quota_offline from public.events e where e.id=new.event_id for update;
  select count(*)::integer into v_active_total from public.registrations r where r.event_id=new.event_id and coalesce(r.is_test_account,false)=false and coalesce(r.lifecycle_status,'active') in ('active','withdrawal_requested');
  if coalesce(v_quota_total,0)>0 and v_active_total>=v_quota_total then raise exception 'quota_total_full' using errcode='P0001'; end if;
  select count(*)::integer into v_active_mode from public.registrations r where r.event_id=new.event_id and coalesce(r.is_test_account,false)=false and r.attendance_mode=new.attendance_mode and coalesce(r.lifecycle_status,'active') in ('active','withdrawal_requested');
  if new.attendance_mode='Online' and coalesce(v_quota_online,0)>0 and v_active_mode>=v_quota_online then raise exception 'quota_online_full' using errcode='P0001'; end if;
  if new.attendance_mode='Offline' and coalesce(v_quota_offline,0)>0 and v_active_mode>=v_quota_offline then raise exception 'quota_offline_full' using errcode='P0001'; end if;
  return new;
end; $$;

create or replace function public.enforce_preseptor_capacity_update()
returns trigger language plpgsql as $$
declare v_quota_total integer; v_quota_online integer; v_quota_offline integer; v_active_total integer; v_active_mode integer;
begin
  if coalesce(new.is_test_account,false) then return new; end if;
  if coalesce(new.lifecycle_status,'active') not in ('active','withdrawal_requested') then return new; end if;
  select e.quota_total,e.quota_online,e.quota_offline into v_quota_total,v_quota_online,v_quota_offline from public.events e where e.id=new.event_id for update;
  select count(*)::integer into v_active_total from public.registrations r where r.event_id=new.event_id and r.id<>new.id and coalesce(r.is_test_account,false)=false and coalesce(r.lifecycle_status,'active') in ('active','withdrawal_requested');
  if coalesce(v_quota_total,0)>0 and v_active_total>=v_quota_total then raise exception 'quota_total_full' using errcode='P0001'; end if;
  select count(*)::integer into v_active_mode from public.registrations r where r.event_id=new.event_id and r.id<>new.id and coalesce(r.is_test_account,false)=false and r.attendance_mode=new.attendance_mode and coalesce(r.lifecycle_status,'active') in ('active','withdrawal_requested');
  if new.attendance_mode='Online' and coalesce(v_quota_online,0)>0 and v_active_mode>=v_quota_online then raise exception 'quota_online_full' using errcode='P0001'; end if;
  if new.attendance_mode='Offline' and coalesce(v_quota_offline,0)>0 and v_active_mode>=v_quota_offline then raise exception 'quota_offline_full' using errcode='P0001'; end if;
  return new;
end; $$;
