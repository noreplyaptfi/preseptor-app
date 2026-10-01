# APTFI Preseptor — Update v0.4.12

**Sumber:** v0.4.11  
**Target:** v0.4.12  
**Tema:** Active Registration Quota & Quota Management

## Penting

Patch ini dibuat untuk project yang saat ini masih berada di **v0.4.11**.

**Jangan pasang patch v0.5.0 Day-H yang sebelumnya dibuat dari v0.4.11.** Setelah v0.4.12 stabil, v0.5.0 Day-H perlu direbase lagi di atas v0.4.12.

## Perubahan utama

### 1. Pengunduran diri yang disetujui langsung melepas kuota

Status `withdrawal_requested` **masih dihitung sebagai pendaftar** karena pengajuan belum disetujui.

Setelah panitia menyetujui pengunduran diri:

```text
active / withdrawal_requested
        ↓ approve
withdrawn
        ↓
tidak dihitung dalam kuota
```

Contoh:

```text
Offline: 50 / 50

1 peserta Offline disetujui mengundurkan diri

Offline: 49 / 50
Sisa: 1
```

Data peserta tidak dihapus. Peserta tetap tersimpan sebagai arsip `withdrawn` untuk refund, audit log, dan laporan historis.

### 2. Dashboard admin memakai jumlah peserta aktif

Ringkasan berikut sekarang tidak memasukkan peserta `withdrawn`:

- Total pendaftar
- Kuota terisi
- Online terisi
- Offline terisi
- Dokumen pending
- Pembayaran pending
- Terverifikasi lengkap
- Statistik akses acara
- badge jumlah Pendaftar di sidebar
- daftar Pendaftar terbaru

Di menu **Pendaftar**, filter awal sekarang adalah **Pendaftar aktif**.

Filter tambahan:

- Pendaftar aktif
- Semua termasuk arsip
- Mengundurkan diri
- Dokumen pending
- Pembayaran pending
- Terverifikasi lengkap
- Ditolak

Peserta yang sudah `withdrawn` tetap bisa dicari melalui filter **Mengundurkan diri** / **Semua termasuk arsip**.

### 3. Dashboard langsung refresh setelah approval

Setelah Super Admin / Admin Event menyetujui atau menolak pengajuan melalui menu **Permintaan**, data dashboard utama ikut dimuat ulang.

Jadi setelah approval withdrawal, kuota dan jumlah pendaftar langsung berubah tanpa perlu refresh browser manual.

### 4. Manajemen kuota oleh admin

Buka:

```text
Admin → Status Form → Manajemen kuota
```

Role yang dapat mengubah:

- `super_admin`
- `event_admin`

Admin dapat mengatur:

- Kuota Online
- Kuota Offline

`quota_total` dihitung otomatis:

```text
Total = Online + Offline
```

Contoh redistribusi:

```text
Sebelum:
Online  = 150
Offline = 50
Total   = 200

Sesudah:
Online  = 165
Offline = 35
Total   = 200
```

Atau total keseluruhan juga dapat berubah dengan mengubah dua kapasitas tersebut.

### 5. Proteksi agar kuota tidak merusak data

Sistem menolak perubahan jika kuota baru lebih kecil dari jumlah peserta aktif.

Contoh:

```text
Offline aktif = 42
Admin mencoba kuota Offline = 35

→ Ditolak
```

Pesan:

```text
Kuota Offline tidak boleh lebih kecil dari 42 peserta aktif saat ini.
```

Validasi ini dilakukan di server, bukan hanya input browser.

### 6. Form publik mengikuti kuota baru

Endpoint public availability sekarang menghitung hanya peserta yang belum `withdrawn`.

Artinya jika sebuah mode sebelumnya penuh lalu satu peserta mengundurkan diri dan disetujui, slot tersebut otomatis tersedia kembali pada form pendaftaran.

**Angka kuota dan jumlah peserta tetap tidak diekspos ke publik.** Form publik hanya menerima status tersedia / penuh.

## File pada patch

```text
app/api/admin/quota/route.js
app/api/public/settings/route.js
app/globals.css
components/AdminDashboard.js
components/SelfServiceRequestsAdmin.js
README-UPDATE-v0.4.12.md
```

## SQL migration

**Tidak ada migration SQL baru.**

Kolom berikut sudah tersedia dari versi sebelumnya:

```text
events.quota_total
events.quota_online
events.quota_offline
registrations.lifecycle_status
```

Jadi **jangan menjalankan SQL tambahan** untuk v0.4.12.

## npm install

Tidak ada dependency baru.

```text
npm install TIDAK PERLU
```

## Instalasi lokal

1. Pastikan project saat ini v0.4.11.
2. Stop development server.
3. Extract patch ke root project:

```text
D:\projects\aptfi-preseptor
```

4. Pilih **Replace / Yes to All**.
5. Jalankan:

```powershell
npm run dev
```

## Checklist test

### A. Withdrawal mengurangi kuota

1. Catat jumlah pendaftar aktif Online / Offline.
2. Gunakan peserta test yang masih aktif.
3. Ajukan pengunduran diri.
4. Pastikan saat status masih `Menunggu review`, jumlah kuota **belum berubah**.
5. Admin → Permintaan → Setujui.
6. Pastikan:
   - peserta menjadi `Mengundurkan diri`;
   - total pendaftar aktif turun 1;
   - mode peserta tersebut turun 1;
   - sisa kuota bertambah 1.

### B. Arsip peserta

Admin → Pendaftar:

- default **Pendaftar aktif** tidak menampilkan peserta withdrawn;
- filter **Mengundurkan diri** menampilkan peserta tersebut;
- detail dan riwayat tetap bisa dibuka.

### C. Manajemen kuota

Admin → Status Form → Manajemen kuota.

Tes contoh:

```text
Online 150 → 160
Offline 50 → 40
```

Klik **Simpan kuota**.

Pastikan Ringkasan menampilkan kuota baru.

### D. Proteksi

Jika Offline aktif 42, coba isi:

```text
Kuota Offline = 41
```

Expected: request ditolak dan kuota lama tidak berubah.

### E. Public registration

Jika mode penuh, mode harus disabled pada `/daftar`.

Setelah salah satu peserta mode tersebut disetujui mengundurkan diri, refresh `/daftar`. Mode harus kembali tersedia jika jumlah aktif sudah di bawah kuota.

## Build sebelum production

```powershell
npm run build
npm run audit:prod
```

Jika semua lolos:

```powershell
git add .
git commit -m "Fix active quota accounting and add quota management v0.4.12"
git push origin main
```

## Setelah v0.4.12

Setelah patch ini stabil di production, lanjutkan ke **v0.5.0 Day-H Operations versi baru yang direbase dari v0.4.12**.
