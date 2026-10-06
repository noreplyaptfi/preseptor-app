# APTFI Preseptor — Update v0.8.1 → v0.8.2

## Scanner kamera di halaman Scan QR (in-app)

Baseline wajib: **v0.8.1**.

Panitia tidak perlu lagi membuka aplikasi kamera HP untuk setiap peserta. Di halaman **Scan QR** (`/admin/checkin`), panitia menekan **Buka kamera** satu kali, lalu memindai peserta berurutan di halaman yang sama.

> Tidak ada migration. **Ada 1 dependency baru:** `jsqr` (pembaca QR, tanpa dependency lain).

---

## Alur baru di meja registrasi

1. Buka **Scan QR**, tekan **Buka kamera**, lalu izinkan akses kamera di browser.
2. Arahkan kamera ke QR di menu **Kehadiran** peserta.
3. Hasil langsung tampil **di atas gambar kamera**, sehingga panitia tidak perlu scroll:
   - 🟢 **Hadir tercatat** (nama + hari);
   - 🟠 **Sudah tercatat sebelumnya**;
   - 🔴 **Tidak dapat check-in**, misalnya peserta Online atau di luar jam presensi. Alasannya tampil di kartu bawah;
   - 🔴 **Bukan QR presensi APTFI**, misalnya QR Zoom atau QR lain. QR seperti ini tidak dikirim ke server.
4. Setelah hasil hijau atau oranye, scanner **otomatis lanjut** dalam ±2 detik. Setelah hasil merah, scanner berhenti sampai panitia menekan **Scan berikutnya**, supaya pesan sempat dibaca.
5. Ada bunyi singkat (bila suara HP aktif) dan getar (khusus Android) sebagai tanda QR terbaca.

### Opsi & fitur
- **Langsung catat presensi setelah QR valid terbaca**: aktif secara default. Bila dimatikan, setiap scan menampilkan dialog **Konfirmasi Check-in** lebih dulu. Pilihan ini diingat di perangkat.
- **Ganti kamera** (depan/belakang) dan **Tutup kamera**.
- **Riwayat scan di perangkat ini**: 12 scan terakhir beserta status dan jam.
- QR yang sama tidak diproses ulang selama 8 detik, sehingga tidak tercatat dobel walaupun QR masih di depan kamera.
- Kamera mati otomatis saat HP dikunci atau berpindah aplikasi, dan menyala lagi saat kembali ke halaman.
- **Input manual** (token/URL) tetap ada di bawah sebagai cadangan.

### Tetap berfungsi seperti sebelumnya
- Memindai dengan **aplikasi kamera HP**: tautan QR membuka halaman Scan QR, lalu panitia menekan **Konfirmasi Check-in**.
- API presensi tidak berubah. Pencatatan tetap satu kali per peserta per hari.

### Teknis
- Pembaca QR memakai `BarcodeDetector` bawaan browser bila tersedia (Chrome Android). Di browser lain (iPhone/Safari, laptop), `jsqr` dimuat **hanya saat kamera dibuka**.
- Header `Permissions-Policy` kini mengizinkan kamera **hanya** di `/admin/checkin`. Halaman lain tetap memblokir kamera.
- Panduan Admin diperbarui: langkah H-1 "Siapkan HP panitia scanner", presensi Hari 1, dan kendala "QR tidak bisa dipindai".

## File

Baru:
- `lib/qr-scanner.js`
- `README-UPDATE-v0.8.2.md`

Diubah:
- `components/CheckinPage.js`
- `components/AdminGuide.js`
- `app/globals.css`
- `next.config.mjs`

Ditambahkan oleh perintah npm di bawah:
- `package.json`
- `package-lock.json` (dependency `jsqr`)

## Cara pasang

1. Stop `npm run dev`.
2. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
3. Pasang dependency baru:

```powershell
npm install jsqr@1.4.0
```

4. Jalankan `npm run dev`.

## Test

**Di laptop (lokal):**
1. Buka `http://localhost:3000/admin/checkin`, login panitia, lalu tekan **Buka kamera** (webcam laptop).
2. Login akun TEST **Offline** di HP atau tab lain → menu **Kehadiran** → arahkan QR ke webcam.
3. Banner hijau **Hadir tercatat** muncul. QR yang sama dipindai lagi menjadi oranye **Sudah tercatat**.
4. Arahkan QR Zoom (Akses Acara akun Online) → muncul merah **Bukan QR presensi APTFI**.
5. Matikan **Langsung catat** → scan → muncul dialog konfirmasi.

**Di HP (setelah deploy):** kamera hanya berjalan di alamat **https**, jadi pengujian dengan kamera HP dilakukan di production atau preview Vercel.
- Android (Chrome) dan iPhone (Safari): buka `https://preseptor.aptfi.or.id/admin/checkin` **langsung di browser**, bukan dari tautan di dalam WhatsApp.
- Bila izin kamera pernah ditolak: ketuk ikon gembok/"aA" di samping alamat → izinkan **Kamera** → muat ulang halaman.

## Push

```powershell
git status
npm run build
npm run audit:prod
git add .
git commit -m "Add in-app camera QR scanner for check-in v0.8.2"
git push origin main
```

`git status` harus menampilkan perubahan pada `package.json` dan `package-lock.json` (jsqr), 4 file diubah, serta `lib/qr-scanner.js` dan `README-UPDATE-v0.8.2.md` sebagai file baru.

## Migration / Dependency

- SQL migration: **TIDAK**
- npm install: **YA — `npm install jsqr@1.4.0`**
