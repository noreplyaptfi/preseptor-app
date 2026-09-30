# APTFI Preseptor Web App — Update v0.4.10

Update dari **v0.4.9 → v0.4.10**.

Fokus update ini adalah **UI/UX polish** setelah alur Participant Profile, Permintaan Peserta, Withdrawal, dan Refund pada v0.4.9 dinyatakan sudah berjalan dengan baik.

## Perubahan utama

### 1. Select/dropdown lebih konsisten
- Filter **Permintaan Peserta** tidak lagi memakai tampilan native browser.
- Filter **Antrean Refund** memakai komponen visual yang sama dengan field lain.
- Dropdown di Profil Peserta mendapat arrow, border, focus state, dan disabled state yang konsisten.

### 2. Checkbox refund diperbaiki
- Checkbox `Sekaligus ajukan refund` dibuat lebih modern dan konsisten.
- Seluruh area kartu refund lebih jelas bahwa dapat dipilih.
- State checked/focus/disabled lebih mudah dibaca.

### 3. Layout rekening refund diperbaiki
- Field Bank, Nomor Rekening, dan Nama Pemilik tidak lagi terlalu sempit.
- Nama pemilik mendapat ruang lebih besar.
- Ringkasan estimasi refund menggunakan satu baris penuh.
- Responsive desktop/tablet/mobile diperbaiki.

### 4. Profil peserta dirapikan
- Gelar depan dibuat lebih proporsional dan tidak mengambil ruang berlebihan.
- Nama utama mendapat ruang paling besar.
- Gelar belakang, WhatsApp, dan Homebase ditata ulang agar lebih natural.
- Input/select menggunakan tinggi dan spacing yang konsisten.

### 5. Riwayat pengajuan
- Tombol `Batalkan` tidak lagi tampil sebagai tombol native browser.
- Status dan aksi lebih rapi dan konsisten dengan design system aplikasi.

### 6. Refund admin
- Filter + tombol `Buat Batch` memiliki tinggi dan alignment yang konsisten.
- Checkbox pemilihan refund memakai design system aplikasi.

### 7. Sidebar admin
- Memperbaiki bug huruf **A** yang muncul di bawah logo pada sidebar expanded.
- `A` sekarang hanya tampil sebagai logo compact ketika sidebar benar-benar diciutkan.

### 8. Empty state
- Empty state pada Permintaan dan Batch Refund dibuat lebih compact agar tidak menyisakan ruang kosong yang berlebihan.

## Database

**Tidak ada migration SQL baru.**

Jangan menjalankan migration tambahan untuk v0.4.10.

## Dependency

**Tidak ada dependency baru.**

Tidak perlu menjalankan `npm install` bila v0.4.9 sudah terpasang.

## Instalasi

1. Pastikan project saat ini sudah v0.4.9.
2. Stop development server.
3. Extract patch v0.4.10 ke root project dan pilih Replace / Yes to All.
4. Jalankan:

```powershell
npm run dev
```

## Checklist test

### Dashboard Panitia → Permintaan
- [ ] Dropdown `Menunggu review` tampil sesuai design system.
- [ ] Empty state terlihat compact.
- [ ] Checkbox refund pada form `Ajukan atas nama peserta` rapi.
- [ ] Field rekening tidak terlalu sempit.

### Dashboard Panitia → Refund
- [ ] Dropdown `Aktif` rapi.
- [ ] `Buat Batch (0)` sejajar dengan filter.
- [ ] Checkbox tabel refund rapi.

### Dashboard Peserta → Profil Saya
- [ ] Gelar depan / Nama utama / Gelar belakang proporsional.
- [ ] Dropdown kategori dan tempat praktik rapi.
- [ ] Form tetap responsive.

### Withdrawal / Refund
- [ ] Checkbox `Sekaligus ajukan refund pembayaran` tampil modern.
- [ ] Bank / nomor rekening / pemilik rekening memiliki ruang cukup.
- [ ] Riwayat pengajuan menampilkan tombol `Batalkan` dengan style aplikasi.

### Sidebar Admin
- [ ] Logo penuh tampil tanpa huruf `A` tambahan saat sidebar expanded.
- [ ] Huruf `A` tampil hanya saat sidebar collapsed.

## Build sebelum production

```powershell
npm run build
npm run audit:prod
```

Jika berhasil:

```powershell
git add .
git commit -m "Polish participant and refund UI v0.4.10"
git push origin main
```

## Catatan versi

Patch **v0.5.0 Day-H lama tetap jangan dipasang**. Setelah v0.4.10 stabil, Day-H Operations akan dibuat ulang/rebase di atas baseline terbaru.
