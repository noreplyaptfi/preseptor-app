# APTFI Preseptor Web App — Update v0.3.1 → v0.4.0

Update ini menambahkan **akses pelaksanaan acara** untuk peserta terverifikasi:

- QR unik peserta **Offline** untuk check-in di lokasi.
- Validasi QR secara live ke database APTFI sebelum panitia melakukan check-in.
- Pencatatan waktu dan akun panitia yang melakukan check-in.
- QR + tombol **Join Zoom** untuk peserta **Online**.
- Pengaturan waktu publikasi QR Offline dan akses Zoom.
- Menu admin baru **Akses Acara** dan halaman **Check-in**.
- Tab peserta baru **Akses Acara**.

## 1. Prasyarat

Project harus sudah berada di **v0.3.1**.

Sebelum update, backup/commit project.

```bash
git add .
git commit -m "before v0.4.0"
```

Hentikan dev server:

```bash
Ctrl + C
```

## 2. Timpa file patch

Extract seluruh isi ZIP patch ke root project yang sedang digunakan, lalu pilih **Replace / Yes to All**.

`.env.local` tidak disertakan di patch dan tidak perlu diubah.

## 3. Jalankan migration Supabase

Di **Supabase → SQL Editor**, jalankan hanya:

```text
supabase/migrations/006_event_access_qr_checkin.sql
```

Jangan jalankan ulang migration 001–005.

Migration ini menambahkan:

### events
- `offline_qr_enabled`
- `offline_qr_release_at`
- `online_access_enabled`
- `online_access_release_at`
- `zoom_url`

### registrations
- `checkin_token`
- `checked_in_at`
- `checked_in_by`

Setiap pendaftaran existing otomatis memiliki token check-in unik. Ini juga berlaku nanti untuk peserta hasil migrasi WordPress.

## 4. Install dependency baru

v0.4.0 menggunakan package `qrcode` untuk menghasilkan QR secara server-side.

```bash
npm install
```

Jangan gunakan `npm audit fix --force` saat update ini.

Lalu jalankan:

```bash
npm run dev
```

## 5. Pengaturan Admin

Buka:

```text
http://localhost:3000/admin
```

Menu baru:

### Akses Acara

#### Peserta Offline
- aktif/nonaktifkan publikasi QR check-in;
- atur tanggal/jam QR mulai tampil;
- jika waktu dikosongkan, QR tampil segera setelah switch publikasi diaktifkan.

#### Peserta Online
- masukkan link Zoom HTTPS;
- aktif/nonaktifkan publikasi akses Zoom;
- atur tanggal/jam QR + tombol Zoom mulai tampil.

Akses hanya muncul kepada peserta yang memenuhi **dua syarat sekaligus**:

```text
Persyaratan = Valid
Pembayaran  = Terverifikasi
```

## 6. Alur QR Offline

QR Offline **tidak berisi teks statis “peserta valid”**. QR berisi token unik yang membuka endpoint check-in aplikasi. Ini lebih aman karena status peserta diperiksa langsung ke database pada saat QR discan.

Alur:

```text
Peserta Offline terverifikasi
        ↓
Waktu publikasi QR tercapai
        ↓
QR muncul di Dashboard Peserta → Akses Acara
        ↓
Panitia scan dengan kamera ponsel
        ↓
/admin/checkin?token=...
        ↓
Sistem membaca status terbaru peserta
        ↓
PESERTA VALID / TIDAK VALID / SUDAH CHECK-IN
        ↓
Panitia klik Konfirmasi Check-in
        ↓
checked_in_at + checked_in_by disimpan
```

Check-in hanya dapat dikonfirmasi oleh role:

- `super_admin`
- `event_admin`

Role panitia lain masih dapat membaca hasil validasi QR tetapi tidak dapat melakukan check-in.

## 7. Alur peserta Online

Setelah link Zoom dikonfigurasi, akses diaktifkan, dan waktu publikasi tercapai:

```text
Dashboard Peserta
→ Akses Acara
→ QR Zoom
→ Buka Zoom Meeting
```

Sebelum waktu publikasi, link Zoom tidak dikirim ke browser peserta.

## 8. Testing yang disarankan

### Offline

1. Gunakan satu peserta mode Offline.
2. Pastikan dokumen Valid dan pembayaran Terverifikasi.
3. Admin → Akses Acara.
4. Aktifkan QR Offline.
5. Untuk test, kosongkan waktu publikasi atau gunakan waktu saat ini.
6. Login sebagai peserta → Akses Acara.
7. Pastikan QR muncul.
8. Scan QR sebagai panitia.
9. Pastikan halaman menampilkan **Peserta Valid**.
10. Klik **Konfirmasi Check-in**.
11. Scan ulang QR yang sama.
12. Pastikan status berubah menjadi **Sudah Check-in** dan tidak membuat check-in ganda.

### Online

1. Gunakan satu peserta mode Online yang terverifikasi lengkap.
2. Masukkan link Zoom test HTTPS.
3. Aktifkan akses Online.
4. Untuk test, kosongkan waktu publikasi atau gunakan waktu saat ini.
5. Login peserta → Akses Acara.
6. Pastikan QR Zoom dan tombol **Buka Zoom Meeting** muncul.
7. Ubah publikasi ke waktu masa depan dan pastikan akses kembali terkunci.

## 9. Catatan testing QR di localhost

Jika QR Offline dibuat ketika Dashboard Peserta dibuka melalui:

```text
http://localhost:3000
```

maka QR juga menunjuk ke `localhost:3000`. QR tersebut **tidak dapat dibuka dari ponsel lain**, karena `localhost` pada ponsel berarti ponsel itu sendiri.

Untuk test antar perangkat dalam jaringan lokal, buka webapp dari alamat LAN komputer, misalnya:

```text
http://192.168.1.10:3000
```

Pastikan firewall mengizinkan koneksi ke port 3000. Setelah production di Vercel/custom domain, QR otomatis menggunakan domain production yang sedang diakses.

## 10. Rollback

Jika perlu rollback kode, restore project v0.3.1/commit sebelumnya.

Migration 006 aman dibiarkan karena kolom baru bersifat tambahan dan tidak mengubah data pendaftaran lama. Jika kode v0.3.1 digunakan kembali, kolom tambahan tersebut akan diabaikan.

## Checklist

- [ ] Backup/commit v0.3.1
- [ ] Extract patch dan replace file
- [ ] Jalankan migration 006
- [ ] `npm install`
- [ ] `npm run dev`
- [ ] Menu Akses Acara tampil
- [ ] QR Offline hanya tampil untuk peserta terverifikasi
- [ ] Check-in valid tersimpan
- [ ] Scan ulang menunjukkan Sudah Check-in
- [ ] QR Zoom hanya tampil setelah waktu publikasi
- [ ] Link Zoom tidak tersedia sebelum publikasi
