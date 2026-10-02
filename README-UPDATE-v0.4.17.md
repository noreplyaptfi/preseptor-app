# APTFI Preseptor App — Update v0.4.16 → v0.4.17

## v0.4.17 — Special Participant Enrollment

Update ini dibuat untuk kasus calon peserta tertentu yang tetap diberi kesempatan mendaftar setelah form publik ditutup. Form publik **tidak perlu dibuka kembali**.

### Fitur baru

- Menu Admin **Peserta Khusus** untuk `super_admin` dan `event_admin`.
- Tambah satu peserta secara manual.
- Import massal dengan **copy-paste dari Excel / Google Sheets** tanpa dependency tambahan.
- Kolom import: `Nama | Email | WhatsApp | Homebase | Mode`.
- Maksimal 100 peserta per proses.
- Validasi duplikat email dan WhatsApp, termasuk duplikat di dalam batch import.
- Validasi Homebase harus berasal dari Data Homebase yang aktif.
- Validasi kuota Online, Offline, dan total tetap berlaku.
- Peserta yang berhasil dibuat langsung berstatus **pendaftar aktif**, sehingga langsung memakai slot kuota.
- Sistem membuat akun Supabase Auth bila email tersebut belum memiliki akun.
- Email onboarding dikirim melalui Resend.
- Peserta diarahkan menggunakan **Lupa Password** untuk membuat password secara aman, lalu login dan melengkapi Profil Saya serta dokumen.
- Tombol **Kirim ulang petunjuk** untuk peserta khusus.
- Peserta khusus tetap dikelola melalui menu **Pendaftar** seperti peserta lainnya.
- Form publik dan jadwal Online/Offline tidak diubah oleh proses peserta khusus.

## Database migration

Jalankan **hanya** migration berikut setelah file patch ditimpa:

```text
supabase/migrations/014_special_participant_enrollment.sql
```

Migration menambah metadata:

```text
enrollment_source
special_enrollment_at
special_enrollment_by
```

Tidak ada perubahan data pendaftar lama.

## Dependency

Tidak ada package baru.

```text
npm install tidak diperlukan
```

## Cara update

1. Pastikan project saat ini adalah **v0.4.16**.
2. Stop `npm run dev`.
3. Extract ZIP patch ke root project dan pilih **Replace / Yes to All**.
4. Jalankan migration `014_special_participant_enrollment.sql` di Supabase SQL Editor.
5. Jalankan:

```powershell
npm run dev
```

## Cara menggunakan

Buka:

```text
Admin → Peserta Khusus
```

### Tambah manual

Isi:

```text
Nama
Email
WhatsApp
Homebase
Mode Online / Offline
```

Klik **Buat peserta & kirim petunjuk akun**.

### Import banyak peserta

Siapkan Excel/Google Sheets tanpa header dengan 5 kolom:

```text
Nama | Email | WhatsApp | Homebase | Mode
```

Contoh:

```text
Ahmad Fauzan | ahmad@email.com | 08123456789 | Universitas Contoh | Online
Siti Rahma    | siti@email.com  | 08123456780 | Universitas Contoh | Offline
```

Blok kelima kolom tersebut di Excel/Google Sheets → Copy → Paste ke area import. Browser mempertahankan pemisah TAB secara otomatis.

Sistem menampilkan hasil per baris. Baris yang gagal **tidak membuat akun dan tidak memakai kuota**.

## Alur peserta khusus

```text
Admin membuat/import peserta
        ↓
Pendaftaran aktif dibuat
        ↓
Slot Online/Offline langsung terpakai
        ↓
Akun Supabase Auth dibuat
        ↓
Email onboarding dikirim
        ↓
Peserta → Lupa Password
        ↓
Login
        ↓
Profil Saya
        ↓
Lengkapi STRA + bukti pengalaman + pembayaran
        ↓
Verifikasi panitia seperti peserta biasa
```

## Catatan keamanan

- Jangan membuka form publik hanya untuk peserta khusus.
- Jangan mengirim password sementara lewat email/WhatsApp.
- Peserta membuat password sendiri melalui flow Lupa Password yang sudah ada.
- Kuota selalu diperiksa server-side saat import.
- Jika kuota tidak cukup, naikkan kuota lebih dulu dari **Status Form → Manajemen Kuota**.

## Checklist test

1. Tutup Online dan Offline dari Status Form.
2. Pastikan `/daftar` tetap tertutup.
3. Masuk Admin → Peserta Khusus.
4. Tambahkan satu peserta Online.
5. Pastikan peserta muncul di Pendaftar dan total aktif bertambah 1.
6. Pastikan sisa kuota Online berkurang 1.
7. Cek email onboarding masuk.
8. Gunakan Lupa Password → buat password → login.
9. Pastikan peserta dapat membuka Profil Saya dan melengkapi dokumen.
10. Uji paste 2–3 peserta dari Excel/Google Sheets.
11. Uji email/WhatsApp duplikat dan pastikan baris ditolak.
12. Uji mode yang kuotanya penuh dan pastikan import ditolak.

## Build & deploy

Jika seluruh test lolos:

```powershell
npm run build
npm run audit:prod

git add .
git commit -m "Add special participant enrollment v0.4.17"
git push origin main
```

## Day-H

Day-H Operations tetap ditunda. Patch v0.5.0 lama **jangan dipasang**. Versi Day-H berikutnya harus direbase dari baseline terbaru setelah v0.4.17 stabil.
