# APTFI Preseptor v0.4.18 — Special Participant Import & Sidebar Grouping

Baseline: **v0.4.17**

## Perubahan

### Peserta Khusus
- Homebase dikeluarkan dari input manual dan import peserta khusus.
- Format import sekarang: **Nama | Email | WhatsApp | Mode**.
- Mode tetap wajib dan harus `Online` atau `Offline` karena langsung memakai kuota masing-masing.
- Homebase peserta khusus dibuat kosong/belum dilengkapi dan wajib dipilih sendiri peserta melalui **Profil Saya** setelah login.
- Peserta khusus baru dibuat dengan `requirements_status = incomplete` sampai profil/dokumen dilengkapi.
- Tabel Peserta Khusus menampilkan **Belum dilengkapi** untuk Homebase yang masih kosong.
- Email onboarding mengingatkan peserta untuk memilih Homebase dari Profil Saya.

### Sidebar Admin
Menu admin dikelompokkan menjadi accordion agar lebih ringkas:
- **Peserta**: Pendaftar, Permintaan, Peserta Khusus
- **Keuangan**: Refund
- **Pendaftaran**: Status Form, Pengumuman
- **Pelaksanaan**: Akses Acara, Scan QR
- **Data & Sistem**: Data Master, Data Homebase, Tim Panitia, Panduan Admin

Ringkasan tetap berada paling atas sebagai menu utama.

Menu mengikuti role yang sudah ada. Group yang berisi halaman aktif otomatis terbuka. Saat sidebar sedang collapsed dan group diklik, sidebar akan diperluas terlebih dahulu.

## Database / dependency
- SQL migration baru: **tidak ada**
- `npm install`: **tidak perlu**

Migration v0.4.17 (`014_special_participant_enrollment.sql`) tetap digunakan dan tidak perlu dijalankan ulang jika sebelumnya sudah berhasil.

## Test checklist
1. Admin > Peserta Khusus > tambah satu peserta tanpa Homebase.
2. Pastikan hanya Nama, Email, WhatsApp, dan Mode yang diminta.
3. Import dengan 4 kolom dari Excel/Google Sheets.
4. Pastikan participant berhasil dibuat dan kuota mode berkurang.
5. Login sebagai participant khusus, buka Profil Saya, pilih Homebase, lalu simpan.
6. Pastikan Homebase tersimpan dari Data Homebase, bukan teks bebas dari import.
7. Cek seluruh group sidebar: buka/tutup accordion dan akses setiap submenu sesuai role.
8. Coba collapse sidebar, lalu klik salah satu group: sidebar harus expand kembali.

## Setelah test
```powershell
npm run build
npm run audit:prod

git add .
git commit -m "Simplify special participant import and group admin sidebar v0.4.18"
git push origin main
```
