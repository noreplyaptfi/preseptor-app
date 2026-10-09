-- APTFI Preseptor v0.8.5 — Peserta SKP & NIK
--   * registrations.skp_eligible: penanda peserta yang diusulkan SKP (diatur admin)
--   * tabel registration_nik: NIK peserta, terpisah dari tabel registrations,
--     hanya bisa dibaca server (RLS aktif tanpa policy)
--   * audience pengumuman baru: 'skp' dan 'skp_nik_missing'
--   * menandai 200 peserta SKP dari sheet "SKP (200)" (hanya pada run pertama)
-- Aman dijalankan ulang (idempoten). Tidak mengubah data presensi, assessment, atau sertifikat.

-- 1) Penanda peserta SKP ----------------------------------------------------------
alter table public.registrations
  add column if not exists skp_eligible boolean not null default false;
alter table public.registrations
  add column if not exists skp_marked_at timestamptz;
alter table public.registrations
  add column if not exists skp_marked_by text;

create index if not exists registrations_skp_idx
  on public.registrations (event_id) where skp_eligible;

-- 2) NIK peserta (satu baris per pendaftaran) ------------------------------------
create table if not exists public.registration_nik (
  registration_id uuid primary key references public.registrations(id) on delete cascade,
  event_id uuid not null references public.events(id) on delete cascade,
  nik text not null check (nik ~ '^[0-9]{16}$'),
  consent_at timestamptz,
  source text not null default 'participant' check (source in ('participant','admin')),
  updated_by citext,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists registration_nik_event_nik_idx
  on public.registration_nik (event_id, nik);

-- Hanya server (service role) yang boleh membaca/menulis NIK.
alter table public.registration_nik enable row level security;
revoke all on table public.registration_nik from anon;
revoke all on table public.registration_nik from authenticated;

-- 3) Audience pengumuman: tambah 'skp' dan 'skp_nik_missing' ------------------------
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'announcements' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%audience%'
  loop
    execute format('alter table public.announcements drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.announcements
  add constraint announcements_audience_check
  check (audience in ('all','online','offline','verified','skp','skp_nik_missing'));

-- 4) Tandai 200 peserta SKP (sheet "SKP (200)", dicocokkan via Nomor Pendaftaran) ----
-- Hanya dijalankan bila belum pernah ada peserta yang ditandai SKP, sehingga
-- perubahan admin sesudahnya tidak tertimpa saat migration dijalankan ulang.
drop table if exists pg_temp.skp_import_023;
create temp table skp_import_023 (code text primary key);
insert into skp_import_023 (code) values
  ('APT-PRS-20260918-J5HLVY'), ('APT-PRS-20260926-01062'), ('APT-PRS-20260924-01018'), ('APT-PRS-20260918-PEXA4W'),
  ('APT-PRS-20260918-D0A8LA'), ('APT-PRS-20261001-01113'), ('APT-PRS-20260922-TSEQYX'), ('APT-PRS-20260928-01066'),
  ('APT-PRS-20260930-01110'), ('APT-PRS-20260930-01079'), ('APT-PRS-20260930-01083'), ('APT-PRS-20260930-01084'),
  ('APT-PRS-20260930-01085'), ('APT-PRS-20260930-01087'), ('APT-PRS-20260930-01088'), ('APT-PRS-20260930-01089'),
  ('APT-PRS-20260930-01090'), ('APT-PRS-20260930-01091'), ('APT-PRS-20260930-01093'), ('APT-PRS-20260930-01095'),
  ('APT-PRS-20260930-01096'), ('APT-PRS-20260930-01098'), ('APT-PRS-20260930-01100'), ('APT-PRS-20260930-01102'),
  ('APT-PRS-20260930-01103'), ('APT-PRS-20260930-01107'), ('APT-PRS-20261001-01115'), ('APT-PRS-20261003-5J2BSB'),
  ('APT-PRS-20261004-GH45MM'), ('APT-PRS-20261004-7DJ9XJ'), ('APT-PRS-20260920-4D2Y2J'), ('APT-PRS-20260914-AKNPOQ'),
  ('APT-PRS-20260925-01028'), ('APT-PRS-20260923-01008'), ('APT-PRS-20260926-01060'), ('APT-PRS-20260929-01077'),
  ('APT-PRS-20260926-01061'), ('APT-PRS-20261004-TAVDDN'), ('APT-PRS-20261004-3PDQG3'), ('APT-PRS-20261004-PNCCGM'),
  ('APT-PRS-20261004-JYLKRP'), ('APT-PRS-20260924-01014'), ('APT-PRS-20260925-01025'), ('APT-PRS-20260925-01026'),
  ('APT-PRS-20260928-01064'), ('APT-PRS-20260928-01065'), ('APT-PRS-20260924-01017'), ('APT-PRS-20260918-8CJ5BX'),
  ('APT-PRS-20260922-YPJ6M3'), ('APT-PRS-20261003-2T8H35'), ('APT-PRS-20261003-23CFJD'), ('APT-PRS-20261004-R9CBTP'),
  ('APT-PRS-20260924-01020'), ('APT-PRS-20260925-01042'), ('APT-PRS-20260925-01047'), ('APT-PRS-20260925-01049'),
  ('APT-PRS-20260925-01023'), ('APT-PRS-20260927-01063'), ('APT-PRS-20260929-01074'), ('APT-PRS-20261004-MSRZML'),
  ('APT-PRS-20261004-MRR8JY'), ('APT-PRS-20260929-01073'), ('APT-PRS-20260929-01076'), ('APT-PRS-20261001-01122'),
  ('APT-PRS-20261001-01114'), ('APT-PRS-20260928-01067'), ('APT-PRS-20261001-01117'), ('APT-PRS-20260930-01104'),
  ('APT-PRS-20261001-01119'), ('APT-PRS-20261001-01120'), ('APT-PRS-20261001-01121'), ('APT-PRS-20260924-01010'),
  ('APT-PRS-20260929-01075'), ('APT-PRS-20260924-01013'), ('APT-PRS-20260924-01012'), ('APT-PRS-20260929-01072'),
  ('APT-PRS-20260930-01081'), ('APT-PRS-20260930-01092'), ('APT-PRS-20260930-01099'), ('APT-PRS-20260930-01108'),
  ('APT-PRS-20260930-01109'), ('APT-PRS-20261001-01112'), ('APT-PRS-20260926-01057'), ('APT-PRS-20260929-01068'),
  ('APT-PRS-20260929-01069'), ('APT-PRS-20260929-01070'), ('APT-PRS-20260929-01071'), ('APT-PRS-20260930-01078'),
  ('APT-PRS-20260930-01080'), ('APT-PRS-20260930-01082'), ('APT-PRS-20260930-01086'), ('APT-PRS-20260930-01094'),
  ('APT-PRS-20260930-01097'), ('APT-PRS-20260923-01006'), ('APT-PRS-20260925-01024'), ('APT-PRS-20260918-3RZONK'),
  ('APT-PRS-20261004-G39JQB'), ('APT-PRS-20260924-01021'), ('APT-PRS-20260926-01058'), ('APT-PRS-20260926-01059'),
  ('APT-PRS-20261001-01118'), ('APT-PRS-20260923-01004'), ('APT-PRS-20260924-01009'), ('APT-PRS-20260922-5ZAXB2'),
  ('APT-PRS-20260923-01005'), ('APT-PRS-20260923-01007'), ('APT-PRS-20261003-8B5MP4'), ('APT-PRS-20261003-P4UT2D'),
  ('APT-PRS-20261003-7GN2W5'), ('APT-PRS-20261003-9ZRQ5S'), ('APT-PRS-20261003-YATE52'), ('APT-PRS-20261003-EGPN7W'),
  ('APT-PRS-20261003-RYNEED'), ('APT-PRS-20261004-HR6ZMW'), ('APT-PRS-20260925-01031'), ('APT-PRS-20260919-WFVAG7'),
  ('APT-PRS-20260919-0PLVGF'), ('APT-PRS-20260920-BXC1HZ'), ('APT-PRS-20260930-01105'), ('APT-PRS-20261004-63H7XH'),
  ('APT-PRS-20261004-GN24L6'), ('APT-PRS-20261004-4P5XVK'), ('APT-PRS-20260924-01011'), ('APT-PRS-20261006-X9BT2R'),
  ('APT-PRS-20261006-6NB8HL'), ('APT-PRS-20260918-JWAN65'), ('APT-PRS-20261001-01138'), ('APT-PRS-20260925-01027'),
  ('APT-PRS-20261001-01123'), ('APT-PRS-20260930-01106'), ('APT-PRS-20260925-01029'), ('APT-PRS-20260925-01030'),
  ('APT-PRS-20260925-01032'), ('APT-PRS-20260925-01033'), ('APT-PRS-20260925-01034'), ('APT-PRS-20260925-01035'),
  ('APT-PRS-20260925-01036'), ('APT-PRS-20260925-01037'), ('APT-PRS-20260925-01040'), ('APT-PRS-20260925-01043'),
  ('APT-PRS-20260925-01044'), ('APT-PRS-20260925-01045'), ('APT-PRS-20260925-01046'), ('APT-PRS-20260925-01048'),
  ('APT-PRS-20260925-01050'), ('APT-PRS-20260925-01051'), ('APT-PRS-20260925-01052'), ('APT-PRS-20260925-01053'),
  ('APT-PRS-20260925-01054'), ('APT-PRS-20260925-01055'), ('APT-PRS-20260925-01056'), ('APT-PRS-20260925-01038'),
  ('APT-PRS-20260925-01039'), ('APT-PRS-20261001-01111'), ('APT-PRS-20260924-01016'), ('APT-PRS-20261001-01124'),
  ('APT-PRS-20261001-01125'), ('APT-PRS-20261001-01126'), ('APT-PRS-20261001-01127'), ('APT-PRS-20261001-01128'),
  ('APT-PRS-20261001-01129'), ('APT-PRS-20261001-01130'), ('APT-PRS-20261001-01131'), ('APT-PRS-20261001-01132'),
  ('APT-PRS-20261001-01133'), ('APT-PRS-20261001-01134'), ('APT-PRS-20261001-01135'), ('APT-PRS-20261001-01136'),
  ('APT-PRS-20261001-01137'), ('APT-PRS-20260924-01019'), ('APT-PRS-20260924-01015'), ('APT-PRS-20261001-01116'),
  ('APT-PRS-20260924-01022'), ('APT-PRS-20260922-9FWAA5'), ('APT-PRS-20261007-JXXZX7'), ('APT-PRS-20261007-M9CV36'),
  ('APT-PRS-20261003-YPC5W9'), ('APT-PRS-20261004-RQKDBT'), ('APT-PRS-20261004-8M749Z'), ('APT-PRS-20261004-FZDQSE'),
  ('APT-PRS-20261004-YYNJ6T'), ('APT-PRS-20261004-QYYBVF'), ('APT-PRS-20261007-L4TR8S'), ('APT-PRS-20261007-SXWHH5'),
  ('APT-PRS-20260910-OJJ2OA'), ('APT-PRS-20260910-T8RPFA'), ('APT-PRS-20261001-01140'), ('APT-PRS-20261001-01141'),
  ('APT-PRS-20261001-01143'), ('APT-PRS-20261001-01144'), ('APT-PRS-20261001-01145'), ('APT-PRS-20261001-01146'),
  ('APT-PRS-20261001-01147'), ('APT-PRS-20261001-01151'), ('APT-PRS-20261001-01159'), ('APT-PRS-20261004-A5D7ER'),
  ('APT-PRS-20261004-UHXKSQ'), ('APT-PRS-20261006-2LJPGP'), ('APT-PRS-20261006-F9FA9E'), ('APT-PRS-20261006-W5FR64');

do $$
declare v_count integer;
begin
  if exists (select 1 from public.registrations where skp_marked_at is not null) then
    raise notice 'Daftar SKP sudah pernah diisi sebelumnya; penandaan otomatis dilewati.';
    return;
  end if;
  update public.registrations r
     set skp_eligible = true,
         skp_marked_at = now(),
         skp_marked_by = 'import: SKP (200) — 9 Okt 2026'
    from skp_import_023 s
   where r.registration_code = s.code;
  get diagnostics v_count = row_count;
  raise notice 'Peserta ditandai SKP: %', v_count;
end $$;

-- 5) Ringkasan (hasil yang tampil di SQL Editor) -----------------------------------
-- Harapan: kode_di_daftar = 200, cocok_di_database = 200, tidak_ditemukan kosong.
select
  (select count(*) from skp_import_023) as kode_di_daftar,
  (select count(*) from public.registrations r join skp_import_023 s on s.code = r.registration_code) as cocok_di_database,
  (select count(*) from public.registrations where skp_eligible) as total_peserta_skp,
  (select string_agg(s.code, ', ' order by s.code) from skp_import_023 s
     where not exists (select 1 from public.registrations r where r.registration_code = s.code)) as tidak_ditemukan;
