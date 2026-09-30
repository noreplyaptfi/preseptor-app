# APTFI Preseptor App — Update v0.4.10 → v0.4.11

## Fokus versi
v0.4.11 adalah patch UI/UX untuk Participant Self-Service, Withdrawal, Refund, dan beberapa dialog admin.

Perubahan utamanya:

1. **Menghapus native browser dialog pada flow terkait**
   - `confirm()` pada pembatalan pengajuan peserta diganti custom modal.
   - `prompt()/confirm()` pada review permintaan peserta dan refund admin diganti custom modal.
   - dialog nonaktifkan homebase dan input link pengumuman admin juga memakai custom modal.

2. **Konfirmasi sebelum pengunduran diri**
   - tombol `Ajukan Pengunduran Diri` tidak lagi langsung mengirim request ke server.
   - browser terlebih dahulu menampilkan custom modal konfirmasi.
   - jika refund ikut diajukan, modal menampilkan ringkasan Bank, nomor rekening yang dimasking, dan nama pemilik rekening.
   - request baru dibuat setelah peserta menekan `Ya, lanjutkan pengajuan`.

3. **Konfirmasi pengajuan refund**
   - pengajuan refund terpisah juga mendapat review/confirmation modal sebelum dikirim.

4. **Layout form diperbaiki**
   - grid nama/gelar lebih fleksibel dan tidak memakai minimum width besar yang menyebabkan horizontal overflow.
   - Bank + No. Rekening menjadi dua kolom yang fleksibel.
   - Nama Pemilik Rekening menggunakan satu baris penuh.
   - pada mobile semua field otomatis menjadi satu kolom.
   - layout admin request/refund dibuat lebih tahan terhadap viewport/tablet yang sempit.

5. **Refund admin tanpa prompt browser**
   - Edit data refund.
   - Siapkan refund dan nominal approved.
   - Tolak refund beserta alasan.
   - Buat batch refund.
   - Tandai batch selesai + referensi transfer.
   - Batalkan batch.

6. **Review Permintaan tanpa prompt browser**
   - Setujui / Tolak menggunakan modal.
   - alasan penolakan wajib diisi di modal.
   - pengunduran diri yang dibuat admin atas nama peserta mendapat konfirmasi sebelum dibuat.

## File yang berubah

- `app/globals.css`
- `components/ActionDialog.js` (baru)
- `components/ParticipantProfile.js`
- `components/SelfServiceRequestsAdmin.js`
- `components/RefundManagement.js`
- `components/AdminDashboard.js`

## Database migration

**Tidak ada migration SQL baru.**

Jangan menjalankan migration apa pun untuk v0.4.11.

## Dependency

**Tidak ada dependency baru.**

`npm install` tidak diperlukan bila project v0.4.10 sudah berjalan normal.

## Cara update

1. Pastikan baseline project adalah **v0.4.10**.
2. Stop dev server.
3. Extract isi patch ke root project dan pilih **Replace / Yes to All**.
4. Jalankan:

```powershell
npm run dev
```

## Test checklist wajib

### Peserta — withdrawal
1. Login peserta aktif.
2. Buka `Profil Saya`.
3. Isi alasan pengunduran diri.
4. Klik `Ajukan Pengunduran Diri`.
5. Pastikan **belum ada request baru sebelum modal dikonfirmasi**.
6. Pastikan custom modal muncul, bukan dialog `localhost says`.
7. Klik `Kembali` → tidak ada request baru.
8. Buka lagi → klik `Ya, lanjutkan pengajuan` → request baru tercatat.

### Peserta — withdrawal + refund
1. Gunakan peserta dengan pembayaran `Terverifikasi`.
2. Centang `Sekaligus ajukan refund`.
3. Isi bank, rekening, pemilik rekening.
4. Klik Ajukan.
5. Pastikan modal menampilkan ringkasan refund dan nomor rekening dimasking.
6. Confirm dan cek data muncul pada admin.

### Peserta — pembatalan pengajuan
1. Pada riwayat pengajuan yang masih `Menunggu review`, klik `Batalkan`.
2. Pastikan custom modal muncul.
3. Cancel modal → status tidak berubah.
4. Confirm → status menjadi dibatalkan.

### Responsive layout
Cek minimal:
- desktop lebar,
- laptop/tablet sekitar 768–1100 px,
- mobile sekitar 390 px.

Pastikan:
- tidak ada horizontal scrollbar karena form profil/refund,
- Nama Pemilik Rekening tidak terpotong,
- gelar/nama/homebase tidak saling menabrak,
- tombol tidak keluar card.

### Admin — Permintaan
- Setujui request → modal custom.
- Tolak request → alasan wajib.
- Buat withdrawal atas nama peserta → modal konfirmasi.

### Admin — Refund
- Edit refund.
- Siapkan refund.
- Tolak refund.
- Buat batch.
- Tandai selesai.
- Batalkan batch.

Semua harus menggunakan custom modal, bukan `prompt()` / `confirm()` browser.

### Admin tambahan
- Nonaktifkan Homebase → custom modal.
- Pengumuman → toolbar Link → custom modal input URL.

## Build sebelum production

```powershell
npm run build
npm run audit:prod
```

Jika berhasil:

```powershell
git add .
git commit -m "Fix self-service confirmation and responsive UX v0.4.11"
git push origin main
```

## Catatan v0.5.0
Patch Day-H Operations v0.5.0 lama (yang berbasis v0.4.8) **tetap jangan dipasang**.
Day-H Operations akan dibuat ulang/rebase setelah baseline v0.4.11 ini stabil.
