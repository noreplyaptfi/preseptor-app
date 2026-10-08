# APTFI Preseptor — Update v0.8.3 → v0.8.4

## Menu Dokumentasi (khusus tautan)

Baseline: **v0.8.3**. Kalau v0.8.2/v0.8.3 belum terpasang, pasang berurutan dulu.

> ⚠️ **Jalankan migration `022_event_documentation.sql` SEBELUM push.**
> Migration ini mengizinkan jenis aset `documentation` dan menambah kolom `group_label`. Aman dijalankan ulang.

Tidak ada dependency baru.

---

### Admin — menu baru **Pelaksanaan → Dokumentasi** (Super Admin & Admin Event)
- **Khusus tautan.** Foto/video disimpan di Google Drive, Google Photos, YouTube, dll. Aplikasi hanya menyimpan tautannya, jadi tidak memakan kuota penyimpanan.
- **Banyak sekaligus:** tempel daftar tautan, satu per baris.
  - Format **`Judul | tautan`**.
  - Pemisah boleh tab (salin 2 kolom dari Excel), `-`, atau `:`.
  - Baris tanpa judul diberi judul otomatis, misalnya "Hari 1 — tautan 4".
  - Ada **pratinjau** sebelum disimpan: jenis tautan terdeteksi (Folder Google Drive / Google Photos / YouTube / …), dan baris tanpa tautan valid ditandai lalu dilewati.
  - Maksimal 100 tautan sekali simpan.
- **Satu tautan:** judul, tautan, dan keterangan (opsional).
- **Kelompok:** isi bebas, dengan pilihan cepat *Hari 1 / Hari 2 / Umum*. Kelompok diurutkan otomatis: Hari 1, Hari 2, …, Umum, lalu "Lainnya" untuk tautan tanpa kelompok.
- **Sasaran** (Semua / Online / Offline) dan **Langsung tampil ke peserta**.
- **Daftar:**
  - pencarian dan filter kelompok;
  - per tautan: tampil/sembunyi, naik/turun (di dalam kelompok), edit (judul, tautan, keterangan, kelompok, sasaran), hapus;
  - per kelompok: **Tampilkan semua / Sembunyikan semua**.
- Statistik: total tautan, jumlah kelompok, yang tampil, dan total dibuka.

### Peserta — menu baru **Dokumentasi** (di bawah Materi)
- Tautan dikelompokkan per kelompok, ditampilkan sebagai kartu dengan ikon sesuai sumber (Drive/Photos/YouTube).
- Kolom pencarian muncul bila tautan lebih dari 6.
- Klik kartu → tautan terbuka di tab baru, dan jumlah dibuka tercatat (akun TEST tidak dihitung).
- Hanya untuk peserta terverifikasi (dan akun TEST), sesuai sasaran Online/Offline.
- Angka jumlah dokumentasi tampil di menu samping.

### Lain-lain
- Panduan Panitia (Setelah acara): langkah "Bagikan dokumentasi".
- Panduan Peserta: langkah "Lihat dokumentasi".
- Database: dokumentasi wajib berupa tautan (constraint), tidak bisa berupa file.

## File

Baru:
- `supabase/migrations/022_event_documentation.sql`
- `components/DocumentationAdmin.js`
- `components/DocumentationPanel.js`
- `README-UPDATE-v0.8.4.md`

Diubah:
- `lib/event-assets.js`
- `app/api/admin/assets/route.js`
- `app/api/me/assets/route.js`
- `app/api/me/summary/route.js`
- `components/AdminSidebar.js`
- `components/AdminDashboard.js`
- `components/AdminGuide.js`
- `components/EventAssetsAdmin.js`
- `components/ParticipantNav.js`
- `components/ParticipantDashboard.js`
- `components/ParticipantGuide.js`
- `components/NavIcon.js`
- `app/globals.css`

## Cara pasang
1. Stop `npm run dev`.
2. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
3. Jalankan di Supabase SQL Editor:

```text
supabase/migrations/022_event_documentation.sql
```

4. Jalankan `npm run dev`.

## Test singkat
1. Admin → **Dokumentasi** → tab *Banyak sekaligus* → tempel 3–4 baris `Judul | https://...`, pilih kelompok **Hari 1** → pratinjau muncul → **Simpan**.
2. Tambah beberapa tautan lagi dengan kelompok **Hari 2**.
3. Ubah satu tautan menjadi sasaran **Offline**, lalu sembunyikan satu tautan.
4. Login akun TEST **Online** → menu **Dokumentasi**: tampil per kelompok. Tautan Offline dan yang disembunyikan tidak terlihat. Klik kartu → tautan terbuka.
5. Admin: kolom "dibuka" bertambah hanya bila dibuka akun peserta resmi (akun TEST tidak dihitung).

## Push
```powershell
npm run build
npm run audit:prod
git add .
git commit -m "Add documentation menu (link-only, grouped, bulk add) v0.8.4"
git push origin main
```

## Migration / Dependency
- SQL migration: **YA — 022** (wajib sebelum push)
- npm install: **TIDAK**
