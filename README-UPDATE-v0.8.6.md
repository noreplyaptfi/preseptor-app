# APTFI Preseptor — Update v0.8.5 → v0.8.6

## Sertifikat: TTD & cap, halaman 2 (materi & JEP), nomor 339, pemateri & moderator

Baseline: **v0.8.5**.

> ⚠️ **Jalankan migration `024_certificate_recipients.sql` SEBELUM push.**
> Migration ini:
> - menambah tabel pemateri/moderator;
> - menyatukan urutan nomor sertifikat;
> - mengatur format nomor `{NNN}/X/SERTIF/APTFI/2026` dengan nomor awal **339**;
> - langsung mengisi 6 pemateri + 4 moderator.
>
> Aman dijalankan ulang.

Tidak ada dependency baru.

---

### Isi update
- **Tanda tangan & cap** di semua sertifikat.
  - Diunggah lewat admin, disimpan di bucket privat `event-assets`. Gambar **tidak** ada di kode atau folder `public`, karena repo ini publik.
  - Browser otomatis memotong tepi kosong, memperkecil gambar, dan menghapus latar putih bila gambarnya JPG.
- **Halaman 2 — tabel materi & JEP** di **semua** sertifikat: peserta, pemateri, moderator.
  - Isinya bisa diubah di Pengaturan template, format `Materi | 1,5` per baris.
  - `_judul_` dicetak miring.
  - Total dihitung otomatis (10,5).
  - Halaman 2 memuat nomor & nama pemilik sertifikat.
- **Nomor sertifikat** `339/X/SERTIF/APTFI/2026`, lalu 340, dst.
  - Nomor awal dan format bisa diubah di Pengaturan template.
  - Akun TEST tetap terpisah (`TEST-…`).
- **Siapkan nomor** (tab Peserta) menyusun semua nomor resmi sekaligus:
  1. **pemateri** (sesuai urutan tampil);
  2. **moderator**;
  3. **peserta** yang memenuhi syarat atau terbit manual, urut abjad nama tanpa gelar.
  
  Sebelum rilis, tombol ini boleh diulang dan nomornya disusun ulang. Setelah rilis, tombol hanya memberi nomor lanjutan bagi yang belum punya.
- **Tab Pemateri & Moderator** (Super Admin):
  - tambah, ubah, naik/turun urutan, unduh PDF, cabut/pulihkan;
  - hapus hanya bisa bila belum bernomor.
  
  Pilihan per orang:
  - **bahasa** (Indonesia/Inggris);
  - **materi/sesi** (opsional, tercetak "dengan materi …" / "pada sesi …");
  - **keterangan pelaksanaan** (tanpa keterangan / luring / daring).
  
  Kalimat sertifikat: "atas kontribusinya sebagai **PEMATERI/MODERATOR** dalam …".
- **Versi bahasa Inggris** (Assoc. Prof. Surakit Nathisuwan): CERTIFICATE, kalimat Inggris, dan halaman 2 berbahasa Inggris. Semua teks Inggris bisa diedit di Pengaturan template.
- **Halaman verifikasi** QR mendukung pemateri & moderator (menampilkan peran).
- Panduan Panitia diperbarui.

### Data awal (bisa diedit di admin)
Pemateri:
1. Prof. Dr. apt. Yandi Syukri, M.Si
2. Dr. apt. Iis Wahyuningsih, M.Si
3. Prof. Dr. apt. Satibi, M.Si
4. Dr. apt. Lusy Noviani, MM
5. Prof. Dr. apt. Umi Athiyah MS.
6. Assoc. Prof. Surakit Nathisuwan — Inggris

Moderator:
1. Yelly Oktavia Sari S.Si, Apt, M.Si, Ph.D
2. apt. Hannie Fitriani, M.Farm
3. Dr. apt. Dewi Setyaningsih
4. Dr. apt. Valentina Yurina, M.Si

Perkiraan nomor setelah **Siapkan nomor**: pemateri 339–344, moderator 345–348, peserta mulai 349 (abjad).

## File

Baru:
- `supabase/migrations/024_certificate_recipients.sql`
- `app/api/admin/certificates/recipients/route.js`
- `app/api/admin/certificates/signature/route.js`
- `components/CertificateExtrasAdmin.js`
- `README-UPDATE-v0.8.6.md`

Diubah:
- `lib/certificate.js`
- `lib/certificate-pdf.js`
- `lib/certificate-data.js`
- `app/api/admin/certificates/route.js`
- `app/api/admin/certificates/pdf/route.js`
- `app/verifikasi/[code]/page.js`
- `components/CertificatesAdmin.js`
- `components/AdminGuide.js`
- `app/globals.css`

## Cara pasang
1. Stop `npm run dev`.
2. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
3. Jalankan di Supabase SQL Editor:

```text
supabase/migrations/024_certificate_recipients.sql
```

   Hasil yang diharapkan:

   | pemateri | moderator | format_nomor | nomor_awal |
   |---|---|---|---|
   | 6 | 4 | {NNN}/X/SERTIF/APTFI/2026 | 339 |

4. Jalankan `npm run dev`.

## Setelah pasang (urutan kerja)
1. Admin → **Sertifikat → Pengaturan template → Tanda tangan & cap → Unggah gambar**. Pilih file PNG TTD + cap. Cek pratinjau, lalu **Simpan gambar**.
2. Klik tombol **Contoh** (Peserta Offline/Online, Pemateri, Moderator, Inggris). Cek kedua halaman.
3. Tab **Pemateri & Moderator**: cek ejaan nama & gelar, lalu isi materi/sesi bila ingin dicetak.
4. Tab **Peserta → Siapkan nomor → Susun nomor**.
5. Tab **Pemateri & Moderator → Unduh** per orang dan kirimkan.
6. **Rilis ke peserta** bila sudah final.

## Test singkat
1. Contoh Peserta Offline: halaman 1 dengan TTD & cap, halaman 2 tabel 9 materi, total 10,5.
2. Contoh Inggris: CERTIFICATE + "TRAINING MATERIALS".
3. Siapkan nomor → Yandi **339/X/SERTIF/APTFI/2026**, Surakit 344, moderator 345–348.
4. Unduh sertifikat Surakit → pindai QR → halaman verifikasi menampilkan "Sertifikat valid", peran Pemateri.
5. Akun TEST: unduh sertifikat → 2 halaman, watermark TEST, nomor `TEST-…`.

## Push
```powershell
npm run build
npm run audit:prod
git add .
git commit -m "Certificates: signature, syllabus page, numbering from 339, speakers & moderators v0.8.6"
git push origin main
```

## Migration / Dependency
- SQL migration: **YA — 024** (wajib sebelum push)
- npm install: **TIDAK**
- Jangan commit file gambar tanda tangan ke repo (repo publik). Unggah lewat admin saja.
