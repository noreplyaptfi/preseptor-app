# Update v0.4.6 — Legacy Mass Activation Hardening

Patch kecil untuk pengiriman aktivasi massal peserta hasil migrasi WordPress.

## Perubahan
- Link aktivasi legacy default berlaku **48 jam** (sebelumnya 30 menit).
- Dry-run menampilkan target, email bermasalah, dan undangan yang sudah pernah sukses dikirim.
- Saat dijalankan ulang, peserta yang sudah mendapat email sukses otomatis **dilewati** sehingga tidak menerima duplikat.
- `--force` tersedia hanya jika memang ingin mengirim ulang.
- `--code APT-PRS-...` tersedia untuk mengirim ke satu peserta tertentu.
- `--hours N` dapat mengubah masa berlaku link (1–168 jam).
- Mode commit menolak `localhost`; `NEXT_PUBLIC_SITE_URL` wajib URL HTTPS production.
- Kegagalan pengiriman dicatat ke `email_logs`.

## Instalasi
Tidak ada migration SQL dan tidak ada dependency baru.

Extract patch ke root project dan replace file yang ada.

## Dry run
Karena script Node tidak otomatis membaca `.env.local`, gunakan:

```powershell
node --env-file=.env.local scripts/invite-legacy-users.mjs
```

Pastikan `Site URL` menunjuk `https://preseptor.aptfi.or.id`.

## Kirim massal

```powershell
node --env-file=.env.local scripts/invite-legacy-users.mjs --commit
```

## Kirim satu peserta

```powershell
node --env-file=.env.local scripts/invite-legacy-users.mjs --code APT-PRS-... --commit
```

## Kirim ulang peserta yang sudah pernah sukses
Gunakan hanya bila diperlukan:

```powershell
node --env-file=.env.local scripts/invite-legacy-users.mjs --code APT-PRS-... --force --commit
```

## Checklist sebelum mass send
- `NEXT_PUBLIC_SITE_URL=https://preseptor.aptfi.or.id`
- `RESEND_API_KEY` valid
- `EMAIL_FROM` menggunakan domain sender yang sudah diverifikasi
- Seluruh email peserta unik / record `email_needs_update` sudah diperbaiki
- Production dapat membuka `/auth/set-password`
