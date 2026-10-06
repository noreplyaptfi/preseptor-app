# APTFI Preseptor — Update v0.7.3 → v0.8.0

## Sertifikat, Virtual Background, Materi, dan Panduan Pelaksanaan

Baseline wajib: **v0.7.3**.

Update ini melengkapi roadmap tahap 3 (Completion & Assets) dan menambahkan panduan alur di dalam aplikasi.

> ⚠️ **Jalankan migration `020_certificates_assets.sql` SEBELUM push ke production.**
> Migration ini membuat tabel sertifikat & aset serta bucket penyimpanan `event-assets`. Tanpa migration ini, menu Sertifikat, Materi, dan Virtual Background akan menampilkan pesan error.

Tidak ada dependency baru: `pdf-lib`, `qrcode`, dan `write-excel-file` sudah terpasang.

---

## 1. Sertifikat

### Syarat (8 poin, sesuai roadmap)
1. Pendaftaran aktif
2. Dokumen persyaratan valid
3. Pembayaran terverifikasi
4. Hadir Hari 1
5. Hadir Hari 2
6. Pretest selesai
7. Evaluasi pemateri selesai
8. Posttest lulus (nilai terbaik ≥ nilai lulus Posttest, default 80)

### Peserta — menu baru **Sertifikat**
- Daftar 8 syarat dengan tanda ✓. Syarat yang belum terpenuhi punya tombol **Buka** yang langsung membuka menu terkait.
- Status sertifikat:
  - **Belum memenuhi syarat**;
  - **Syarat sudah lengkap**, menunggu rilis panitia;
  - **Siap diunduh**;
  - **Dicabut**.
- Sebelum mengunduh, peserta melihat **nama yang akan tercetak**. Bila salah, peserta memperbaikinya di Profil Saya lalu mengunduh ulang. Nama selalu mengikuti data profil terbaru.
- Setelah unduhan pertama, peserta melihat nomor sertifikat, tanggal terbit, dan tautan verifikasi.

### Desain sertifikat (dummy / sementara)
- PDF A4 landscape: logo APTFI, nomor sertifikat, nama peserta, nama kegiatan, tanggal, mode luring/daring, blok penandatangan, dan **QR code verifikasi**.
- Nama panjang otomatis diperkecil atau dipecah menjadi dua baris.
- **Akun TEST** mendapat watermark **DUMMY / TEST — TIDAK BERLAKU**, nomor berawalan `TEST-`, dan nomor urut terpisah dari sertifikat resmi.
- Template final dapat disambungkan pada update berikutnya tanpa mengubah data, karena nomor dan kode verifikasi sudah tersimpan.

### Nomor sertifikat
- Diberikan **saat sertifikat pertama kali diunduh** (oleh peserta atau Super Admin), berurutan tanpa bentrok walaupun banyak peserta mengunduh bersamaan.
- Format bisa diatur, contoh `{NNN}/APTFI/PRESEPTOR/X/2026` → `001/APTFI/PRESEPTOR/X/2026`. Gunakan `{NNNN}` untuk 4 digit.

### Verifikasi publik — `/verifikasi/<kode>`
QR di sertifikat membuka halaman yang menampilkan **Sertifikat valid** (nama, nomor, kegiatan, tanggal terbit), atau **Sertifikat uji — tidak berlaku**, **Dicabut**, atau **Tidak ditemukan**.

### Admin — menu **Pelaksanaan → Sertifikat** (Super Admin)
- Kartu status rilis dengan tombol **Rilis ke peserta** / **Tarik rilis**. Default: **belum dirilis**.
- Statistik peserta aktif, memenuhi syarat, sudah terbit, sudah diunduh, dan terbit manual.
- Tab **Peserta**:
  - tabel 7 syarat dalam bentuk chip (Dok · Bayar · H1 · H2 · Pre · Eval · Post), nilai Posttest terbaik, status, nomor sertifikat, dan jumlah unduhan;
  - filter (Semua, Memenuhi syarat, Belum memenuhi, Sudah terbit, Akun TEST), pencarian, dan **Export Excel**.
- Aksi per peserta:
  - **Unduh** (untuk yang memenuhi syarat atau terbit manual);
  - **Terbitkan manual** dengan alasan wajib, untuk kasus khusus yang sudah dikonfirmasi panitia;
  - **Cabut** dengan alasan, dan **Pulihkan**.
- Tab **Pengaturan template**: teks judul, peran, nama kegiatan, penyelenggara, tanggal, lokasi, tempat & tanggal terbit, penandatangan, format nomor, dan catatan tambahan (misalnya SKP). Tombol **Contoh Offline / Online** mengunduh PDF contoh bertanda CONTOH.
- Semua aksi tercatat di log aktivitas.

---

## 2. Virtual Background & Materi

### Admin — menu **Pelaksanaan → Materi & Background** (Super Admin, Admin Event)
- Tab **Virtual Background**:
  - unggah JPG/PNG maksimal 10 MB, dengan pratinjau gambar;
  - muncul peringatan bila ukuran gambar tidak 16:9 atau lebarnya kurang dari 1280 px (disarankan 1920 × 1080).
- Tab **Materi**:
  - unggah PDF, PPT/PPTX, DOC/DOCX, XLS/XLSX, ZIP, MP4, JPG, atau PNG, maksimal 50 MB;
  - untuk file lebih besar (misalnya rekaman), tambahkan **Tautan** Google Drive.
- Setiap file bisa diatur:
  - judul dan keterangan;
  - sasaran **Semua / Online / Offline**;
  - tampil atau sembunyikan;
  - urutan naik/turun;
  - edit dan hapus (dengan dialog konfirmasi).
- File diunggah langsung ke Supabase Storage (bucket privat `event-assets`), sehingga tidak terkena batas ukuran Vercel. Server memverifikasi file sebelum disimpan.
- Jumlah unduhan per file terlihat di daftar.

### Peserta — menu **Virtual Background** dan **Materi**
- Hanya untuk peserta terverifikasi dan akun TEST. Peserta lain melihat pesan menunggu verifikasi.
- Virtual background: galeri pratinjau, tombol **Unduh**, dan **cara memasang di Zoom** (laptop, saat rapat, dan HP).
- Materi: daftar file dengan jenis dan ukuran. File diunduh lewat tautan sementara (berlaku 5 menit); tautan Drive dibuka di tab baru.
- Di **Akses Acara** peserta Online ada tombol **Unduh virtual background Zoom**.

---

## 3. Panduan alur di dalam aplikasi

- **Admin → Data & Sistem → Panduan Admin** kini berisi dua tab:
  - **Pelaksanaan Hari-H**: alur H-1 → Hari 1 → Hari 2 → Setelah acara, lengkap dengan jam. Setiap langkah punya tombol yang membuka menu terkait. Ada juga daftar kendala umum beserta solusinya.
  - **Pendaftaran & administrasi**: alur verifikasi sebelumnya.
- **Peserta → menu Panduan** (baru): alur persiapan → Hari 1 → Hari 2 → sertifikat. Isinya **otomatis menyesuaikan mode Online/Offline**, dan setiap langkah punya tombol ke menu terkait.

## 4. Navigasi
- Sidebar peserta:
  - **Hari-H**: Kehadiran, Akses Acara, **Virtual Background**, **Materi** (dengan jumlah file);
  - kelompok baru **Penyelesaian**: **Sertifikat**, dengan penanda ✓ sudah diunduh, • siap diunduh, atau 🔒 syarat belum lengkap;
  - **Info**: Pengumuman, **Panduan**.
- Di HP, tombol **Tes** di bawah layar kini berisi Pretest, Evaluasi, Posttest, dan **Sertifikat**. Virtual Background, Materi, dan Panduan ada di **Menu**.
- Sidebar admin, grup **Pelaksanaan**: tambahan **Materi & Background** dan **Sertifikat**.
- Profil Saya: keterangan pratinjau nama kini "Nama dan gelar ini akan tercetak di sertifikat."

---

## File

Baru:
```text
supabase/migrations/020_certificates_assets.sql
lib/certificate.js            (aturan 8 syarat, format nomor, teks template)
lib/certificate-pdf.js        (desain sertifikat dummy + QR verifikasi)
lib/certificate-data.js       (akses data sertifikat)
lib/event-assets.js           (aturan jenis & ukuran file)
lib/download-client.js        (unduh PDF yang butuh login)
app/api/me/certificate/route.js
app/api/me/certificate/pdf/route.js
app/api/admin/certificates/route.js
app/api/admin/certificates/pdf/route.js
app/api/admin/assets/route.js
app/api/me/assets/route.js
app/verifikasi/[code]/page.js
components/CertificatesAdmin.js
components/EventAssetsAdmin.js
components/CertificatePanel.js
components/AssetsPanel.js
components/AdminGuide.js
components/ParticipantGuide.js
components/FlowPhases.js
public/aptfi-emblem.png
```

Diubah:
```text
app/api/me/summary/route.js
app/globals.css
components/AdminDashboard.js
components/AdminSidebar.js
components/NavIcon.js
components/ParticipantDashboard.js
components/ParticipantNav.js
components/ParticipantProfile.js
```

## Instalasi

1. Pastikan lokal sudah v0.7.3.
2. Stop `npm run dev`.
3. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
4. Jalankan migration di Supabase SQL Editor:

```text
supabase/migrations/020_certificates_assets.sql
```

5. Tidak perlu `npm install`.
6. Jalankan `npm run dev`.

Cek bucket: di Supabase → **Storage**, bucket **event-assets** (Private) harus sudah muncul.

## Test checklist (akun TEST)

### A. Materi & Virtual Background
1. Admin → **Materi & Background** → tab Virtual Background → unggah gambar 1920 × 1080 → muncul di daftar.
2. Tab Materi → unggah 1 PDF dan 1 PPTX, lalu tambahkan 1 Tautan dengan sasaran **Offline**.
3. Login akun TEST Online → menu **Virtual Background** → pratinjau tampil → **Unduh** berhasil.
4. Menu **Materi** → PDF/PPTX terlihat, tautan Offline **tidak** terlihat (karena akun Online).
5. Admin: sembunyikan satu materi → peserta tidak melihatnya lagi.

### B. Sertifikat
1. Akun TEST sudah check-in Hari 1 & 2 serta mengirim Pretest, Evaluasi, dan Posttest (≥ 80).
2. Peserta → **Sertifikat** → 8/8 syarat → **Unduh sertifikat (PDF)** (akun TEST bisa walau belum dirilis).
3. Buka PDF: ada watermark **DUMMY / TEST — TIDAK BERLAKU**, dan nomor diawali `TEST-`.
4. Pindai QR di PDF dengan kamera HP → halaman verifikasi menampilkan **Sertifikat uji — tidak berlaku**.
   - Saat test di lokal, QR mengarah ke `NEXT_PUBLIC_SITE_URL` (biasanya `http://localhost:3000`). Buka `http://localhost:3000/verifikasi/<kode>` di browser laptop.
5. Admin → **Sertifikat** → tab Peserta: akun TEST tampil **Siap diunduh** dengan nomor sertifikatnya.
6. Tab **Pengaturan template** → ubah penandatangan → Simpan → **Contoh Offline** → PDF contoh berubah.
7. Coba **Terbitkan manual** pada akun TEST lain yang belum lengkap (dengan alasan), lalu **Cabut** dan **Pulihkan**.

### C. Panduan
- Admin → **Panduan Admin** → tab Pelaksanaan Hari-H → klik beberapa tombol langkah (berpindah ke menu terkait).
- Peserta → **Panduan**: isi berbeda untuk akun Online dan Offline.

### D. HP
- Tombol **Tes** di bawah menampilkan Sertifikat.
- **Menu** berisi Virtual Background, Materi, dan Panduan.

## Push ke production

1. Jalankan `020_certificates_assets.sql` di Supabase SQL Editor **production**. Lewati langkah ini jika lokal dan production memakai project yang sama.
2. Pastikan `NEXT_PUBLIC_SITE_URL=https://preseptor.aptfi.or.id` di Vercel, karena alamat QR verifikasi memakai nilai ini.
3. Perintah git:

```powershell
git status
npm run build
npm run audit:prod
git add .
git commit -m "Add certificates, virtual backgrounds, materials and event guides v0.8.0"
git push origin main
```

`git status` harus menampilkan 8 file diubah dan entri baru untuk API, komponen, lib, migration 020, `public/aptfi-emblem.png`, dan `README-UPDATE-v0.8.0.md`.

Jika ingin membatalkan sebelum commit:

```powershell
git restore .
git clean -fd -n
```

## Catatan penting

- **Sertifikat default belum dirilis.** Rilis baru setelah acara dan setelah template final siap. Akun TEST tetap bisa mengunduh untuk uji coba.
- Template saat ini adalah **desain sementara**. Kirimkan desain final (gambar/PDF latar dan posisi teks) untuk disambungkan pada update berikutnya.
- Penandatangan default diisi **Prof. Dr. apt. Yandi Syukri, M.Si. — Ketua Umum APTFI** (dari rundown). Ubah di Pengaturan template bila berbeda.
- Supabase paket gratis membatasi ukuran upload 50 MB per file. Gunakan Tautan untuk file lebih besar.

## Migration / Dependency

- SQL migration: **YA — 020** (wajib sebelum push)
- npm install: **TIDAK**
