# APTFI Preseptor Web App — Update v0.4.8

## Fokus update
Hotfix Dashboard Peserta untuk error:

`Failed to construct 'FormData': parameter 1 is not of type 'HTMLFormElement'.`

Error muncul saat peserta legacy melengkapi/memperbaiki STRA + bukti pengalaman, dan berpotensi muncul juga saat peserta mengunggah ulang bukti pembayaran yang ditolak.

## Root cause
Handler submit melakukan operasi asynchronous (`await token()`) sebelum membuat `FormData` dari `e.currentTarget`.

Setelah event handler melewati `await`, referensi `e.currentTarget` tidak lagi aman digunakan sebagai elemen `<form>` dan pada browser tertentu dapat menjadi `null`. Akibatnya `new FormData(e.currentTarget)` gagal.

## Perubahan v0.4.8
- Referensi elemen form disimpan **sebelum operasi asynchronous**.
- FormData dibuat dari referensi form yang stabil.
- Perbaikan diterapkan pada:
  - upload/perbaikan STRA + bukti pengalaman;
  - upload ulang bukti pembayaran.
- Tidak ada perubahan database, storage schema, atau API contract.

## File berubah
- `components/ParticipantDashboard.js`

## Cara update dari v0.4.7
1. Backup/commit project terlebih dahulu.
2. Stop dev server.
3. Extract patch ke root project dan pilih **Replace / Yes to All**.
4. **Tidak ada migration SQL.**
5. **Tidak ada dependency baru.** `npm install` tidak wajib.
6. Jalankan:
   `npm run dev`
7. Login sebagai peserta legacy yang status persyaratannya belum lengkap.
8. Isi Nomor STRA, kategori/profesi, upload STRA dan bukti pengalaman, lalu klik **Kirim Perbaikan Dokumen**.
9. Pastikan pesan sukses tampil dan admin melihat dokumen STRA + EXP sebagai `pending`.
10. Jalankan:
    `npm run build`
11. Jika sukses, commit dan push ke `main`.

## Test minimum
- Peserta legacy mengunggah STRA + bukti pengalaman.
- Refresh dashboard peserta: status berubah menjadi menunggu verifikasi.
- Admin dapat membuka STRA dan EXP yang baru diunggah.
- Jika tersedia kasus pembayaran rejected, test upload ulang bukti pembayaran.

## Rollback
Rollback commit Git ke v0.4.7. Tidak ada perubahan database yang perlu di-rollback.
