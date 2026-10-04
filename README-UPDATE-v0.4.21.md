# APTFI Preseptor — Update v0.4.20 → v0.4.21

## Initial Document & Payment Upload for Special Participants

Update ini memperbaiki flow peserta khusus hasil import admin yang sebelumnya dibuat dengan status pembayaran `pending`, tetapi belum memiliki `payment_proof`. Pada versi sebelumnya Dashboard Peserta hanya menampilkan form pembayaran ketika bukti pembayaran **ditolak**, sehingga peserta khusus yang belum pernah upload bukti pembayaran tidak memiliki tombol untuk mengunggah bukti pertama kali.

### Perubahan utama

1. **Upload bukti pembayaran pertama kali**
   - `payment_status = pending` + belum ada dokumen `payment_proof` → Dashboard menampilkan **Unggah bukti pembayaran**.
   - Setelah upload → bukti masuk dengan status `pending` dan menunggu verifikasi panitia.
   - `payment_status = rejected` → tetap menampilkan **Unggah ulang bukti pembayaran**.
   - `payment_status = verified` → upload dikunci.

2. **Status pembayaran di Dashboard lebih akurat**
   - Belum ada bukti transfer → **Perlu dilengkapi**.
   - Bukti sudah ada dan pending → **Menunggu verifikasi**.
   - Ditolak → **Perlu perbaikan**.
   - Terverifikasi → **Terverifikasi**.

3. **Dokumen persyaratan peserta khusus juga diamankan**
   - Peserta khusus lama yang tercatat `requirements_status = pending` tetapi belum memiliki STRA / bukti pengalaman akan dikembalikan menjadi `incomplete`.
   - Dashboard akan menampilkan form **Lengkapi Persyaratan** jika dokumen STRA atau pengalaman belum ada, walaupun status lama masih `pending`.

4. **Import peserta khusus berikutnya**
   - Format tetap: `Nama | Email | WhatsApp | Mode`.
   - Homebase tidak diperlukan saat import dan diisi sendiri oleh peserta melalui **Profil Saya**.
   - Peserta baru dibuat dengan `requirements_status = incomplete` dan `payment_status = pending`.

5. **Endpoint pembayaran peserta diperkuat**
   - Mendukung upload pertama maupun upload ulang setelah ditolak.
   - Tidak mengizinkan mengganti bukti yang sedang diverifikasi.
   - Tidak mengizinkan perubahan setelah pembayaran terverifikasi atau pendaftaran sudah tidak aktif.
   - File tetap menggunakan private Supabase Storage + signed upload seperti flow sebelumnya.

## Instalasi

Baseline wajib: **v0.4.20**.

1. Stop development server.
2. Extract ZIP patch ke root project dan pilih **Replace / Yes to All**.
3. Jalankan migration berikut di Supabase SQL Editor:

```text
supabase/migrations/016_special_participant_initial_documents.sql
```

Jangan jalankan ulang migration sebelumnya.

4. Tidak ada dependency baru, sehingga **tidak perlu `npm install`**.
5. Jalankan:

```powershell
npm run dev
```

## Test checklist

Gunakan satu akun peserta khusus yang kemarin sudah diimport dan belum pernah upload bukti pembayaran.

### Pembayaran

Dashboard → **Pendaftaran** harus menampilkan:

```text
Pembayaran
Perlu dilengkapi
Bukti transfer belum diunggah
```

serta card:

```text
Perlu tindakan
Unggah bukti pembayaran
[ pilih file ]
[ Kirim Bukti Pembayaran ]
```

Upload PDF/JPG/PNG. Setelah berhasil:

```text
Pembayaran
Menunggu verifikasi
```

Form upload pertama tidak muncul lagi sampai bukti tersebut ditolak oleh panitia.

### Persyaratan

Jika peserta khusus belum memiliki STRA / bukti pengalaman, Dashboard juga harus menampilkan **Lengkapi Persyaratan**.

### Admin

Setelah bukti pembayaran dikirim, buka Admin → Pendaftar. Dokumen `PAY` harus muncul dengan status pending dan dapat diverifikasi seperti peserta biasa.

## Build dan deploy

Setelah local test berhasil:

```powershell
npm run build
npm run audit:prod
```

Jika aman:

```powershell
git add .
git commit -m "Add initial document and payment upload for special participants v0.4.21"
git push origin main
```

## Migration

- SQL migration: **YA — 016**
- npm install: **TIDAK**
