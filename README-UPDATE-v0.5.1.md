# APTFI Preseptor — Consolidated Update v0.4.21 → v0.5.1

Paket ini adalah versi **konsolidasi** dari v0.5.0 Day-H Core + hotfix v0.5.1.

Gunakan paket ini bila project masih berada di **v0.4.21** dan ingin langsung menuju v0.5.1.

## Isi update
- Day-H Core v0.5.0 (Command Center, presensi Online/Offline, QR Offline, akun TEST, sidebar peserta).
- Hotfix error `Cannot read properties of null (reading 'reset')` pada pembuatan akun TEST.
- Daftar akun TEST langsung refresh setelah akun dibuat.
- Logo dashboard peserta tidak dobel pada desktop.
- Logo sidebar diberi treatment kontras tanpa mengubah file logo asli.
- Status akun TEST tidak lagi kontradiktif dan tidak meminta dokumen/pembayaran resmi.

## Instalasi dari v0.4.21
1. Stop `npm run dev`.
2. Extract seluruh isi ZIP ke root project, pilih **Replace / Yes to All**.
3. Jalankan migration:

```text
supabase/migrations/017_day_h_core.sql
```

4. Tidak perlu `npm install` karena tidak ada dependency baru.
5. Jalankan `npm run dev` dan lakukan checklist akun TEST serta Hari-H.

## Penting
Jika migration `017_day_h_core.sql` **sudah pernah dijalankan** saat memasang v0.5.0, jangan jalankan ulang. Untuk local yang sudah v0.5.0, lebih aman gunakan paket hotfix **v0.5.0 → v0.5.1** saja.

## Sebelum production

```powershell
npm run build
npm run audit:prod
```
