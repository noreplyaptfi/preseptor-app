# APTFI Preseptor — Update v0.4.13 → v0.4.14

## Fokus update
Halaman utama sekarang memakai sumber status pendaftaran yang sama dengan halaman `/daftar` dan pengaturan **Status Form**.

Card yang sebelumnya menampilkan deadline statis seperti `1 Oktober 2026` diganti menjadi status per mode:

- Online: Dibuka / Ditutup / Kuota penuh / Belum dibuka
- Offline: Dibuka / Ditutup / Kuota penuh / Belum dibuka
- waktu buka/tutup mengikuti `online_registration_*` dan `offline_registration_*`
- kuota mengikuti perhitungan peserta aktif (peserta `withdrawn` tidak dihitung)
- tidak menampilkan angka kapasitas/sisa kuota kepada publik

Contoh:

```text
STATUS PENDAFTARAN

Online       Ditutup
Ditutup sejak 3 Oktober 2026 · 23.59 WIB

Offline      Dibuka
Sampai 6 Oktober 2026 · 23.59 WIB
```

Jika suatu mode penuh, homepage akan menampilkan `Kuota penuh` sebagaimana halaman pendaftaran.

## Penting
Baseline harus **v0.4.13**.

Patch ini tidak mengubah database.

- SQL migration: **tidak ada**
- npm install: **tidak perlu**
- Day-H Operations: **tetap ditunda** dan jangan memasang patch v0.5.0 lama

## Instalasi
1. Stop `npm run dev`.
2. Extract isi ZIP ke root project dan pilih Replace/Yes to All.
3. Karena halaman utama v0.4.13 masih berisi card deadline statis, jalankan sekali:

```powershell
node scripts/apply-v0.4.14.mjs
```

Script hanya mengganti elemen `.landing-info-card` dengan komponen baru dan menambahkan import yang diperlukan. Script aman dijalankan ulang (idempotent).

4. Jalankan:

```powershell
npm run dev
```

## Checklist test
### Test 1 — kedua mode masih buka
Atur Online dan Offline ke waktu future. Homepage harus menampilkan dua status `Dibuka` dengan deadline masing-masing.

### Test 2 — Online tutup, Offline buka
Atur Online ke waktu yang sudah lewat dan Offline ke future. Homepage harus menampilkan:

```text
Online   Ditutup
Offline  Dibuka
```

Halaman `/daftar` harus tetap disable Online dan memperbolehkan Offline.

### Test 3 — kuota penuh
Jika salah satu mode mencapai quota, homepage harus menampilkan `Kuota penuh` tanpa menampilkan angka quota.

### Test 4 — withdrawal
Setelah withdrawal disetujui dan slot kembali tersedia, status homepage dan `/daftar` harus kembali sinkron.

## Build & deploy
Setelah test:

```powershell
npm run build
npm run audit:prod

git add .
git commit -m "Sync homepage registration status v0.4.14"
git push origin main
```
