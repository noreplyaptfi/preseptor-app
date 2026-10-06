# APTFI Preseptor — Update v0.7.1 → v0.7.2

## Standarisasi UI/UX: notifikasi, dialog, tabel, pencarian

Baseline wajib: **v0.7.1**.

Update ini **hanya tampilan dan label**. Tidak ada perubahan API, database, migration, atau dependency.

Sebelum update, seluruh halaman diaudit dengan render di browser, ukuran desktop (1366px) dan HP (390px):
- 13 menu admin, termasuk Pretest/Evaluasi/Posttest;
- 8 tab dashboard peserta;
- login, landing, form daftar, panduan, dan halaman Scan QR.

### 1. Notifikasi popup seragam (toast)
- Pesan sukses dan gagal tidak lagi berupa kotak di atas halaman, yang sebelumnya tidak terlihat bila halaman sedang di-scroll ke bawah.
- Semua pesan sekarang muncul sebagai **toast** di pojok kanan atas (desktop) atau bawah tengah (HP, di atas tombol WhatsApp).
- Hijau untuk sukses dan hilang otomatis dalam ±4,5 detik. Merah untuk gagal, tampil ±7 detik. Keduanya bisa ditutup dengan ×.
- Berlaku di semua menu admin, dashboard peserta, profil peserta, presensi Hari-H, dan halaman Scan QR.
- Pesan yang terkait langsung dengan form tetap ditampilkan di form, misalnya salah password di login, hasil form pendaftaran, atau tombol "Masuk dengan akun panitia" di Scan QR.

### 2. Tidak ada lagi popup bawaan browser
- Semua `confirm()` bawaan browser di modul Pretest/Evaluasi/Posttest (admin dan peserta) diganti dengan **dialog konfirmasi bergaya aplikasi**, sama seperti dialog yang sudah dipakai di menu lain.
- Aksi berbahaya (reset hasil, hapus soal, hapus pemateri) memakai tombol merah.
- Sekarang tidak ada lagi `alert()`, `confirm()`, atau `prompt()` bawaan browser di seluruh aplikasi.

### 3. Tabel
Satu gaya untuk semua tabel admin: Pendaftar, Peserta Khusus, Refund, Command Center Hari-H, dan Hasil Pretest/Evaluasi/Posttest.
- Header abu-biru huruf kapital kecil, dan baris tersorot saat kursor di atasnya.
- Bingkai tabel bersudut membulat dan bisa digeser di HP.
- Tabel Hari-H sebelumnya memakai huruf 10px. Sekarang 13px, sama dengan tabel lain.

### 4. Pencarian
- Semua kolom pencarian memakai satu gaya: lebar penuh, ikon ⌕, tinggi 44px, dan cincin fokus biru.
- Sebelumnya pencarian di **Command Center Hari-H** dan **Data Homebase** masih berupa input polos dan kecil.
- Kolom token di halaman **Scan QR** juga dirapikan.

### 5. Kartu statistik dan checkbox
- Kartu statistik di **Refund** dan **Pretest/Evaluasi/Posttest** sekarang sama dengan kartu di Ringkasan.
- Semua checkbox memakai gaya kotak biru dengan centang, termasuk "Aktif" pada jadwal Hari-H, "Wajib dijawab", pilihan refund, dan pengaturan modul.

### 6. Label yang sebelumnya mentah
- Status form di **Pengaturan Pendaftaran**: `closed` → **Ditutup**, `open` → **Dibuka**, dan seterusnya.
- Status batch refund: `draft` → **Draft**, `processing` → **Diproses**, `completed` → **Selesai**, `cancelled` → **Dibatalkan**.
- Kanal presensi di Aktivitas terbaru Hari-H dan export attendance: `offline_qr` → **Scan QR**, `online_self` → **Mandiri (Online)**, `manual` → **Manual**.

### 7. Perbaikan tampilan HP
- **Command Center Hari-H** tidak lagi melebar ke samping.
- Kartu statistik **Refund** menjadi 2 kolom, tidak lagi 4 kartu besar bertumpuk.
- Footer dashboard peserta ("APTFI · Pelatihan Preseptor 2026 / Beranda") sekarang rata tengah.

### File

Baru:
```text
lib/ui-feedback.js
components/UiFeedbackHost.js
components/FeedbackBridge.js
```

Diubah:
```text
app/layout.js
app/globals.css
components/AdminDashboard.js
components/AssessmentAdmin.js
components/AssessmentParticipantPanel.js
components/CheckinPage.js
components/DayHOperations.js
components/MasterDataAdmin.js
components/ParticipantDashboard.js
components/ParticipantProfile.js
components/RefundManagement.js
components/SelfServiceRequestsAdmin.js
components/SpecialParticipantsAdmin.js
components/TestParticipantsAdmin.js
```

Untuk pengembangan berikutnya, gunakan:

```js
import { toast, confirmDialog } from '../lib/ui-feedback';

toast.success('Tersimpan.');
toast.error('Gagal menyimpan.');

if (!await confirmDialog({
  title: 'Hapus data?',
  description: '...',
  confirmLabel: 'Hapus',
  tone: 'danger',
})) return;
```

Jangan pakai `alert()` atau `confirm()` bawaan browser.

## Instalasi

1. Pastikan lokal sudah v0.7.1.
2. Stop `npm run dev`.
3. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
4. Tidak ada migration SQL dan tidak perlu `npm install`.
5. Jalankan `npm run dev`.

## Test checklist

### Notifikasi dan dialog
- **Admin → Data Homebase:** tambah atau edit homebase. Toast hijau muncul di kanan atas.
- **Toast gagal:** matikan sementara koneksi internet (DevTools → Network → Offline), lalu simpan sesuatu, misalnya **Pengaturan Pendaftaran**. Toast merah muncul.
- **Admin → Pelaksanaan → Posttest → Hasil:** klik **Reset** pada satu peserta (akun TEST). Dialog konfirmasi bergaya aplikasi muncul, bukan popup browser. Klik **Batal**, lalu ulangi dan klik **Ya, reset**. Toast hijau muncul.
- **Peserta (akun TEST) → Posttest:** kirim jawaban. Dialog konfirmasi aplikasi muncul, lalu toast berisi nilai attempt.
- **Peserta → Kehadiran:** check-in mandiri. Toast "Presensi berhasil dicatat."
- **Di HP:** toast muncul di bawah tengah dan tidak menutupi tombol WhatsApp.

### Tampilan
- Pencarian di Hari-H, Data Homebase, Pendaftar, dan Hasil Pretest tampil seragam.
- Tabel Pendaftar, Peserta Khusus, Refund, Hari-H, dan Hasil assessment memiliki header dan baris yang sama.
- Status form tampil **Ditutup/Dibuka**, dan status batch refund dalam bahasa Indonesia.
- Di HP: Command Center Hari-H tidak bisa digeser ke samping, dan kartu Refund tampil 2 kolom.

## Perintah git

```powershell
git status
npm run build
npm run audit:prod
git add .
git commit -m "Standardize UI feedback, dialogs, tables and search v0.7.2"
git push origin main
```

`git status` harus menampilkan 14 file diubah dan 4 file baru (3 file kode + `README-UPDATE-v0.7.2.md`).

Jika ingin membatalkan sebelum commit:

```powershell
git restore .
git clean -fd -n
```

## Migration / Dependency

- SQL migration: **TIDAK**
- npm install: **TIDAK**
