# APTFI Preseptor — Update v0.4.12 → v0.4.13

## Fokus update

Versi ini menambahkan pengelolaan pendaftaran per mode sebelum modul Hari-H dipasang:

1. Pilihan Online / Offline otomatis dinonaktifkan jika kuotanya penuh.
2. Form menampilkan pengumuman yang jelas pada mode yang penuh / belum dibuka / sudah ditutup.
3. Online dan Offline dapat memiliki jadwal buka dan tutup pendaftaran yang berbeda.
4. Validasi dilakukan di frontend **dan server**, sehingga mode yang sudah ditutup tidak dapat dipaksa melalui request manual.
5. Peserta berstatus `withdrawn` tetap tidak dihitung dalam kuota, sesuai v0.4.12.

> Modul Day-H v0.5.0 ditunda. Jangan pasang patch v0.5.0 yang lama. Setelah v0.4.13 stabil, Day-H akan dibuat ulang di atas baseline terbaru dan migration berikutnya menggunakan nomor setelah `012`.

---

## Migration SQL

**WAJIB** jalankan hanya:

```text
supabase/migrations/012_registration_mode_windows.sql
```

Migration menambah 4 kolom nullable pada `events`:

- `online_registration_opens_at`
- `online_registration_closes_at`
- `offline_registration_opens_at`
- `offline_registration_closes_at`

Nilai awal `NULL`, jadi setelah migration perilaku lama tetap dipertahankan sampai admin menyimpan jadwal khusus per mode.

## npm install

Tidak diperlukan. Tidak ada dependency baru.

---

# 1. Tampilan peserta ketika kuota penuh

Contoh bila Online sudah penuh:

```text
Online
Pendaftaran Online tidak dapat dipilih karena kuotanya sudah penuh.

[ Online — Kuota penuh ]   ← disabled
[ Offline ]                ← tetap dapat dipilih jika tersedia
```

Angka kuota **tidak ditampilkan ke publik**.

Jika seluruh kuota penuh, kedua pilihan akan disabled.

---

# 2. Jadwal buka/tutup per mode

Buka:

```text
Admin → Status Form → Jadwal pendaftaran per mode
```

Tersedia dua kartu:

### Online
- Dibuka mulai
- Ditutup pada

### Offline
- Dibuka mulai
- Ditutup pada

Semua waktu ditampilkan/dimasukkan dalam WIB.

Contoh konfigurasi:

```text
Online
Dibuka mulai : kosong
Ditutup pada : 03/10/2026 23:59

Offline
Dibuka mulai : kosong
Ditutup pada : 06/10/2026 23:59
```

Hasilnya:

- sampai 3 Oktober 23:58 WIB → Online masih dapat dipilih jika kuota tersedia;
- mulai 3 Oktober 23:59 WIB → Online disabled dan form menampilkan bahwa Online sudah ditutup;
- Offline tetap tersedia sampai 6 Oktober 23:59 WIB jika kuotanya tersedia.

---

# 3. Aturan prioritas

Urutan aturan sistem:

1. `Maintenance` global → semua mode tertutup.
2. `Ditutup` global → semua mode tertutup.
3. Bila jadwal khusus suatu mode diisi → mode tersebut memakai jadwal khususnya.
4. Bila jadwal khusus mode kosong → fallback ke jadwal global lama.
5. Kuota penuh → mode dinonaktifkan walaupun periode pendaftarannya masih terbuka.

Karena itu, untuk memakai jadwal berbeda per mode, status global sebaiknya tetap **Dibuka** (atau tidak berada pada `Ditutup` / `Maintenance`).

---

# 4. Proteksi server-side

Endpoint `/api/register/prepare` sekarang memeriksa kembali:

- status global;
- jadwal Online / Offline;
- kuota total;
- kuota mode;
- duplicate peserta.

Jadi disabled pada browser bukan satu-satunya proteksi.

---

# 5. Cara instalasi

Baseline wajib:

```text
v0.4.12
```

1. Stop `npm run dev`.
2. Extract ZIP v0.4.13 ke root project.
3. Pilih **Replace / Yes to All**.
4. Jalankan migration `012_registration_mode_windows.sql` di Supabase SQL Editor.
5. Jalankan:

```powershell
npm run dev
```

---

# 6. Checklist test lokal

## Test A — kuota penuh

1. Catat peserta Online aktif.
2. Di `Status Form → Manajemen kuota`, set kuota Online sama dengan jumlah Online aktif.
3. Buka `/daftar`.
4. Expected:
   - pengumuman Online kuota penuh muncul;
   - kartu Online disabled;
   - Offline tetap dapat dipilih jika masih tersedia.

Jangan lupa kembalikan kuota setelah test bila perlu.

## Test B — Online ditutup, Offline masih buka

Atur jadwal test beberapa menit dari waktu sekarang:

```text
Online ditutup : sekarang - 5 menit
Offline ditutup: sekarang + 30 menit
```

Expected `/daftar`:

- Online disabled + pesan sudah ditutup;
- Offline selectable.

## Test C — mode belum dibuka

Atur Online dibuka 10 menit dari sekarang.

Expected:

- Online disabled;
- pesan menampilkan waktu mulai dibuka.

## Test D — server protection

Pastikan mode yang sudah ditutup tidak bisa submit. Server harus mengembalikan pesan bahwa pendaftaran mode tersebut sudah ditutup.

## Test E — withdrawal + quota

Pastikan behavior v0.4.12 tetap berlaku:

- withdrawal pending → masih memakai kuota;
- withdrawal approved → keluar dari kuota;
- slot mode otomatis tersedia lagi jika tidak melewati jadwal tutup.

---

# 7. Build dan deployment

Setelah semua test lolos:

```powershell
npm run build
npm run audit:prod
```

Commit yang disarankan:

```powershell
git add .
git commit -m "Add per-mode registration windows v0.4.13"
git push origin main
```

---

## File yang berubah / ditambahkan

```text
app/globals.css
app/api/public/settings/route.js
app/api/register/prepare/route.js
app/api/admin/registration-modes/route.js
components/RegistrationForm.js
components/AdminDashboard.js
lib/registration-mode-window.js
supabase/migrations/012_registration_mode_windows.sql
README-UPDATE-v0.4.13.md
```
