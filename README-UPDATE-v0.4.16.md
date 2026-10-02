# APTFI Preseptor Web App — Update v0.4.15 → v0.4.16

## Ringkasan
v0.4.16 menambahkan penolakan pendaftaran final, memperbaiki perhitungan kuota untuk peserta yang ditolak, serta menutup akses publik ke `/daftar` ketika tidak ada mode pendaftaran yang tersedia.

## 1. Penolakan pendaftaran final
Admin Event / Super Admin dapat menolak pendaftaran dari **Pendaftar → Lihat detail → Tolak pendaftaran** apabila minimal satu dokumen (STRA, bukti pengalaman, atau bukti pembayaran) sudah berstatus **Ditolak**.

Saat disetujui:
- `lifecycle_status` menjadi `rejected`;
- peserta tidak lagi dihitung sebagai pendaftar aktif;
- kuota Online/Offline peserta tersebut otomatis kembali tersedia;
- akses acara dinonaktifkan;
- profil dan unggah perbaikan dikunci;
- data pendaftaran tidak dihapus dan tetap tersedia untuk audit;
- peserta mendapat email penolakan beserta alasan.

Jika pembayaran sudah **Terverifikasi**, peserta yang ditolak tetap dapat login dan mengajukan refund dari **Profil Saya**. Refund dikelola dari menu Refund seperti pengajuan lainnya.

## 2. Definisi pendaftar aktif
Mulai v0.4.16 hanya lifecycle berikut yang memakai kuota:
- `active`
- `withdrawal_requested`

Lifecycle berikut tidak memakai kuota:
- `withdrawn`
- `rejected`

Perhitungan ini dipakai oleh homepage, form publik, manajemen kuota, perubahan mode oleh admin, dan validasi pendaftaran baru.

## 3. Homepage dan `/daftar`
Jika tidak ada mode yang tersedia (Online dan Offline sama-sama ditutup/belum dibuka/penuh):
- tombol **Daftar Sekarang** pada homepage otomatis disabled;
- akses langsung ke `/daftar` akan diarahkan kembali ke homepage;
- API pendaftaran tetap melakukan validasi server-side sehingga request paksa tetap ditolak.

## 4. Kasus calon peserta khusus
Untuk peserta dari universitas tertentu yang akan diberi akses setelah pendaftaran publik ditutup, rekomendasi adalah **opsi B** (admin membuat peserta/invite khusus), bukan membuka form publik selama 60 menit.

Alasan:
- tidak membuka kesempatan pendaftaran untuk publik lain;
- identitas peserta dapat dibatasi berdasarkan data yang diberikan universitas;
- kuota dapat direservasi secara eksplisit;
- audit trail lebih jelas;
- tidak tergantung peserta membuka form tepat pada jendela 60 menit.

Fitur import/invite khusus **belum diaktifkan pada v0.4.16** agar perubahan lifecycle dan penutupan form dapat distabilkan terlebih dahulu. Implementasi disarankan sebagai update berikutnya setelah format data calon peserta disepakati.

## Instalasi
Baseline: **v0.4.15**.

1. Stop dev server.
2. Extract patch ke root project dan Replace/Yes to All.
3. Jalankan migration **hanya**:

```text
supabase/migrations/013_registration_rejection.sql
```

4. Jalankan sekali:

```powershell
node scripts/apply-v0.4.16.mjs
```

Script ini menyelaraskan route lama yang mungkin masih menghitung `withdrawn` saja (mis. finalize/payment upload) dengan lifecycle baru `rejected`.

5. Tidak ada dependency baru. `npm install` tidak diperlukan.
6. Jalankan:

```powershell
npm run dev
```

## Checklist test
### Penolakan pendaftaran
1. Gunakan peserta test aktif.
2. Tolak salah satu dokumen (STRA/EXP/PAY).
3. Buka **Lihat detail**.
4. Klik **Tolak pendaftaran**.
5. Isi alasan dan konfirmasi.
6. Pastikan status menjadi `Pendaftaran ditolak`.
7. Pastikan jumlah pendaftar aktif pada Ringkasan turun 1 dan kuota mode bertambah 1.
8. Pastikan peserta masih ada pada filter **Pendaftaran ditolak**.

### Refund peserta ditolak
1. Gunakan peserta dengan pembayaran `Terverifikasi`.
2. Tolak salah satu dokumen persyaratan lalu tolak pendaftarannya.
3. Login sebagai peserta.
4. Pastikan Profil Saya menampilkan status pendaftaran ditolak.
5. Pastikan form **Ajukan refund** tersedia.
6. Ajukan refund dan pastikan muncul pada menu Admin → Refund.

### Penutupan form
1. Set Online dan Offline sama-sama ditutup.
2. Buka homepage: tombol **Daftar Sekarang** harus disabled.
3. Ketik langsung `/daftar`: harus kembali ke homepage.
4. Buka kembali salah satu mode: tombol homepage aktif lagi dan `/daftar` dapat diakses.

## Build dan deploy
Setelah test lokal berhasil:

```powershell
npm run build
npm run audit:prod

git add .
git commit -m "Add registration rejection and closed-form guard v0.4.16"
git push origin main
```

## Catatan Day-H
Day-H Operations tetap ditunda sampai 6 Oktober dan harus dibangun di atas baseline terbaru setelah v0.4.16 stabil.
