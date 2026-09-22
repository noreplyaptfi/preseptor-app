# Update APTFI Preseptor Web App v0.2.2

Patch ini ditujukan untuk project **v0.2.1** yang sudah berjalan. Tidak perlu membuat project baru.

## Ringkasan perubahan

### UI/UX publik
- Landing page baru: pengguna tidak langsung melihat form.
- CTA utama: **Baca Panduan** dan **Daftar Sekarang**.
- Halaman baru `/panduan` berisi tata cara step-by-step, syarat, dan checklist dokumen.
- Form dipindahkan ke `/daftar` dan didesain ulang agar lebih rapi, modern, dan mobile-first.
- Header publik memakai logo APTFI resmi dan **hanya menampilkan tombol Masuk**. Tidak ada tombol Panitia di tampilan publik.
- Palet warna aplikasi disesuaikan dengan flyer Pelatihan Preseptor: navy, royal blue, light blue, dan putih.

### Pencegahan pendaftaran ganda
- Field wajib baru: **Nomor STRA**.
- Normalisasi dan duplicate protection berdasarkan:
  - email,
  - nomor WhatsApp,
  - nomor STRA.
- Proteksi dilakukan di API **dan database unique index**.
- Nama + homebase yang sangat mirip ditandai sebagai `Cek duplikat` di dashboard admin untuk review manual; nama tidak dijadikan hard unique key.

### Verifikasi dokumen admin
- Klik STRA / Pengalaman / Pembayaran membuka **popup preview**, bukan tab baru.
- Tombol **Verifikasi** dan **Tolak** tersedia di dalam popup.
- Verifikasi selalu meminta confirmation.
- Penolakan wajib berisi:
  - alasan/catatan,
  - langkah selanjutnya.
- Jika dokumen sebelumnya sudah valid lalu diubah menjadi ditolak, muncul warning confirmation khusus.
- Penolakan otomatis mengirim email ke peserta melalui Resend dan tampil juga di Dashboard Peserta.
- Status review kini dicatat per dokumen (STRA, bukti pengalaman, bukti pembayaran).

### Dashboard peserta
- Menampilkan alasan penolakan dan langkah selanjutnya.
- Dokumen STRA/pengalaman yang ditolak dapat diunggah ulang.
- Bukti pembayaran yang ditolak dapat diunggah ulang.
- Nomor STRA tampil di ringkasan peserta.

## File database migration yang WAJIB dijalankan

Setelah menimpa file patch, buka **Supabase → SQL Editor** dan jalankan hanya:

```text
supabase/migrations/004_review_dedupe_ui.sql
```

Jangan menjalankan ulang migration 001, 002, atau 003.

Migration 004:
- menambah kolom nomor/normalisasi STRA, email, WhatsApp,
- menambah metadata review dokumen,
- membuat unique index anti-duplikat,
- aman untuk data lama: jika ditemukan nomor WhatsApp historical yang sama, satu record paling awal dijadikan record canonical untuk unique protection sehingga migration tetap dapat berjalan.

## Perubahan environment

Tidak ada environment variable baru.

Pastikan development lokal tetap menggunakan:

```env
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Production nanti menggunakan:

```env
NEXT_PUBLIC_SITE_URL=https://preseptor.aptfi.or.id
```

## Cara update v0.2.1 → v0.2.2

1. Stop Next.js:
   ```bash
   Ctrl + C
   ```
2. Backup/commit project.
3. Extract isi patch ke root project v0.2.1 dan pilih **Replace / Yes to All**.
4. Jangan menghapus `.env.local`.
5. Jalankan `supabase/migrations/004_review_dedupe_ui.sql` di SQL Editor Supabase.
6. Tidak ada dependency baru, sehingga `npm install` **tidak wajib**. Jika ingin menyelaraskan metadata package, boleh menjalankan:
   ```bash
   npm install
   ```
7. Jalankan kembali:
   ```bash
   npm run dev
   ```

## Checklist pengujian setelah update

- [ ] `/` menampilkan landing page, bukan form langsung.
- [ ] Header publik menampilkan logo APTFI + tombol Masuk saja.
- [ ] `/panduan` tampil dan CTA menuju `/daftar` bekerja.
- [ ] `/daftar` menampilkan form baru.
- [ ] Nomor STRA wajib diisi.
- [ ] Pendaftaran normal berhasil.
- [ ] Percobaan daftar ulang dengan email sama ditolak.
- [ ] Percobaan daftar ulang dengan email berbeda tetapi WhatsApp sama ditolak.
- [ ] Percobaan daftar ulang dengan email berbeda tetapi STRA sama ditolak.
- [ ] Admin dapat membuka STRA sebagai popup preview.
- [ ] Admin dapat verifikasi dengan confirmation.
- [ ] Admin dapat menolak dengan alasan + langkah selanjutnya.
- [ ] Email penolakan masuk ke peserta.
- [ ] Alasan penolakan muncul di Dashboard Peserta.
- [ ] Peserta dapat upload ulang dokumen yang ditolak.
- [ ] Peserta dapat upload ulang bukti pembayaran yang ditolak.
- [ ] Maintenance mode tetap bekerja di `/daftar`.

## Rollback

Jika perlu rollback kode:
1. Stop server.
2. Kembalikan file project dari backup/commit v0.2.1.
3. Jalankan kembali `npm run dev`.

Migration 004 sebaiknya **tidak perlu dihapus** saat rollback singkat karena semua kolom baru bersifat additive dan tidak mengubah data lama. Kode v0.2.1 dapat mengabaikan kolom tersebut.
