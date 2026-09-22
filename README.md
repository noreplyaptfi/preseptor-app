# APTFI Preseptor Web App v0.2.0

Pilot aplikasi Pelatihan Preseptor APTFI berbasis **Next.js + Supabase + Resend**. Versi 0.2.0 mengganti login Magic Link sebagai alur utama dengan **email + password**, sehingga login harian tidak tergantung kuota/rate-limit email Supabase.

## Perubahan utama v0.2.0

- Auth peserta: email + password.
- Auth panitia: halaman login terpisah `/admin/login`.
- Aktivasi akun dan reset password dikirim sendiri melalui **Resend** dari `noreply@aptfi.or.id`.
- Supabase hanya membuat/menandatangani recovery/invite link; Supabase tidak dipakai untuk mengirim email auth.
- Peserta baru otomatis menerima email aktivasi setelah pendaftaran berhasil.
- Peserta lama/migrasi dapat klik **Belum punya password? Aktivasi akun** tanpa daftar ulang.
- Super Admin dapat menambahkan akun panitia dan mengirim undangan aktivasi dari Dashboard Panitia.
- Rate limit internal email auth: 1 permintaan/30 detik dan maksimum 10/jam per email.
- UI peserta dirombak mobile-first.
- UI panitia dirombak desktop-first dengan sidebar, antrean kerja, filter, dan manajemen tim.
- Private Storage + signed URL tetap dipertahankan.

---

## 1. Update database Supabase

Jika sebelumnya sudah menjalankan `001_initial.sql`, **jangan jalankan ulang 001**. Jalankan file berikut di Supabase SQL Editor:

```text
supabase/migrations/002_password_auth_resend.sql
```

Migration ini:

- menambah `display_name` dan `updated_at` pada `admin_users`;
- membuat `auth_email_requests` untuk rate limit email aktivasi/reset;
- tidak menghapus/mengubah data pendaftaran yang sudah ada.

Admin pertama tetap cukup ada di `public.admin_users`:

```sql
insert into public.admin_users(email, display_name, role)
values ('admin@aptfi.or.id', 'Nama Admin', 'super_admin')
on conflict (email) do update
set role = excluded.role,
    display_name = excluded.display_name,
    active = true;
```

Anda **tidak perlu membuat password admin lewat SQL**. Buka `/admin/login`, masukkan email tersebut, lalu klik **Aktivasi akun panitia**. Sistem akan membuat recovery/invite link Supabase dan mengirimkannya melalui Resend.

---

## 2. Environment variables

`.env.local` lokal:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_EVENT_SLUG=preseptor-2026
NEXT_PUBLIC_SITE_URL=http://localhost:3000
RESEND_API_KEY=re_...
EMAIL_FROM=APTFI Preseptor <noreply@aptfi.or.id>
```

`SUPABASE_SERVICE_ROLE_KEY` hanya untuk server. Jangan pernah diberi prefix `NEXT_PUBLIC_` atau ditaruh di source code/GitHub.

Untuk production Vercel ubah:

```env
NEXT_PUBLIC_SITE_URL=https://preseptor.aptfi.or.id
```

Pastikan domain `aptfi.or.id`/sender `noreply@aptfi.or.id` sudah verified di Resend.

---

## 3. Supabase Auth URL Configuration

Di **Authentication → URL Configuration** saat development:

```text
Site URL
http://localhost:3000

Redirect URLs
http://localhost:3000/**
```

Untuk production tambahkan:

```text
https://preseptor.aptfi.or.id/**
```

Wildcard diperlukan karena recovery/invite akan kembali ke:

```text
/auth/set-password?next=/dashboard
/auth/set-password?next=/admin
```

Email provider/password Supabase harus tetap aktif. SMTP Supabase tidak wajib dikonfigurasi karena email aktivasi/reset dikirim melalui Resend oleh aplikasi.

---

## 4. Jalankan lokal

```bash
npm install
npm run dev
```

Buka:

```text
Form               http://localhost:3000
Login Peserta      http://localhost:3000/login
Dashboard Peserta  http://localhost:3000/dashboard
Login Panitia      http://localhost:3000/admin/login
Dashboard Panitia  http://localhost:3000/admin
```

### Aktivasi admin pertama

1. Pastikan email admin ada di tabel `admin_users`.
2. Buka `/admin/login`.
3. Isi email admin.
4. Klik **Aktivasi akun panitia**.
5. Buka email dari `noreply@aptfi.or.id`.
6. Klik tautan dan buat password minimal 8 karakter.
7. Login memakai email + password.

### Peserta yang sudah terdaftar sebelum v0.2.0

Tidak perlu membuat pendaftaran baru:

1. Buka `/login`.
2. Masukkan email yang sama dengan pendaftaran.
3. Klik **Belum punya password? Aktivasi akun**.
4. Buka email, buat password.
5. Login seperti biasa.

Peserta yang mendaftar setelah v0.2.0 otomatis mendapatkan email aktivasi bersama email nomor pendaftaran.

---

## 5. Reset password

Di halaman login peserta maupun panitia:

1. Isi email.
2. Klik **Lupa password?**
3. Sistem memvalidasi email secara server-side.
4. Supabase menghasilkan recovery link tanpa mengirim email.
5. Aplikasi mengirim recovery link melalui Resend.
6. User membuka `/auth/set-password`, membuat password baru, lalu kembali ke dashboard.

Respons permintaan dibuat generik untuk mengurangi account enumeration.

---

## 6. Role panitia

Role tersedia:

- `super_admin`: seluruh akses + kelola tim.
- `event_admin`: status form + verifikasi dokumen/pembayaran.
- `document_verifier`: verifikasi persyaratan.
- `payment_verifier`: verifikasi pembayaran.
- `viewer`: hanya membaca dashboard.

Super Admin dapat menambah akun melalui menu **Tim Panitia**. Sistem menyimpan whitelist ke `admin_users` lalu mengirim undangan password lewat Resend.

---

## 7. Pengujian sebelum migrasi WordPress

Lakukan minimal:

- [ ] peserta lama/test dapat aktivasi password;
- [ ] login email + password peserta berhasil;
- [ ] reset password peserta berhasil;
- [ ] admin dapat aktivasi password;
- [ ] login admin berhasil;
- [ ] reset password admin berhasil;
- [ ] role non-admin ditolak dari `/admin`;
- [ ] tambah panitia + email undangan bekerja;
- [ ] pendaftaran baru menghasilkan email aktivasi;
- [ ] preview STRA/pengalaman/bukti bayar bekerja;
- [ ] verifikasi dokumen dan pembayaran bekerja;
- [ ] maintenance countdown bekerja;
- [ ] tampilan form/dashboard nyaman pada layar mobile;
- [ ] dashboard panitia nyaman pada desktop.

Setelah ini lolos baru lanjut export final WordPress, import, dan cutover.

---

## 8. Migrasi peserta WordPress

Importer tetap sama:

```bash
npm run import:wordpress -- /path/aptfi-preseptor-export.csv
```

Importer tidak perlu membuat password. Setelah migrasi, peserta lama memakai menu **Aktivasi akun** untuk membuat password pertama mereka.

---

## Keamanan

- Password tidak disimpan di tabel aplikasi; seluruh password dikelola Supabase Auth.
- Service role hanya berjalan server-side.
- Bukti STRA, pengalaman, dan pembayaran berada di private bucket.
- Preview memakai signed URL dengan masa berlaku pendek.
- Endpoint admin tetap mengecek whitelist `admin_users` dan role.
- Aktivasi/reset menggunakan tautan Supabase yang ditandatangani dan dikirim melalui Resend.
