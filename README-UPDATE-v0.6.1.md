# APTFI Preseptor — Update v0.6.0 → v0.6.1

## Hotfix Scan QR Presensi Offline (persiapan Hari 1)

Baseline wajib: **v0.6.0**.

Tidak ada migration SQL dan tidak ada dependency baru.

### Perubahan

1. **Scan QR presensi Offline untuk semua akun panitia**
   - Semua akun panitia aktif dapat memindai QR dan mengonfirmasi check-in peserta Offline: `super_admin`, `event_admin`, `document_verifier`, `payment_verifier`, dan `viewer`.
   - Menu **Pelaksanaan → Scan QR** sekarang tampil untuk semua akun panitia.
   - Tetap **khusus Super Admin**: Command Center Hari-H, check-in manual, pembatalan check-in, Pretest, dan Akun Uji.
   - Audit log mencatat email dan role panitia yang melakukan check-in.

2. **QR tidak hilang saat panitia harus login dulu**
   - Jika HP panitia belum login atau sesinya sudah habis, halaman login membawa token QR.
   - Setelah login, panitia langsung kembali ke data peserta yang sama tanpa scan ulang.
   - Jika HP sedang login sebagai akun peserta, muncul tombol **Masuk dengan akun panitia**.

3. **Halaman scan lebih jelas**
   - Pesan error dari scan sebelumnya dibersihkan setiap kali QR baru diperiksa.
   - Jika peserta tidak bisa di-check-in, alasannya ditampilkan:
     - bukan peserta Offline;
     - persyaratan/pembayaran belum lengkap;
     - Hari-H belum diaktifkan;
     - di luar jam presensi.
   - Peserta yang sudah hadir menampilkan waktu presensi, cara presensi (Scan QR / Manual / Mandiri), dan email panitia yang mencatat.
   - Kolom input manual menerima token maupun URL QR lengkap.

4. **Scan bersamaan oleh dua panitia**
   - Jika QR yang sama dipindai dua panitia hampir bersamaan, panitia kedua mendapat pesan **sudah tercatat**, bukan error "Gagal menyimpan presensi".

### File yang berubah

```text
app/api/admin/checkin/route.js
components/CheckinPage.js
components/AdminDashboard.js
```

## Instalasi

1. Pastikan lokal sudah v0.6.0.
2. Stop `npm run dev`.
3. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
4. Tidak ada migration SQL.
5. Tidak perlu `npm install`.
6. Jalankan:

```powershell
npm run dev
```

## Test checklist

Gunakan akun TEST mode Offline yang sudah ada dan sudah login di satu perangkat. Di perangkat lain, login sebagai panitia **non-Super Admin**, misalnya `document_verifier` atau `event_admin`.

### A. Scan oleh panitia non-Super Admin
1. Peserta TEST membuka menu **Kehadiran**, QR Hari 1 tampil.
2. Panitia non-Super Admin memindai QR.
3. Halaman **Validasi QR Presensi** menampilkan **Siap check-in**.
4. Klik **Konfirmasi Check-in** → **Ya, Check-in**.
5. Muncul **Presensi berhasil dicatat**, status berubah menjadi **Sudah hadir** dan menampilkan email panitia.
6. Di dashboard panitia non-Super Admin, menu **Pelaksanaan → Scan QR** terlihat. Menu **Hari-H**, **Pretest**, dan **Akun Uji** tetap tidak terlihat.

### B. Sesi habis
1. Logout akun panitia di perangkat scanner.
2. Buka URL QR peserta. Halaman login panitia akan terbuka.
3. Login, lalu pastikan langsung kembali ke data peserta yang sama.

### C. Scan ulang
1. Scan QR peserta yang sudah hadir.
2. Status harus **Sudah hadir**, tanpa tombol check-in, dan tanpa error.

### D. Peserta resmi di luar jam
1. Periksa QR peserta resmi di luar jam presensi.
2. Harus tampil alasan **Di luar jam presensi** dan tombol check-in tidak muncul.

## Push ke production (production masih v0.4.21)

Update v0.5.0 sampai v0.6.1 belum ada di production, jadi semuanya akan ikut dalam push ini.

### 1. Pastikan migration 017 dan 018 ada di database production

Jalankan query berikut di Supabase SQL Editor **project production**:

```sql
select
  to_regclass('public.event_days')         as migration_017,
  to_regclass('public.assessment_modules') as migration_018;
```

- Kedua kolom terisi → migration sudah ada. **Jangan jalankan ulang.**
- Ada yang `null` → jalankan migration yang belum ada, berurutan: `017_day_h_core.sql` lalu `018_pretest_core.sql`.

Jika `.env.local` lokal memakai project Supabase yang sama dengan production, kedua migration ini sudah terpasang saat test lokal.

### 2. Build dan push

```powershell
npm run build
npm run audit:prod
git add .
git commit -m "Add Day-H attendance, test accounts, pretest and QR check-in fixes v0.6.1"
git push origin main
```

### 3. Setelah Vercel selesai deploy

1. Login Super Admin di `https://preseptor.aptfi.or.id/admin/login`.
2. Buka **Pelaksanaan → Hari-H**. Pastikan jadwal Hari 1 tertulis 7 Oktober 2026, 07.00–09.00 WIB. Ubah di sini jika perlu.
3. Uji sekali dengan akun TEST Online dan Offline di production.
4. Aktifkan Hari-H untuk peserta resmi setelah uji selesai. Default-nya **nonaktif**.

### 4. Persiapan HP panitia scanner
- Login sekali di `/admin/login` memakai **browser bawaan HP**, yaitu browser yang terbuka saat kamera membaca QR (Chrome di Android, Safari di iPhone).
- Jangan login dari browser dalam aplikasi seperti WhatsApp, karena sesi login tidak terbawa ke browser yang dibuka kamera.
- Jika antrean melewati jam tutup (09.00), Super Admin dapat memperpanjang jam tutup di Command Center atau melakukan check-in manual.

## Migration

- SQL migration: **TIDAK**
- npm install: **TIDAK**
