# APTFI Preseptor v0.5.0 — Day-H Core

Baseline wajib: **v0.4.21**.

Versi ini adalah tahap pertama operasional Hari-H. Fitur Pretest, Evaluasi, Posttest, Virtual Background, dan Sertifikat belum masuk versi ini dan akan dilanjutkan bertahap setelah core attendance stabil.

## Fitur baru

### Command Center Hari-H (Super Admin saja)
- Hari 1: 7 Oktober 2026
- Hari 2: 8 Oktober 2026
- default window presensi kedua hari: **07.00–09.00 WIB**
- waktu dapat dioverride Super Admin
- aktivasi/nonaktif modul Hari-H
- statistik peserta eligible/hadir/belum hadir
- breakdown Online dan Offline
- aktivitas presensi terbaru
- pencarian peserta
- manual check-in dengan alasan
- pembatalan check-in dengan audit log
- export attendance Excel

### Peserta Online
- menu baru **Kehadiran**
- self check-in per hari
- hanya dapat check-in pada window yang dibuka panitia
- tidak ada checkout

### Peserta Offline
- QR presensi per hari tersedia di menu Kehadiran
- QR dipindai oleh Super Admin/panitia menggunakan kamera/QR scanner perangkat
- QR membuka halaman validasi `/admin/checkin`
- tidak ada checkout

### Participant sidebar
Dashboard peserta sekarang memakai sidebar collapsible pada desktop dan menu horizontal compact pada mobile.

### Akun Uji / Dummy
Super Admin dapat membuat akun peserta TEST:
- mode Online atau Offline
- role/login peserta biasa
- tidak memakai kuota
- tidak masuk statistik resmi
- tidak masuk export attendance resmi
- dapat bypass window waktu Hari-H untuk testing
- tetap harus melakukan check-in agar flow bisnis dapat diuji
- tidak menampilkan dokumen keuangan resmi

Akun test dibuat dari:
`Admin -> Data & Sistem -> Akun Uji`

## Migration SQL
Jalankan **hanya**:

`supabase/migrations/017_day_h_core.sql`

Migration:
- menambah `events.day_h_enabled`
- menambah `registrations.is_test_account`
- mengizinkan lifecycle `test`
- membuat `event_days`
- membuat `attendance_records`
- seed Hari 1 dan Hari 2 dengan default 07.00–09.00 WIB
- menjaga akun test tetap tidak menggunakan capacity guard

## Dependency
Tidak ada dependency baru.
`write-excel-file` yang sudah ada digunakan melalui entry browser v4.

## Urutan instalasi
1. Pastikan project saat ini v0.4.21.
2. Stop `npm run dev`.
3. Extract patch ke root project dan Replace/Yes to All.
4. Jalankan migration `017_day_h_core.sql` di Supabase SQL Editor.
5. Jalankan `npm run dev`.

## Checklist test — WAJIB sebelum production

### A. Akun uji Online
1. Login Super Admin.
2. Buka `Data & Sistem -> Akun Uji`.
3. Buat akun TEST mode Online menggunakan email yang dapat menerima reset password.
4. Login peserta dengan flow Lupa Password.
5. Buka menu Kehadiran.
6. Walaupun bukan tanggal 7/8 Oktober, tombol Check-in harus dapat digunakan karena TEST bypass waktu.
7. Check-in Hari 1 dan Hari 2.
8. Command Center harus menunjukkan akun tersebut sebagai TEST, tetapi statistik resmi tidak bertambah.

### B. Akun uji Offline
1. Buat TEST mode Offline.
2. Login sebagai peserta TEST.
3. Menu Kehadiran menampilkan QR untuk Hari 1/Hari 2.
4. Scan QR dengan perangkat yang sudah login sebagai Super Admin.
5. Konfirmasi Check-in.
6. Peserta harus berubah menjadi Hadir pada hari terkait.

### C. Peserta resmi
- Sebelum Hari-H diaktifkan, peserta resmi tidak bisa self check-in.
- Setelah Hari-H aktif, check-in resmi hanya bisa pada window yang ditentukan.
- peserta withdrawn/rejected tidak eligible.
- akun test tidak mengubah kuota Online/Offline.

### D. Export
- Export attendance tidak menyertakan akun TEST.

## Production
Setelah local test:

```powershell
npm run build
npm run audit:prod
```

Jika sukses:

```powershell
git add .
git commit -m "Add Day-H attendance core v0.5.0"
git push origin main
```

## Catatan penting
- `day_h_enabled` default **false** setelah migration.
- Jangan aktifkan untuk peserta resmi sebelum testing akun TEST selesai.
- Pretest/Posttest/Evaluasi belum ada pada v0.5.0 ini.
