# APTFI Preseptor — Update v0.7.2 → v0.7.3

## Navigasi & Identitas: sidebar, logo, topbar HP, tombol bawah peserta

Baseline wajib: **v0.7.2**.

Tidak ada migration SQL dan tidak ada dependency baru. Ada **1 endpoint baru yang hanya membaca** (`/api/me/summary`) dan **1 tambahan hitungan** pada `/api/admin/bootstrap`.

### 1. Logo & ikon aplikasi
- **Lambang APTFI berwarna** sekarang dipotong dari logo resmi (`public/aptfi-mark.png`) dan tampil di lencana bulat putih, ditemani teks yang terbaca: "APTFI · Panel Panitia" atau "Pelatihan Preseptor 2026".
- Sebelumnya logo lebar terlalu kecil di sidebar, dan di admin lambangnya berubah menjadi bulatan putih karena filter.
- Saat sidebar diciutkan, yang tampil **lambang**, bukan huruf "A".
- **Favicon** (ikon tab browser) dan **ikon layar utama iPhone/Android** memakai lambang APTFI (`app/icon.png`, `app/apple-icon.png`).
- Bar browser di HP berwarna navy APTFI.
- Logo lebar tetap dipakai di halaman publik (beranda, daftar, login) dan di dokumen.

### 2. Sidebar admin
- Ikon garis seragam (SVG), menggantikan karakter teks ⌂ ▦ Rp ⚙ ▣ ≡.
- Kelompok menu tetap sama: Peserta, Keuangan, Pendaftaran, Pelaksanaan, Data & Sistem. Hak akses per role juga tidak berubah.
- **Badge antrean:**
  - **Pendaftar**: jumlah peserta dengan dokumen atau bukti bayar yang menunggu verifikasi.
  - **Permintaan**: permintaan peserta yang belum ditinjau.
  - **Refund**: refund yang perlu ditinjau.
  - Jumlahnya ikut tampil di kepala grup ketika grup tertutup atau sidebar diciutkan.
  - Badge diperbarui setiap kali panitia berpindah menu.
- **Mode ciut:** ikon dan badge tetap terlihat, dengan **tooltip bergaya aplikasi** saat kursor di atas ikon.
- Kartu profil (nama, role, tombol keluar) di bawah.

### 3. Admin di HP
- Deretan tombol horizontal (lebih dari 15 menu) diganti dengan:
  - **Topbar**: tombol ☰, lambang, dan judul halaman.
  - **Drawer** berisi menu yang sama persis dengan desktop.
- Tombol **Scan QR** (biru) selalu ada di kanan atas, karena itu yang paling sering dipakai panitia di lokasi.
- Titik merah di ☰ menandakan ada antrean.

### 4. Sidebar peserta (desktop & drawer HP)
- Menu dikelompokkan sesuai alur acara:
  - **Status Pendaftaran** dan **Profil Saya**;
  - **Hari-H · 7–8 Okt**: Kehadiran dan Akses Acara;
  - **Assessment**: Pretest, Evaluasi, Posttest;
  - **Info**: Pengumuman, dengan badge jumlah belum dibaca.
- **Penanda status** di setiap menu:
  - ✓ hijau: selesai (terverifikasi, sudah hadir semua hari, Pretest/Evaluasi terkirim, Posttest lulus);
  - • oranye: perlu tindakan (dokumen/bukti bayar kurang, presensi sedang dibuka, assessment sedang dibuka);
  - 🔒: belum dibuka atau perlu presensi dulu.
- Kartu identitas di bawah berisi nama, nomor pendaftaran, chip Online/Offline, dan tombol keluar.

### 5. Peserta di HP
- **Topbar**: lambang, judul halaman yang sedang dibuka, dan tombol lonceng Pengumuman (titik merah bila ada yang belum dibaca).
- **Lima tombol bawah**: Status · Hadir · Tes · Info · Menu.
  - **Tes** membuka lembar pilihan Pretest/Evaluasi/Posttest beserta statusnya (Selesai, Dibuka, Presensi dulu, Lulus).
  - **Menu** membuka drawer lengkap: Profil, Akses Acara, dan Keluar.
  - Titik oranye di Hadir/Tes menandakan ada yang perlu dikerjakan.
- Tombol WhatsApp, notifikasi, dan tombol "Kirim" di assessment otomatis naik ke atas tombol bawah, sehingga tidak tertutup.

### File

Baru:
```text
app/api/me/summary/route.js     (hanya membaca: status presensi & assessment untuk penanda menu)
app/icon.png                    (favicon)
app/apple-icon.png              (ikon layar utama HP)
public/aptfi-mark.png           (lambang APTFI)
components/NavIcon.js
components/BrandMark.js
components/AdminSidebar.js
components/ParticipantNav.js
```

Diubah:
```text
app/layout.js                   (warna bar browser HP)
app/globals.css
app/api/admin/bootstrap/route.js  (hitungan antrean untuk badge; ?counts=1 untuk pembaruan ringan)
components/AdminDashboard.js
components/ParticipantDashboard.js
```

## Instalasi

1. Pastikan lokal sudah v0.7.2.
2. Stop `npm run dev`.
3. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**. File gambar (`.png`) juga ikut.
4. Tidak ada migration SQL dan tidak perlu `npm install`.
5. Jalankan `npm run dev`. Jika favicon belum berubah, lakukan hard refresh (Ctrl+F5), karena browser menyimpan favicon lama.

## Test checklist

### Admin (desktop)
- Lambang berwarna dan teks "APTFI · Panel Panitia" tampil di sidebar.
- Badge Pendaftar, Permintaan, dan Refund sesuai antrean. Setujui satu permintaan, pindah menu, lalu cek badge berkurang.
- Klik **Ciutkan**: tersisa ikon dan lambang, dan tooltip muncul saat kursor di atas ikon. Klik ikon grup untuk memperlebar kembali.
- Login sebagai `document_verifier`: menu Keuangan tidak muncul, dan Scan QR tetap ada.

### Admin (HP)
- Topbar menampilkan ☰, judul halaman, dan tombol Scan QR biru. Scan QR membuka `/admin/checkin`.
- ☰ membuka drawer. Memilih menu menutup drawer dan berpindah halaman. Klik area gelap atau tombol × juga menutup drawer.

### Peserta (desktop)
- Menu berkelompok dengan penanda ✓ / • / 🔒 sesuai status akun.
- Diciutkan: tersisa ikon dengan penanda di pojok ikon.

### Peserta (HP)
- Lima tombol bawah tampil, dan tombol aktif berwarna biru.
- **Tes** membuka lembar Pretest/Evaluasi/Posttest. Memilih salah satu membuka halamannya.
- **Menu** membuka drawer, dan **Keluar** ada di kartu identitas.
- Tombol WhatsApp dan notifikasi tidak tertutup tombol bawah. Tombol "Kirim Pretest" tetap terlihat di atas tombol bawah.

## Perintah git

```powershell
git status
npm run build
npm run audit:prod
git add .
git commit -m "Redesign navigation, sidebar and brand mark v0.7.3"
git push origin main
```

`git status` harus menampilkan 5 file diubah dan 9 entri baru (`app/api/me/summary/`, 2 ikon di `app/`, `public/aptfi-mark.png`, 4 komponen, dan `README-UPDATE-v0.7.3.md`).

Jika ingin membatalkan sebelum commit:

```powershell
git restore .
git clean -fd -n
```

## Migration / Dependency

- SQL migration: **TIDAK**
- npm install: **TIDAK**
