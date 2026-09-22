# Update v0.4.1 — Final WordPress Cutover

Update ini khusus untuk memindahkan pendaftar final Pelatihan Preseptor dari WordPress ke Supabase setelah form WordPress dihentikan.

## Ringkasan perubahan

- Importer final berbasis manifest JSON + ZIP bukti pembayaran lokal.
- Import bersifat idempotent berdasarkan `registration_code`.
- Mempertahankan nomor pendaftaran, tanggal daftar, mode, homebase, wahana, status pembayaran, dan file bukti pembayaran.
- Pembayaran legacy berstatus `Terverifikasi` langsung menjadi `verified` dan bukti pembayaran menjadi `valid`.
- Persyaratan baru (Nomor STRA, STRA, bukti pengalaman, lama praktik/mengajar) tetap `incomplete` sampai dilengkapi peserta.
- Proteksi khusus untuk email legacy yang dipakai lebih dari satu peserta.
- Pengumuman tidak dikirim ke alamat sintetis yang masih menunggu koreksi email.
- Invoice/kwitansi dan export Excel menampilkan email kontak legacy yang benar pada record yang masih membutuhkan koreksi.
- Script undangan aktivasi akun peserta legacy setelah migrasi.
- Script koreksi email untuk record legacy yang emailnya bentrok.

## File baru / berubah

- `supabase/migrations/007_legacy_cutover_support.sql`
- `scripts/import-wordpress-final.mjs`
- `scripts/invite-legacy-users.mjs`
- `scripts/fix-legacy-email.mjs`
- `lib/billing-pdf.js`
- `app/api/admin/announcements/route.js`
- `app/api/admin/export/route.js`
- `components/AdminDashboard.js`
- `app/globals.css`
- `package.json`

## Dependency baru

`adm-zip` digunakan hanya oleh importer final untuk membaca ZIP bukti pembayaran.

Jalankan:

```bash
npm install
```

## Migration Supabase

Jalankan **hanya**:

```text
supabase/migrations/007_legacy_cutover_support.sql
```

Jangan jalankan ulang migration 001–006.

## Cara import final

Letakkan file berikut di lokasi yang mudah diakses:

- `preseptor-wordpress-final-20260922.json`
- `Bukti-Pembayaran-Preseptor-APTFI.zip`

### 1. Dry run

```bash
npm run import:legacy -- --manifest "C:\\path\\preseptor-wordpress-final-20260922.json" --proofs "C:\\path\\Bukti-Pembayaran-Preseptor-APTFI.zip"
```

Expected final dataset:

- 18 pendaftar
- 16 Online
- 2 Offline
- 16 pembayaran terverifikasi
- 2 pembayaran pending
- 18/18 bukti pembayaran ditemukan
- 1 grup email legacy duplikat

### 2. Commit

Jika database Supabase masih berisi data dummy hasil testing, gunakan `--purge-app-test`.

```bash
npm run import:legacy -- --manifest "C:\\path\\preseptor-wordpress-final-20260922.json" --proofs "C:\\path\\Bukti-Pembayaran-Preseptor-APTFI.zip" --purge-app-test --commit
```

Jika tidak ada data dummy, hilangkan `--purge-app-test`.

Importer membuat file `migration-report-<timestamp>.json` di root project.

## Kasus email ganda

Data final WordPress memiliki satu alamat email yang dipakai oleh dua peserta berbeda. Sistem tidak akan menggabungkan kedua peserta.

- Pendaftar pertama mempertahankan email tersebut.
- Pendaftar kedua diberi email internal `@migration.invalid` dan ditandai `Email perlu diperbarui` di admin.
- Akun peserta kedua tidak diundang sebelum email unik ditetapkan.

Untuk memperbaiki:

```bash
npm run fix:legacy-email -- --code APT-PRS-XXXXXXXX-XXXXXX --email emailunik@domain.com
```

Setelah itu record tersebut dapat menerima email aktivasi.

## Undangan aktivasi peserta legacy

Pastikan `NEXT_PUBLIC_SITE_URL` sudah menunjuk URL yang benar. Untuk production sebaiknya **jangan** menggunakan localhost.

Dry run:

```bash
npm run invite:legacy
```

Kirim:

```bash
npm run invite:legacy -- --commit
```

Script otomatis melewati record `email_needs_update=true`.

## Catatan tanggal verifikasi pembayaran legacy

Excel lama tidak menyimpan timestamp verifikasi pembayaran secara terpisah. Untuk pembayaran yang sudah berstatus terverifikasi, importer menggunakan **waktu sinkron terakhir** sebagai waktu saat status terverifikasi tersebut diketahui pada data final. Informasi asli tetap disimpan di `legacy_metadata`.

## Checklist sesudah import

- [ ] Total pendaftar 18 legacy + 0 data dummy
- [ ] Online 16, Offline 2
- [ ] Pembayaran verified 16, pending 2
- [ ] 18 bukti pembayaran bisa dibuka dari popup admin
- [ ] 16 peserta verified bisa membuka kwitansi
- [ ] Seluruh peserta memiliki invoice
- [ ] Persyaratan peserta legacy berstatus belum lengkap
- [ ] 1 peserta ditandai `Email perlu diperbarui`
- [ ] Counter kuota menyisakan Online 134 dan Offline 48 (sebelum ada pendaftar baru di webapp)
- [ ] Setelah email unik diperbaiki, kirim aktivasi peserta legacy

## Rollback

Jangan menghapus database WordPress selama validasi cutover. Jika perlu rollback sebelum peserta mulai menggunakan sistem baru, hapus hanya record dengan `legacy_source='wordpress-v1.0.9-final-cutover'` beserta object storage yang terkait, lalu aktifkan kembali sistem lama.
