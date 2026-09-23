# APTFI Preseptor Web App — Update v0.4.2

Patch ini ditujukan untuk **v0.4.1 → v0.4.2**.

Fokus v0.4.2: performa production, penyederhanaan UI publik, Panduan Admin, Lato, dan production hardening/security.

## Ringkasan perubahan

### 1. Performa admin dan dokumen
- Vercel Functions dipindahkan ke region **Singapore (`sin1`)** melalui `vercel.json`, agar compute lebih dekat ke Supabase bila project Supabase berada di Singapore.
- Initial load dashboard admin sekarang memakai **1 endpoint bootstrap** (`/api/admin/bootstrap`) alih-alih beberapa request admin terpisah.
- Endpoint preview dokumen admin disederhanakan agar tidak melakukan query otorisasi yang berulang.
- Signed URL dokumen disimpan sementara di client sehingga file yang sama tidak selalu meminta URL baru.
- Kop PDF Tagihan/Kwitansi di-cache pada instance server agar tidak membaca file PNG dari disk di setiap request.
- Tagihan/Kwitansi ditampilkan di **modal dalam aplikasi**, bukan `window.open()` setelah async fetch. Ini menghilangkan pola yang sering dianggap popup oleh browser.
- Blob PDF Tagihan/Kwitansi di-cache di browser selama sesi halaman.

### 2. Kuota tidak lagi tampil ke peserta
- Total kuota, jumlah terpakai, dan sisa kuota **dihapus dari halaman publik dan form peserta**.
- Peserta hanya akan melihat bahwa suatu mode **Kuota penuh** jika memang sudah tidak tersedia.
- Detail pemakaian kuota tetap tersedia di dashboard admin: Total / Online / Offline, termasuk terpakai, kuota, dan sisa.
- Endpoint publik tidak lagi mengirim angka kuota/count ke browser peserta.

### 3. Menu baru: Panduan Admin
Dashboard panitia mendapat menu **Panduan Admin** yang mencakup alur end-to-end:
- monitoring pendaftaran;
- verifikasi STRA dan bukti pengalaman;
- verifikasi/tolak pembayaran;
- tagihan & kwitansi;
- pengumuman;
- pengaturan form/maintenance;
- akses acara Online/Offline;
- QR check-in;
- tim panitia;
- penanganan masalah operasional dan catatan keamanan.

### 4. Font Lato dan skala tipografi
- Seluruh aplikasi memakai **Lato** melalui `next/font`.
- Ukuran heading publik/admin diturunkan agar lebih proporsional dan tidak terlalu besar.
- Hierarki, spacing, modal, dan card admin/peserta disesuaikan.

### 5. Homepage disederhanakan
- Tombol utama di hero tetap: **Daftar Sekarang** dan **Baca Panduan**.
- Blok pilihan CTA kedua yang mengulang dua tombol tersebut dihapus.
- Area bawah hero sekarang berisi checklist persiapan dokumen, bukan CTA berulang.

## Production hardening / security

### Dependency penting
`package.json` menaikkan:
- `next` → `^16.3.6`
- `@supabase/supabase-js` → `^2.116.0`
- `sanitize-html` → `^2.17.7`

`adm-zip` dan `csv-parse` dipindahkan ke `devDependencies` karena hanya dipakai tool migrasi lokal, bukan runtime production.

### HTTP security headers
Ditambahkan melalui `next.config.mjs`:
- HSTS
- Content-Security-Policy (CSP)
- X-Content-Type-Options
- X-Frame-Options
- Referrer-Policy
- Permissions-Policy
- Cross-Origin-Opener-Policy
- `poweredByHeader: false`

### Upload hardening
- Registrasi publik dan re-upload peserta sekarang memverifikasi **magic bytes/file signature** untuk PDF/JPEG/PNG, bukan hanya nama/MIME dari browser.
- Batas request registrasi diperiksa sebelum parsing bila `Content-Length` terlalu besar.

### Rate limiting registrasi publik
Migration baru membuat tabel `request_events` yang hanya dapat digunakan server (`service_role`). Endpoint registrasi menerapkan rate limit berbasis hash IP agar spam sederhana tidak hanya mengandalkan honeypot.

### Password
Password baru/reset sekarang minimal 10 karakter dan harus mengandung huruf serta angka. Password existing tidak dipaksa berubah.

### Export Excel diperkeras
- `exceljs` dihapus dari runtime karena versi upstream 4.4.0 memiliki advisory keamanan yang belum memiliki patched release upstream.
- Export `.xlsx` sekarang menggunakan `write-excel-file ^4.1.1` dan tetap menghasilkan file Excel dari data pendaftar yang sudah difilter.
- Endpoint export hanya **menulis** workbook dari data database; tidak menerima/membaca workbook upload dari user.

## File/migration baru

Migration wajib:

```text
supabase/migrations/008_production_hardening.sql
```

Migration ini membuat tabel event rate-limit dan tidak mengubah data pendaftar.

Tidak ada environment variable baru.

## Cara update

### 1. Backup / commit versi sekarang

```powershell
git add .
git commit -m "Backup before v0.4.2"
```

### 2. Stop local dev server

```powershell
Ctrl + C
```

### 3. Extract patch
Extract seluruh isi ZIP patch ke root project:

```text
D:\projects\aptfi-preseptor
```

Pilih **Replace / Yes to All**. Patch tidak membawa `.env.local`.

### 4. Jalankan migration 008
Di Supabase → SQL Editor, jalankan **hanya**:

```text
supabase/migrations/008_production_hardening.sql
```

Jangan menjalankan ulang migration 001–007.

### 5. Update dependency
Wajib karena Next.js dan beberapa dependency security dinaikkan:

```powershell
npm install
```

Pastikan `package-lock.json` ikut berubah dan nantinya ikut di-commit.

### 6. Audit dependency

```powershell
npm audit
npm run audit:prod
```

**Jangan langsung menggunakan `npm audit fix --force`.** Jika masih ada high/critical, simpan/copy output audit untuk ditinjau sebelum mengubah major dependency.

### 7. Test lokal

```powershell
npm run dev
```

Checklist minimum:
- `/` tidak menampilkan angka kuota dan CTA tidak berulang;
- `/daftar` tidak menampilkan jumlah/sisa kuota;
- login peserta/admin normal;
- dashboard admin terbuka lebih cepat;
- menu **Panduan Admin** tampil;
- kuota hanya terlihat admin;
- preview STRA/EXP/PAY berfungsi;
- Tagihan/Kwitansi terbuka di modal tanpa popup blocker;
- export XLSX dan Print tetap berfungsi;
- pengumuman tetap berfungsi;
- QR/check-in dan Akses Acara tetap berfungsi.

### 8. Build production sebelum push

```powershell
npm run build
```

Build harus selesai tanpa error.

### 9. Commit & push GitHub

```powershell
git add .
git commit -m "Update Preseptor App v0.4.2"
git push
```

Vercel akan build/deploy otomatis dari branch production.

## Vercel region
Patch menambahkan:

```json
{
  "$schema": "https://openapi.vercel.sh/vercel.json",
  "regions": ["sin1"]
}
```

Ini tepat jika Supabase project berada di Singapore. Jika database ternyata berada di region lain, ubah region Vercel agar sedekat mungkin dengan region database.

## Setelah deploy

Cek production:

```text
https://preseptor.aptfi.or.id
https://preseptor.aptfi.or.id/admin
```

Lakukan test minimal:
1. login admin;
2. buka satu STRA/EXP/PAY;
3. buka Tagihan dan Kwitansi;
4. cek Pengumuman;
5. cek Panduan Admin;
6. cek peserta dari mobile;
7. cek response time dashboard setelah first load dan second load.

Cold start pertama masih dapat terasa lebih lambat daripada request berikutnya, tetapi perpindahan compute dekat database dan pengurangan round-trip seharusnya mengurangi latency yang sebelumnya sangat terasa.

## Rollback
Jika production bermasalah:
1. gunakan Vercel → Deployments → pilih deployment v0.4.1 → **Promote to Production/Rollback**; atau
2. revert commit GitHub v0.4.2.

Migration `008` aman dibiarkan karena hanya menambahkan tabel rate-limit yang tidak mengubah record pendaftaran.
