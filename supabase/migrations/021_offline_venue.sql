-- v0.8.1 — Info lokasi peserta Offline di menu Akses Acara.
-- QR presensi Offline tidak lagi ditampilkan di Akses Acara; QR hanya ada di menu Kehadiran.
-- Kolom offline_qr_enabled / offline_qr_release_at tetap dipakai sebagai saklar
-- "Publikasikan info lokasi" dan waktu mulai tampil.
-- Aman dijalankan ulang (idempoten).

alter table public.events
  add column if not exists offline_venue jsonb not null default '{}'::jsonb;

comment on column public.events.offline_venue is
  'Info lokasi Offline: name, address, room, maps_url, notes, contact_name, contact_phone';
