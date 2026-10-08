-- v0.8.4 — Dokumentasi kegiatan (khusus tautan: Google Drive, Google Photos, YouTube, dll.).
-- Memakai tabel event_assets dengan kind = 'documentation' dan kolom baru group_label
-- untuk mengelompokkan tautan (mis. "Hari 1", "Hari 2", "Umum").
-- Aman dijalankan ulang (idempoten).

-- 1) Izinkan kind 'documentation' (ganti check constraint bawaan kolom kind).
do $$
declare c record;
begin
  for c in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public' and rel.relname = 'event_assets' and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%kind%virtual_background%'
  loop
    execute format('alter table public.event_assets drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.event_assets
  add constraint event_assets_kind_check
  check (kind in ('virtual_background','material','documentation'));

-- 2) Kelompok tautan (opsional).
alter table public.event_assets
  add column if not exists group_label text;

-- 3) Dokumentasi wajib berupa tautan (tidak menyimpan file di storage).
alter table public.event_assets drop constraint if exists event_assets_documentation_link_check;
alter table public.event_assets
  add constraint event_assets_documentation_link_check
  check (kind <> 'documentation' or (link_url is not null and storage_path is null));

create index if not exists event_assets_kind_group_idx
  on public.event_assets (event_id, kind, group_label, position);
