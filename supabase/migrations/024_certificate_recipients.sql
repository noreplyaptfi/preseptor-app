-- APTFI Preseptor v0.8.6 — Sertifikat pemateri & moderator, penomoran bersama mulai 339
--   * tabel certificate_recipients: penerima sertifikat non-peserta (pemateri, moderator)
--   * certificates.recipient_id: sertifikat bisa milik peserta ATAU pemateri/moderator
--   * satu urutan nomor untuk semua (pemateri → moderator → peserta) lewat assign_certificate_numbers
--   * format nomor {NNN}/X/SERTIF/APTFI/2026 dengan nomor awal 339 (hanya bila belum pernah diatur)
--   * mengisi 6 pemateri + 4 moderator (hanya bila daftar masih kosong)
-- Aman dijalankan ulang (idempoten). Tidak mengubah data peserta, presensi, atau assessment.

-- 1) Penerima sertifikat non-peserta ---------------------------------------------
create table if not exists public.certificate_recipients (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events(id) on delete cascade,
  role text not null check (role in ('speaker','moderator')),
  name text not null check (length(trim(name)) >= 3),
  language text not null default 'id' check (language in ('id','en')),
  topic text,
  attendance_mode text check (attendance_mode in ('Online','Offline')),
  position integer not null default 1 check (position > 0),
  created_by citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists certificate_recipients_event_idx
  on public.certificate_recipients (event_id, role, position);

alter table public.certificate_recipients enable row level security;
do $$ begin
  if not exists (
    select 1 from pg_policies where schemaname='public' and tablename='certificate_recipients' and policyname='admins read certificate recipients'
  ) then
    create policy "admins read certificate recipients" on public.certificate_recipients
      for select to authenticated using (public.is_aptfi_admin());
  end if;
end $$;

-- 2) Sertifikat milik peserta ATAU penerima non-peserta -----------------------------
alter table public.certificates alter column registration_id drop not null;
alter table public.certificates
  add column if not exists recipient_id uuid references public.certificate_recipients(id) on delete cascade;
create unique index if not exists certificates_recipient_unique
  on public.certificates (recipient_id) where recipient_id is not null;
alter table public.certificates drop constraint if exists certificates_owner_check;
alter table public.certificates
  add constraint certificates_owner_check
  check ((registration_id is not null) <> (recipient_id is not null));

-- 3) Nomor sertifikat pemateri/moderator (urutan nomor sama dengan peserta resmi) ----
create or replace function public.ensure_recipient_certificate(
  p_recipient_id uuid,
  p_actor text default null
) returns setof public.certificates
language plpgsql security definer set search_path=public as $$
declare v_event uuid; v_serial integer;
begin
  select event_id into v_event from public.certificate_recipients where id=p_recipient_id;
  if v_event is null then
    raise exception 'recipient_not_found' using errcode='P0002';
  end if;
  if not exists (select 1 from public.certificates where recipient_id=p_recipient_id) then
    perform pg_advisory_xact_lock(hashtext('preseptor-certificate:'||v_event::text||':false'));
    if not exists (select 1 from public.certificates where recipient_id=p_recipient_id) then
      select coalesce(max(serial),0)+1 into v_serial
        from public.certificates where event_id=v_event and is_test=false;
      insert into public.certificates(event_id,recipient_id,serial,verify_code,is_test,issued_via,issued_by)
      values (v_event,p_recipient_id,v_serial,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),false,'auto',p_actor);
    end if;
  end if;
  return query select * from public.certificates where recipient_id=p_recipient_id;
end; $$;

revoke all on function public.ensure_recipient_certificate(uuid,text) from public;
revoke all on function public.ensure_recipient_certificate(uuid,text) from anon;
revoke all on function public.ensure_recipient_certificate(uuid,text) from authenticated;
grant execute on function public.ensure_recipient_certificate(uuid,text) to service_role;

-- 4) Siapkan nomor sekaligus, berurutan sesuai daftar yang dikirim aplikasi --------
--    p_recipient_ids    : pemateri lalu moderator (urutan tampil)
--    p_registration_ids : peserta resmi (urut abjad nama)
--    p_renumber = true  : semua nomor resmi disusun ulang dari 1 (hanya sebelum rilis);
--                         sertifikat lain yang tidak ada di daftar diberi nomor sesudahnya.
--    p_renumber = false : hanya memberi nomor baru bagi yang belum punya (melanjutkan nomor terakhir).
--    Akun TEST tidak pernah ikut. Mengembalikan jumlah sertifikat yang dibuat/diubah nomornya.
create or replace function public.assign_certificate_numbers(
  p_event_id uuid,
  p_recipient_ids uuid[],
  p_registration_ids uuid[],
  p_renumber boolean default false,
  p_actor text default null
) returns integer
language plpgsql security definer set search_path=public as $$
declare v_next integer; v_id uuid; v_count integer := 0; v_cert uuid; r record;
begin
  perform pg_advisory_xact_lock(hashtext('preseptor-certificate:'||p_event_id::text||':false'));
  if p_renumber then
    update public.certificates set serial = serial + 1000000
     where event_id=p_event_id and is_test=false;
    v_next := 1;
  else
    select coalesce(max(serial),0)+1 into v_next
      from public.certificates where event_id=p_event_id and is_test=false;
  end if;

  foreach v_id in array coalesce(p_recipient_ids,'{}'::uuid[]) loop
    continue when not exists (select 1 from public.certificate_recipients where id=v_id and event_id=p_event_id);
    select id into v_cert from public.certificates where recipient_id=v_id;
    if v_cert is null then
      insert into public.certificates(event_id,recipient_id,serial,verify_code,is_test,issued_via,issued_by)
      values (p_event_id,v_id,v_next,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),false,'auto',p_actor);
      v_next := v_next+1; v_count := v_count+1;
    elsif p_renumber then
      update public.certificates set serial=v_next, updated_at=now() where id=v_cert;
      v_next := v_next+1; v_count := v_count+1;
    end if;
  end loop;

  foreach v_id in array coalesce(p_registration_ids,'{}'::uuid[]) loop
    continue when not exists (
      select 1 from public.registrations
       where id=v_id and event_id=p_event_id
         and coalesce(is_test_account,false)=false and coalesce(lifecycle_status,'active')<>'test'
    );
    select id into v_cert from public.certificates where registration_id=v_id and is_test=false;
    continue when v_cert is null and exists (select 1 from public.certificates where registration_id=v_id);
    if v_cert is null then
      insert into public.certificates(event_id,registration_id,serial,verify_code,is_test,issued_via,issued_by)
      values (p_event_id,v_id,v_next,upper(substr(replace(gen_random_uuid()::text,'-',''),1,12)),false,'auto',p_actor);
      v_next := v_next+1; v_count := v_count+1;
    elsif p_renumber then
      update public.certificates set serial=v_next, updated_at=now() where id=v_cert;
      v_next := v_next+1; v_count := v_count+1;
    end if;
  end loop;

  if p_renumber then
    for r in
      select id from public.certificates
       where event_id=p_event_id and is_test=false and serial > 1000000
       order by serial
    loop
      update public.certificates set serial=v_next, updated_at=now() where id=r.id;
      v_next := v_next+1; v_count := v_count+1;
    end loop;
  end if;

  return v_count;
end; $$;

revoke all on function public.assign_certificate_numbers(uuid,uuid[],uuid[],boolean,text) from public;
revoke all on function public.assign_certificate_numbers(uuid,uuid[],uuid[],boolean,text) from anon;
revoke all on function public.assign_certificate_numbers(uuid,uuid[],uuid[],boolean,text) from authenticated;
grant execute on function public.assign_certificate_numbers(uuid,uuid[],uuid[],boolean,text) to service_role;

-- 5) Format nomor 339/X/SERTIF/APTFI/2026 (hanya bila nomor awal belum pernah diatur) --
update public.events
   set certificate_config = coalesce(certificate_config,'{}'::jsonb)
     || jsonb_build_object('number_format','{NNN}/X/SERTIF/APTFI/2026','number_start','339')
 where not (coalesce(certificate_config,'{}'::jsonb) ? 'number_start');

-- 6) Pemateri & moderator (hanya bila daftar event masih kosong) ----------------------
insert into public.certificate_recipients (event_id, role, name, language, position)
select e.id, v.role, v.name, v.lang, v.pos
  from public.events e
  cross join (values
    ('speaker',   'Prof. Dr. apt. Yandi Syukri, M.Si',          'id', 1),
    ('speaker',   'Dr. apt. Iis Wahyuningsih, M.Si',            'id', 2),
    ('speaker',   'Prof. Dr. apt. Satibi, M.Si',                'id', 3),
    ('speaker',   'Dr. apt. Lusy Noviani, MM',                  'id', 4),
    ('speaker',   'Prof. Dr. apt. Umi Athiyah MS.',             'id', 5),
    ('speaker',   'Assoc. Prof. Surakit Nathisuwan',            'en', 6),
    ('moderator', 'Yelly Oktavia Sari S.Si, Apt, M.Si, Ph.D',   'id', 1),
    ('moderator', 'apt. Hannie Fitriani, M.Farm',               'id', 2),
    ('moderator', 'Dr. apt. Dewi Setyaningsih',                 'id', 3),
    ('moderator', 'Dr. apt. Valentina Yurina, M.Si',            'id', 4)
  ) as v(role, name, lang, pos)
 where e.slug = 'preseptor-2026'
   and not exists (select 1 from public.certificate_recipients r where r.event_id = e.id);

-- 7) Ringkasan ---------------------------------------------------------------------
select
  (select count(*) from public.certificate_recipients where role='speaker')   as pemateri,
  (select count(*) from public.certificate_recipients where role='moderator') as moderator,
  (select certificate_config->>'number_format' from public.events where slug='preseptor-2026') as format_nomor,
  (select certificate_config->>'number_start'  from public.events where slug='preseptor-2026') as nomor_awal,
  (select count(*) from public.certificates where is_test=false) as sertifikat_resmi_bernomor;
