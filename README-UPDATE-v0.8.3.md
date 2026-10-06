# APTFI Preseptor — Update v0.8.2 → v0.8.3

## Pengumuman: email hanya ke peserta aktif + konfirmasi sebelum kirim

Baseline: **v0.8.2**. Tidak ada migration dan tidak ada dependency baru.

### Masalah sebelumnya
- Pilihan penerima **Semua / Online / Offline** ikut mengirim email ke peserta yang **ditolak** atau **mengundurkan diri**.
- Pilihan **Peserta terverifikasi** juga masih memuat peserta yang mundur atau ditolak setelah sempat terverifikasi.
- Sekali klik **Publikasikan & kirim email**, email langsung terkirim tanpa konfirmasi.

### Perbaikan
- Email pengumuman hanya dikirim ke peserta **aktif**. Status *aktif* dan *mengajukan pengunduran diri* (belum disetujui) tetap menerima. Status *ditolak* dan *mengundurkan diri* tidak menerima.
- Pilihan penerima diberi nama yang jelas:
  - **Semua peserta aktif**
  - **Peserta aktif terverifikasi**
  - **Peserta aktif Online**
  - **Peserta aktif Offline**
- Di bawah pilihan penerima tampil **jumlah penerima email** yang akan dikirimi.
- Sebelum mengirim muncul **dialog konfirmasi**: subject, jumlah penerima, dan peringatan bahwa email tidak bisa dibatalkan.
- Jumlah di layar dan jumlah yang dikirim server memakai aturan yang sama (`lib/announcement-audience.js`).
- Yang tetap sama:
  - aturan siapa yang **melihat** pengumuman di dashboard;
  - email yang ditandai perlu diperbarui atau email bawaan migrasi tetap tidak dikirimi;
  - Akun Uji (email panitia) tetap menerima, sehingga bisa dipakai untuk mengecek tampilan email.

### File
Baru:
- `lib/announcement-audience.js`
- `README-UPDATE-v0.8.3.md`

Diubah:
- `lib/announcement.js`
- `app/api/admin/announcements/route.js`
- `components/AdminDashboard.js`
- `app/globals.css`

### Pasang & test
1. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
2. Jalankan `npm run dev`.
3. Admin → **Pengumuman** → ganti pilihan Penerima. Jumlah penerima berubah, dan peserta ditolak/mundur tidak ikut terhitung.
4. Klik **Publikasikan & kirim email** → muncul dialog konfirmasi → **Batal** tidak mengirim apa pun.

### Push
```powershell
npm run build
npm run audit:prod
git add .
git commit -m "Announcements: email only active participants, confirm before sending v0.8.3"
git push origin main
```

### Migration / Dependency
- SQL migration: **TIDAK**
- npm install: **TIDAK**
