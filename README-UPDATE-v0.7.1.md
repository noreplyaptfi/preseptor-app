# APTFI Preseptor — Update v0.7.0 → v0.7.1

## Perapian UI/UX Pretest, Evaluasi, Posttest

Baseline wajib: **v0.7.0** (termasuk migration 019).

Update ini **hanya tampilan**. Tidak ada perubahan API, database, migration, atau dependency. Data, bank soal, dan hasil yang sudah ada tidak terpengaruh.

### Peserta

- **Kartu soal dirapikan.** Judul soal tidak lagi "menabrak" garis kotak. Nomor soal berubah menjadi ✓ biru begitu dijawab.
- **Benar/Salah dan pilihan pendek** tampil sebagai tombol berdampingan, sehingga halaman Pretest/Posttest jauh lebih pendek (±25%).
- **Progress bar** "x/y wajib terjawab" dan tombol kirim menempel di bawah layar.
- **Header modul** menampilkan jam tutup, jumlah pertanyaan, dan info bahwa jawaban tersimpan otomatis.
- **Evaluasi diisi per pemateri, satu langkah per pemateri** (1 → 6):
  - lingkaran nomor di atas berubah menjadi ✓ hijau bila semua pertanyaan untuk pemateri itu sudah dijawab;
  - tombol **Sebelumnya / Berikutnya**, dan **Kirim Evaluasi** ada di langkah terakhir;
  - jika ada yang terlewat saat kirim, halaman otomatis pindah ke pemateri dan pertanyaan tersebut.
- **Hasil Posttest:**
  - nilai terbaik tampil besar dalam lingkaran (hijau = lulus, oranye = belum lulus);
  - riwayat attempt tampil dengan bar nilai, dan attempt terbaik ditandai.
- **Halaman selesai** (Pretest/Evaluasi) dibuat lebih jelas, dengan ikon ✓, nilai, dan waktu kirim.

### Admin (Pretest / Evaluasi / Posttest)

- **Kartu status di atas:** aktif/belum aktif (garis hijau/oranye), jadwal, prasyarat, jumlah soal, serta batas attempt dan nilai lulus untuk Posttest. Tombol **Ubah** langsung membuka Pengaturan.
- **Halaman dibagi menjadi tab:**
  - **Hasil**: tabel peserta, pencarian, reset, export. Untuk Evaluasi juga ada **Rekap per pemateri**.
  - **Soal**: bank soal dengan tombol **Muat bank soal standar APTFI** dan **Tambah pertanyaan**. Untuk Evaluasi juga ada **Pemateri**.
  - **Pengaturan**: form dua kolom.
- **Daftar soal lebih ringkas.** Satu baris per soal, pilihan jawaban tampil sebagai chip, dan kunci ditandai ✓ hijau.
- Jika bank soal masih kosong, halaman langsung membuka tab **Soal**.
- Halaman tidak lagi melebar ke samping di HP. Tabel bisa digeser di dalam kotaknya.
- Nilai lulus tampil `80`, bukan `80.00`.

### File yang berubah

```text
components/AssessmentParticipantPanel.js
components/AssessmentAdmin.js
app/globals.css
```

## Instalasi

1. Pastikan lokal sudah v0.7.0 dan migration 019 sudah dijalankan.
2. Stop `npm run dev`.
3. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
4. Tidak ada migration SQL dan tidak perlu `npm install`.
5. Jalankan `npm run dev`.

## Test checklist

Gunakan akun TEST. Cek di desktop dan di HP (atau DevTools ukuran 390px).

### Peserta
- **Pretest/Posttest:** Benar/Salah tampil berdampingan, nomor soal berubah ✓ setelah dijawab, progress bar bertambah, dan tombol kirim selalu terlihat di bawah.
- **Evaluasi:**
  - isi pemateri 1, lalu lingkaran nomor 1 berubah ✓ hijau;
  - **Berikutnya** pindah ke pemateri 2;
  - coba kirim dengan satu pertanyaan terlewat di pemateri 3. Halaman harus pindah ke pemateri 3.
- **Posttest setelah kirim:** lingkaran nilai terbaik dan riwayat attempt tampil, lalu **Kerjakan Posttest lagi** membuka form dengan esai terisi.

### Admin
- Kartu status, angka statistik, dan tab **Hasil / Soal / Pengaturan** tampil.
- Simpan pengaturan tetap berfungsi, dan kartu status ikut berubah (aktif = garis hijau).
- Tab **Soal**: edit satu soal, simpan, lalu batalkan. Saat terkunci, tombol edit tidak muncul.
- Di HP: tidak ada scroll ke samping pada halaman, dan tabel hasil bisa digeser di dalam kotaknya.

## Perintah git

```powershell
git status
npm run build
npm run audit:prod
git add .
git commit -m "Polish assessment UI for participants and admin v0.7.1"
git push origin main
```

`git status` harus menampilkan 3 file diubah dan 1 file baru (`README-UPDATE-v0.7.1.md`).

Jika ingin membatalkan sebelum commit:

```powershell
git restore .
git clean -fd -n
```

## Migration / Dependency

- SQL migration: **TIDAK**
- npm install: **TIDAK**
