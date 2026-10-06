# APTFI Preseptor — Update v0.8.1

## Akses Acara Offline berisi info lokasi, QR presensi hanya di Kehadiran

Hotfix sebelum Hari-H agar peserta dan panitia di lokasi tidak bingung.

| Menu peserta | Online | Offline |
|---|---|---|
| **Akses Acara** = *ke mana saya hadir* | Link Zoom + QR Zoom (tidak berubah) | **Info lokasi**: nama tempat, alamat, peta, tombol Google Maps, ruangan, catatan, kontak panitia lokasi |
| **Kehadiran** = *presensi* | Tombol **Check-in Hari 1 / Hari 2** | **QR Hari 1 / QR Hari 2** (satu-satunya QR presensi) |

> ⚠️ **Jalankan migration `021_offline_venue.sql` SEBELUM push.**
> Migration ini hanya menambah satu kolom (`events.offline_venue`) dan aman dijalankan ulang.

Tidak ada dependency baru.

---

## Isi update

### Peserta Offline
- **Akses Acara** tidak lagi menampilkan QR. Isinya sekarang:
  - kartu lokasi: nama tempat, alamat, peta (Google Maps embed), ruangan, jam registrasi, kontak panitia lokasi, dan catatan;
  - tombol **Buka di Google Maps** dan **Hubungi via WhatsApp**;
  - kotak **Presensi di lokasi** dengan tombol **Buka Kehadiran**.
- **Kehadiran**:
  - Sebelum jam presensi, setiap hari menampilkan "QR Hari 1 muncul otomatis di sini pukul 07.00 WIB".
  - Halaman **diperbarui otomatis setiap 20 detik**: QR muncul tepat jam buka, dan status berubah menjadi **Hadir** tidak lama setelah dipindai panitia. Ada juga tombol **Perbarui**.
  - Setelah dipindai, QR hari itu hilang dan status menjadi **Hadir**.
- **Beranda**: kartu "Lokasi & presensi" dengan tombol **Buka Kehadiran** (utama) dan **Lihat lokasi**.

### Peserta Online
- Tombol check-in sekarang berlabel **Check-in Hari 1** / **Check-in Hari 2**, sesuai pengumuman.
- Sebelum jam buka, tombol menampilkan "Check-in Hari 1 dibuka pukul 07.00 WIB".
- Akses Acara menambahkan tombol **Presensi: buka menu Kehadiran** dan catatan bahwa QR Zoom bukan untuk presensi.
- Beranda: kartu "Zoom & presensi".

### Admin — Pelaksanaan → Akses Acara
- Kartu Offline berganti menjadi **Peserta Offline · Info lokasi**, dengan field:
  - Nama tempat
  - Alamat lengkap
  - Ruangan / lantai
  - Link Google Maps
  - Catatan untuk peserta
  - Kontak panitia lokasi
  - No. WhatsApp kontak
- Saklar **Publikasikan info lokasi** dan **Mulai tampil** memakai saklar lama (dulu "Publikasikan QR check-in").
- Validasi:
  - info lokasi tidak bisa dipublikasikan tanpa nama tempat atau alamat;
  - link Maps wajib `https`;
  - akses Zoom tidak bisa dipublikasikan tanpa link Zoom.
- Peta dibuat otomatis dari nama tempat dan alamat. Link Google Maps dipakai untuk tombol **Buka di Google Maps**; bila kosong, tombol mencari nama tempat dan alamat.
- Statistik "Sudah check-in" (memakai data lama yang tidak lagi terisi) diganti status **Info lokasi Offline: Tampil/Belum**. Pantau presensi di **Hari-H / Command Center**.

### Lain-lain
- Panduan peserta dan Panduan Admin diperbarui: QR presensi Offline hanya di Kehadiran. Ditambahkan kendala umum "Peserta Offline tidak menemukan QR".
- Content-Security-Policy mengizinkan iframe `https://www.google.com` dan `https://maps.google.com`, khusus untuk peta.
- Halaman Scan QR panitia **tidak berubah**. QR dari menu Kehadiran langsung tercatat untuk hari yang sesuai.

## File

Diubah:
- `app/api/admin/event-access/route.js`
- `app/api/me/event-access/route.js`
- `app/globals.css`
- `components/AdminDashboard.js`
- `components/AdminGuide.js`
- `components/NavIcon.js`
- `components/ParticipantDashboard.js`
- `components/ParticipantGuide.js`
- `lib/event-access.js`
- `next.config.mjs`

Baru:
- `supabase/migrations/021_offline_venue.sql`
- `README-UPDATE-v0.8.1.md`

## Pilih ZIP sesuai kondisi lokal

| Kondisi lokal Anda | ZIP | Migration |
|---|---|---|
| **Belum** memasang v0.8.0 (masih v0.7.3) | `…-v0.7.3-to-v0.8.1.zip` (gabungan v0.8.0 + v0.8.1) | 020 **lalu** 021 |
| **Sudah** memasang v0.8.0 di lokal (belum push) | `…-v0.8.0-to-v0.8.1.zip` | 021 (020 sudah) |

## Cara pasang

1. Stop `npm run dev`.
2. Extract ZIP yang sesuai ke root project, lalu pilih **Replace / Yes to All**.
3. Jalankan migration di Supabase SQL Editor, berurutan:

```text
supabase/migrations/020_certificates_assets.sql   (hanya jika belum)
supabase/migrations/021_offline_venue.sql
```

4. Tidak perlu `npm install`.
5. Jalankan `npm run dev`.

## Test checklist singkat

1. Admin → **Akses Acara** → isi Nama tempat dan Alamat → centang **Publikasikan info lokasi** → kosongkan Mulai tampil → **Simpan**.
2. Login akun TEST **Offline** → **Akses Acara**: kartu lokasi tampil, **tanpa QR**. Tombol **Buka Kehadiran** berfungsi.
3. Menu **Kehadiran** (akun TEST melewati jam): QR Hari 1 tampil. Pindai lewat halaman **Scan QR** panitia → dalam ≤ 20 detik status peserta berubah **Hadir** tanpa reload.
   - Di lokal, QR berisi alamat `localhost`. Pindai dengan halaman Scan QR yang dibuka di laptop (kamera laptop), bukan HP.
4. Login akun TEST **Online** → **Kehadiran**: tombol **Check-in Hari 1**. **Akses Acara**: link Zoom tampil.
5. Coba simpan dengan "Publikasikan info lokasi" dicentang tetapi nama dan alamat kosong → muncul pesan error.
6. Tampilan HP: Beranda peserta Offline menampilkan kartu "Lokasi & presensi".

## Push ke production

1. Jalankan migration yang belum di Supabase **production** (020 dan/atau 021). Lewati jika lokal dan production memakai project yang sama.
2. Pastikan `NEXT_PUBLIC_SITE_URL=https://preseptor.aptfi.or.id` di Vercel.
3. Perintah git (satu commit sudah mencakup v0.8.0 dan v0.8.1 bila keduanya belum di-commit):

```powershell
git status
npm run build
npm run audit:prod
git add .
git commit -m "Add certificates, assets, guides and offline venue info v0.8.1"
git push origin main
```

Jika v0.8.0 sudah Anda commit sendiri sebelumnya, cukup:

```powershell
git add .
git commit -m "Offline venue info in Akses Acara, QR only in Kehadiran v0.8.1"
git push origin main
```

## Setelah deploy (malam sebelum Hari 1)

Di **production**, Admin → **Akses Acara**:
- [ ] Isi info lokasi, centang **Publikasikan info lokasi**, lalu Simpan.
- [ ] Centang **Publikasikan akses Zoom**, pastikan link Zoom benar, lalu Simpan. **Wajib:** tanpa ini peserta Online tidak melihat link Zoom.
- [ ] **Hari-H / Command Center**: modul aktif, jam presensi Hari 1 dan 2 tetap 07.00–09.00 WIB.
- [ ] Uji sekali dengan akun TEST Offline dan Online di HP.

## Migration / Dependency

- SQL migration: **YA — 021** (dan 020 bila belum)
- npm install: **TIDAK**
