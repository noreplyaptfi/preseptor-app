# APTFI Preseptor — Update v0.4.8 → v0.4.9

## Versi
**v0.4.9 — Participant Profile, Self-Service & Refund Management**

> Baseline update ini adalah **v0.4.8**. Patch v0.5.0 Day-H yang dibuat sebelumnya **JANGAN dipasang**. Setelah v0.4.9 stabil, Day-H akan direbase menjadi v0.5.0 baru dengan migration berikutnya.

## Yang ditambahkan

### Dashboard Peserta — Profil Saya
- Edit gelar depan, nama utama, gelar belakang.
- Preview format nama dokumen/sertifikat.
- Edit WhatsApp dan Homebase.
- Edit STRA dan data profesional.
- Perubahan STRA → dokumen STRA kembali `pending`.
- Perubahan profesi/pengalaman → bukti pengalaman kembali `pending`.
- Pengajuan perubahan email (perlu approval panitia).
- Pengajuan perubahan Online/Offline (perlu approval dan validasi kuota).
- Riwayat pengajuan dan catatan review.

### Pengunduran diri
- Peserta dapat mengajukan pengunduran diri.
- Admin dapat membuat pengajuan atas nama peserta.
- Status lifecycle: `active` → `withdrawal_requested` → `withdrawn`.
- Withdrawal tidak menghapus data lama.
- Peserta withdrawn tidak mendapatkan akses acara.

### Refund
- Refund dapat diajukan bersamaan dengan withdrawal.
- Peserta yang sudah withdrawn juga dapat mengajukan refund terpisah.
- Data bank, nomor rekening, nama pemilik rekening.
- Status: Requested → Under Review → Ready → Processing → Refunded.
- Antrean refund di Dashboard Panitia.
- Batch refund untuk transfer serentak.
- Export batch ke `.xlsx`.
- Batch dapat ditandai selesai dan mengirim email status ke peserta.
- Daftar menampilkan rekening masked; nomor lengkap tersedia untuk role pengelola refund.

### Data Master Form
Menu Admin → **Data Master**:
- CRUD/soft-delete Jenis Tempat Praktik.
- Minimal masa pengalaman per jenis tempat praktik.
- Urutan dropdown.
- Aktif/nonaktif.
- Label/status/urutan Jenis Peserta dapat disesuaikan; key sistem tidak ditambah bebas karena terkait rule aplikasi.
- Form pendaftaran baru dan form profil menggunakan Data Master database.

### Admin edit participant
- Gelar depan / nama utama / gelar belakang.
- Dropdown profesi menggunakan Data Master.
- Email admin edit tetap sinkron dengan Supabase Auth.
- Reset verifikasi otomatis bila STRA/profesi berubah.

## File penting
- `supabase/migrations/011_participant_profile_self_service_refund.sql`
- `components/ParticipantProfile.js`
- `components/SelfServiceRequestsAdmin.js`
- `components/RefundManagement.js`
- `components/MasterDataAdmin.js`
- `lib/master-data.js`
- `lib/profile.js`
- `lib/self-service.js`

## Cara install

1. Pastikan project masih **v0.4.8** dan patch Day-H v0.5.0 lama belum pernah dipasang.
2. Stop dev server.
3. Extract isi patch ini ke root project `D:\projects\aptfi-preseptor` dan pilih **Replace / Yes to All**.
4. Buka Supabase → SQL Editor.
5. Jalankan **hanya**:

```text
supabase/migrations/011_participant_profile_self_service_refund.sql
```

6. Tidak ada dependency baru. `npm install` **tidak wajib**.
7. Jalankan:

```powershell
npm run dev
```

## Test checklist lokal

### A. Profil peserta
- Login peserta.
- Buka **Profil Saya**.
- Ubah typo nama/gelar/WhatsApp/Homebase → harus langsung tersimpan.
- Ubah STRA → status persyaratan menjadi Menunggu dan STRA perlu diverifikasi ulang admin.
- Ubah data praktik/pengalaman → bukti pengalaman kembali Menunggu.

### B. Request email dan mode
- Ajukan email baru → muncul di Admin → Permintaan.
- Approve → email di registration + Supabase Auth berubah bersama.
- Ajukan Online ↔ Offline → approve hanya jika kuota tujuan tersedia.

### C. Withdrawal
- Peserta mengajukan pengunduran diri.
- Admin → Permintaan → Setujui.
- Participant lifecycle menjadi `withdrawn`.
- Akses acara participant harus terkunci.

### D. Withdrawal + Refund
Gunakan peserta test dengan pembayaran **Terverifikasi**.
- Ajukan withdrawal + centang refund.
- Isi rekening test yang aman (jangan rekening peserta asli untuk testing screenshot/log).
- Approve withdrawal.
- Admin → Refund → refund menjadi **Siap diproses**.

### E. Batch refund
- Pilih beberapa refund `Ready`.
- Klik **Buat Batch**.
- Refund berubah `Processing`.
- Export Excel batch dan periksa kolom bank/rekening/nominal.
- Klik **Tandai Selesai** → refund menjadi `Refunded`.

### F. Data Master
- Admin → Data Master.
- Tambahkan jenis tempat praktik test.
- Pastikan muncul di `/daftar` dan Profil Saya.
- Nonaktifkan opsi → tidak muncul untuk pilihan baru, tetapi data participant lama tidak hilang.

## Catatan keamanan
Data rekening refund adalah data sensitif. Jangan memasukkan file export refund ke Git/GitHub, Google Drive publik, atau chat publik. Hapus file lokal setelah proses rekonsiliasi selesai sesuai prosedur APTFI.

## Build sebelum production

```powershell
npm run build
npm run audit:prod
```

Jika lolos:

```powershell
git add .
git commit -m "Add participant self-service and refund management v0.4.9"
git push origin main
```

## Setelah v0.4.9 stabil
Day-H Operations akan dibuat ulang sebagai **v0.5.0 berbasis v0.4.9**. Migration Day-H lama `011_day_h_operations_core.sql` tidak boleh dijalankan karena nomor `011` sekarang digunakan oleh v0.4.9.
