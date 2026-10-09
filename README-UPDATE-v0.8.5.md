# APTFI Preseptor — Update v0.8.4 → v0.8.5

## Peserta SKP & NIK

Baseline: **v0.8.4**.

> ⚠️ **Jalankan migration `023_skp_nik.sql` SEBELUM push.**
> Migration ini menambah penanda SKP, tabel NIK, dan **langsung menandai 200 peserta SKP** dari sheet "SKP (200)" (dicocokkan lewat Nomor Pendaftaran). Aman dijalankan ulang.
> Kalau kode terlanjur ter-deploy sebelum migration, aplikasi tetap berjalan normal. Fitur SKP/NIK baru muncul setelah migration dijalankan.

Tidak ada dependency baru.

---

### Aturan
- **Peserta SKP (200 orang):** NIK **wajib**. Mereka mendapat pengingat di dashboard sampai NIK diisi.
- **Peserta lain:** field NIK tetap ada di Profil Saya, tetapi **opsional**. Tidak ada pengingat, penanda menu, atau email.
- NIK disimpan di tabel terpisah (`registration_nik`) yang hanya bisa dibaca server.
- NIK lengkap hanya terlihat oleh:
  - peserta pemiliknya,
  - Super Admin / Admin Event (tombol *Tampilkan NIK* dan Export Excel).
  
  Role lain hanya melihat 4 digit terakhir.
- NIK **bukan** syarat sertifikat. Sertifikat tidak berubah.

### Peserta
- **Profil Saya → kartu "NIK (Nomor Induk Kependudukan)"**
  - Isi 16 digit, lalu ketik ulang. Kolom ulang tidak bisa ditempel.
  - Centang persetujuan, lalu konfirmasi.
  - Format dicek: 16 digit, kode provinsi, dan tanggal lahir di digit 7–12.
  - NIK yang sudah dipakai peserta lain ditolak.
  - NIK yang tersimpan tampil tersamar (`•••• •••• •••• 1234`), dengan tombol *Tampilkan* dan *Ubah NIK*.
- **Pengingat (hanya peserta SKP yang belum mengisi):**
  - kartu "Lengkapi NIK Anda" di Status Pendaftaran;
  - bar kecil di menu lain;
  - titik penanda di menu Profil Saya dan tombol Menu (HP).
  
  Semua pengingat hilang begitu NIK tersimpan.
- Ringkasan Data Pendaftaran menampilkan NIK tersamar untuk peserta SKP.

### Admin
- **Ringkasan → panel "Peserta SKP & NIK":** jumlah SKP, NIK sudah/belum diisi, non-SKP, dan progres. Klik angka untuk membuka daftar terfilter.
- **Pendaftar:**
  - chip **SKP** dan **NIK ✓ / NIK belum** di bawah nama;
  - filter baru: *Peserta SKP / SKP · NIK belum diisi / SKP · NIK sudah diisi / Non-SKP*.
- **Detail peserta → bagian "SKP & NIK"** (Super Admin & Admin Event):
  - *Tandai SKP / Keluarkan dari SKP*;
  - *Tampilkan NIK*;
  - *Isi/Ubah NIK* atas nama peserta (tercatat "oleh panitia");
  - *Hapus NIK*.
- **Tandai SKP sekaligus** (tombol di Pendaftar):
  - tempel Nomor Pendaftaran (boleh salinan kolom Excel);
  - *Periksa dulu* menampilkan jumlah ditemukan, yang berubah, dan yang tidak ditemukan;
  - lalu proses.
- **Pengumuman:** penerima baru *Peserta SKP* dan *Peserta SKP yang belum mengisi NIK*. Tombol *Kirim pengingat* di panel Ringkasan langsung mengisi penerima, subject, dan draf isi. Email pengingat hanya terkirim ke yang NIK-nya masih kosong.
- **Export Excel:** kolom baru **SKP** (Ya/Tidak), **NIK** (teks 16 digit, tidak dibulatkan Excel), dan **NIK Diperbarui**. Export mengikuti filter, jadi pilih filter SKP dulu untuk daftar LMS.
- Semua perubahan SKP/NIK tercatat di audit log, tanpa menyimpan angka NIK.
- Panduan Panitia: langkah "Kumpulkan NIK peserta SKP".

## File

Baru:
- `supabase/migrations/023_skp_nik.sql`
- `lib/nik.js`
- `lib/nik-data.js`
- `app/api/me/nik/route.js`
- `app/api/admin/skp/route.js`
- `components/NikCard.js`
- `components/SkpAdmin.js`
- `README-UPDATE-v0.8.5.md`

Diubah:
- `lib/announcement-audience.js`
- `app/api/admin/announcements/route.js`
- `app/api/admin/bootstrap/route.js`
- `app/api/admin/export/route.js`
- `app/api/me/announcements/route.js`
- `app/api/me/registrations/route.js`
- `components/AdminDashboard.js`
- `components/AdminGuide.js`
- `components/ParticipantDashboard.js`
- `components/ParticipantNav.js`
- `components/ParticipantProfile.js`
- `app/globals.css`

## Cara pasang
1. Stop `npm run dev`.
2. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
3. Jalankan di Supabase SQL Editor:

```text
supabase/migrations/023_skp_nik.sql
```

   Hasil yang diharapkan (tabel ringkasan di bawah editor):

   | kode_di_daftar | cocok_di_database | total_peserta_skp | tidak_ditemukan |
   |---|---|---|---|
   | 200 | 200 | 200 | *(kosong)* |

   Kalau `tidak_ditemukan` berisi nomor, nomor itu tidak ada di database. Tandai manual lewat *Tandai SKP sekaligus* setelah nomornya dicek.

4. Jalankan `npm run dev`.

## Test singkat
1. Admin → **Ringkasan**: panel *Peserta SKP & NIK* menampilkan ±200 peserta SKP (peserta SKP yang mengundurkan diri tidak dihitung).
2. **Pendaftar** → filter *SKP · NIK belum diisi* → chip **SKP** dan **NIK belum** muncul.
3. **Pendaftar** → status *Semua termasuk arsip* → cari akun **TEST** → *Lihat detail* → *Tandai SKP*.
4. Login sebagai akun TEST itu:
   - kartu "Lengkapi NIK Anda" muncul dan menu Profil Saya bertanda titik;
   - klik *Isi NIK sekarang* → isi NIK + ulangi + centang → *Simpan NIK* → *Ya, simpan*;
   - pengingat hilang dan NIK tampil tersamar.
5. Login akun TEST lain (non-SKP): tidak ada pengingat, dan kartu NIK di Profil Saya berlabel **Opsional**.
6. Admin → detail akun TEST tadi → *Tampilkan NIK* → angka cocok.
7. Admin → **Pendaftar** → filter *Peserta SKP* → **Export Excel** → kolom **SKP** dan **NIK** terisi, NIK utuh 16 digit.
8. Kembalikan akun TEST: *Keluarkan dari SKP* (dan *Hapus NIK* bila perlu).

## Push
```powershell
npm run build
npm run audit:prod
git add .
git commit -m "Add SKP participants and NIK collection v0.8.5"
git push origin main
```

## Migration / Dependency
- SQL migration: **YA — 023** (wajib sebelum push)
- npm install: **TIDAK**
