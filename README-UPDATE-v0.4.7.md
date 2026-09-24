# APTFI Preseptor Web App — Update v0.4.7

## Fokus update
Hotfix produksi untuk error **`Failed to fetch` saat submit pendaftaran / upload dokumen**, terutama dari perangkat mobile atau file kamera yang ukurannya besar.

## Root cause
Sebelum v0.4.7, tiga dokumen peserta (STRA, bukti pengalaman, bukti pembayaran) dikirim dalam **satu multipart POST** ke Next.js/Vercel Function.

Form mengizinkan sampai **5 MB per file**, sehingga total request bisa jauh di atas batas request body Vercel Function (4.5 MB). Pada sebagian browser/jaringan kondisi ini muncul sebagai `Failed to fetch` sebelum route aplikasi sempat memproses request.

## Perubahan v0.4.7
- Dokumen tidak lagi melewati Vercel Function.
- API hanya menyiapkan **signed upload token**.
- Browser upload file langsung ke private Supabase Storage.
- Setelah semua file sukses, browser melakukan request kecil untuk finalisasi pendaftaran.
- Server tetap memverifikasi signature file JPG/PNG/PDF sebelum registration dianggap selesai.
- Alur upload ulang STRA / pengalaman / bukti bayar dari Dashboard Peserta juga memakai direct upload.
- Pesan progress upload ditampilkan di form.
- Pesan error network dibuat lebih ramah.
- File tetap private; token upload hanya berlaku sementara dan hanya untuk path yang telah ditentukan server.

## File baru/berubah
- `lib/direct-upload.js`
- `lib/direct-upload-client.js`
- `components/RegistrationForm.js`
- `components/ParticipantDashboard.js`
- `app/api/register/prepare/route.js`
- `app/api/register/finalize/route.js`
- `app/api/me/uploads/prepare/route.js`
- `app/api/me/requirements/route.js`
- `app/api/me/payment/route.js`
- `app/globals.css`
- `supabase/migrations/010_direct_storage_uploads.sql`

## Cara update dari v0.4.6
1. Backup/commit project terlebih dahulu.
2. Stop dev server.
3. Extract patch ke root project dan pilih **Replace / Yes to All**.
4. Jalankan migration berikut di Supabase SQL Editor:
   `supabase/migrations/010_direct_storage_uploads.sql`
5. Tidak ada dependency baru. `npm install` tidak wajib.
6. Jalankan:
   `npm run dev`
7. Test pendaftaran dengan tiga file, termasuk dari HP/mobile data.
8. Test peserta legacy mengunggah STRA + bukti pengalaman dari dashboard.
9. Jalankan:
   `npm run build`
10. Jika sukses, commit dan push ke `main`.

## Test minimum
- Submit peserta baru dengan 3 dokumen.
- Gunakan minimal satu file berukuran beberapa MB untuk membuktikan request tidak lagi dibatasi body Vercel.
- Pastikan nomor pendaftaran terbentuk dan ketiga dokumen bisa dibuka admin.
- Test upload ulang persyaratan peserta legacy.
- Test upload ulang bukti pembayaran yang ditolak.
- Pastikan data duplicate tetap diblokir.

## Rollback
Rollback commit Git ke v0.4.6. Tabel `registration_upload_sessions` aman dibiarkan jika rollback; tabel tersebut hanya digunakan oleh v0.4.7+.
