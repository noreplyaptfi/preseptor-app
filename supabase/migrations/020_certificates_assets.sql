-- APTFI Preseptor v0.8.0 — Sertifikat, Virtual Background, dan Materi
--   * pengaturan sertifikat per event (rilis + teks template)
--   * tabel certificates: nomor urut & kode verifikasi per peserta
--   * tabel event_assets: virtual background & materi yang diunggah admin
--   * bucket privat event-assets
-- Aman dijalankan ulang (idempotent). Tidak mengubah data peserta, presensi, atau assessment.

-- 1) Pengaturan sertifikat ---------------------------------------------------
alter table public.events
  add column if not exists certificate_enabled boolean not null default false;
alter table public.events
  add column if not exists certificate_config jsonb not null default '{}'::jsonb;

-- 2) Sertifikat yang sudah diterbitkan ------------------------------------------
create table if not exists public.certificates (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  registration_id uuid not null references public.registrations(id) on delete cascade,
  serial integer not null check (serial > 0),
  verify_code text not null,
  is_test boolean not null default false,
  name_on_certificate text,
  issued_via text not null default 'auto' check (issued_via in ('auto','manual')),
  override_reason text,
  issued_by citext,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_by citext,
  revoke_reason text,
  download_count integer not null default 0,
  last_downloaded_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(registration_id),
  unique(verify_code),
  unique(event_id,is_test,serial)
);

create index if not exists certificates_event_idx on public.certificates(event_id,is_test,serial);

alter table public.certificates enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='certificates' and policyname='admins read certificates'
  ) then
    create policy "admins read certificates" on public.certificates
      for select to authenticated using (public.is_aptfi_admin());
  end if;
end $$;

-- Membuat (atau mengambil) baris sertifikat peserta dengan nomor urut tanpa bentrok.
-- Nomor urut akun TEST terpisah dari nomor resmi.
create or replace function public.ensure_preseptor_certificate(
  p_registration_id uuid,
  p_is_test boolean default false,
  p_via text default 'auto',
  p_reason text default null,
  p_actor text default null
) returns setof public.certificates
language plpgsql security definer set search_path=public as $$
declare v_event uuid; v_serial integer;
begin
  select event_id into v_event from public.registrations where id=p_registration_id;
  if v_event is null then
    raise exception 'registration_not_found' using errcode='P0002';
  end if;
  if not exists (select 1 from public.certificates where registration_id=p_registration_id) then
    perform pg_advisory_xact_lock(hashtext('preseptor-certificate:'||v_event::text||':'||coalesce(p_is_test,false)::text));
    if not exists (select 1 from public.certificates where registration_id=p_registration_id) then
      select coalesce(max(serial),0)+1 into v_serial
        from public.certificates where event_id=v_event and is_test=coalesce(p_is_test,false);
      insert into public.certificates(event_id,registration_id,serial,verify_code,is_test,issued_via,override_reason,issued_by)
      values (
        v_event,p_registration_id,v_serial,
        upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),
        coalesce(p_is_test,false),
        case when p_via='manual' then 'manual' else 'auto' end,
        p_reason,p_actor
      );
    end if;
  end if;
  return query select * from public.certificates where registration_id=p_registration_id;
end; $$;

revoke all on function public.ensure_preseptor_certificate(uuid,boolean,text,text,text) from public;
revoke all on function public.ensure_preseptor_certificate(uuid,boolean,text,text,text) from anon;
revoke all on function public.ensure_preseptor_certificate(uuid,boolean,text,text,text) from authenticated;
grant execute on function public.ensure_preseptor_certificate(uuid,boolean,text,text,text) to service_role;

-- 3) Virtual background & materi ----------------------------------------------
create table if not exists public.event_assets (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  kind text not null check (kind in ('virtual_background','material')),
  title text not null,
  description text,
  storage_path text,
  link_url text,
  original_name text,
  mime_type text,
  file_size bigint not null default 0,
  audience text not null default 'all' check (audience in ('all','Online','Offline')),
  published boolean not null default true,
  position integer not null default 1 check (position > 0),
  download_count integer not null default 0,
  uploaded_by citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint event_assets_source_check check (storage_path is not null or link_url is not null)
);

create index if not exists event_assets_event_idx on public.event_assets(event_id,kind,position,created_at);

alter table public.event_assets enable row level security;

do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='event_assets' and policyname='admins read event assets'
  ) then
    create policy "admins read event assets" on public.event_assets
      for select to authenticated using (public.is_aptfi_admin());
  end if;
end $$;

-- Bucket privat. File diunduh lewat signed URL berumur pendek dari server.
insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'event-assets','event-assets',false,52428800,
  array[
    'image/jpeg','image/png','image/webp',
    'application/pdf',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/zip','application/x-zip-compressed',
    'video/mp4'
  ]
)
on conflict (id) do update set
  public=false,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;
