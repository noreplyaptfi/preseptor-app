# APTFI Preseptor — Update v0.6.1 → v0.7.0

## Hari-H Tahap 3: Posttest, Evaluasi, dan Bank Soal Standar

Baseline wajib: **v0.6.1**.

Update ini melengkapi roadmap tahap 2 (Pretest, Posttest & Evaluasi). Engine assessment dari v0.6.0 diperluas sehingga satu engine dipakai untuk ketiga modul.

> ⚠️ **Jalankan migration `019_posttest_evaluation.sql` SEBELUM push ke production.**
> Kode v0.7.0 menyimpan jawaban ke kolom baru. Tanpa migration 019, pengiriman Pretest akan gagal.

---

## Fitur baru

### 1. Engine assessment
- Tiga tipe pertanyaan:
  - **Pilihan**: Benar/Salah, pilihan ganda, atau survei tanpa kunci (tidak dinilai);
  - **Skala**: misalnya 1–5, dengan label ujung;
  - **Isian/esai**.
- Pertanyaan bisa diberi **kelompok** (contoh "Benar atau Salah", "Esai") dan ditandai wajib/opsional.
- Skor dihitung di server **hanya dari soal pilihan yang punya kunci**. Esai dan survei tidak memengaruhi nilai.
- Kunci jawaban tidak pernah dikirim ke peserta.
- Tombol **Muat bank soal standar APTFI** mengisi bank soal dari dokumen resmi:

| Modul | Isi bank soal standar |
|---|---|
| Pretest | 1 survei pengalaman pelatihan + 1 isian jumlah pelatihan (opsional) + **15 Benar/Salah (dinilai)** + 2 esai wajib |
| Posttest | **15 Benar/Salah (dinilai)** + 3 esai wajib + 1 saran (opsional) |
| Evaluasi | 4 pertanyaan skala 1–5 + saran (opsional), **diisi untuk tiap pemateri** (6 pemateri dari rundown) |

Soal Pretest no. 1–5 di Google Form (email, nama, tempat praktik, lama praktik, lama membimbing) **tidak ditanyakan ulang**. Datanya diambil dari pendaftaran dan otomatis ikut di export Excel.

### 2. Posttest
- Default: **8 Oktober 2026, 16.00–18.00 WIB**, wajib hadir **Hari 2**.
- Boleh **diulang tanpa batas** selama jadwal terbuka. Super Admin bisa mengisi batas attempt bila perlu.
- **Semua attempt disimpan**, dan **nilai terbaik** yang dipakai.
- **Lulus jika nilai ≥ 80**. Nilai lulus bisa diubah.
- Peserta melihat nilai tiap attempt, nilai terbaik, status Lulus/Belum lulus, dan riwayat attempt.
- Jawaban esai otomatis terisi dari attempt sebelumnya, jadi peserta tidak perlu mengetik ulang.

### 3. Evaluasi (kuesioner kepuasan)
- Default: **8 Oktober 2026, 14.00–17.00 WIB**, wajib hadir **Hari 2**, satu kali kirim.
- Peserta menilai setiap pemateri dengan 4 pertanyaan skala 1–5 dan saran.
- Daftar pemateri default (dari rundown 28-09-26). Pemateri yang membawakan 2 topik dievaluasi **satu kali**.
  1. Prof. Dr. apt. Yandi Syukri, M.Si. — Topik 1 & 2
  2. Dr. apt. Iis Wahyuningsih, M.Si. — Topik 3
  3. Prof. Dr. apt. Satibi, M.Si. — Topik 4
  4. Dr. apt. Lusy Noviani, MM — Topik 5
  5. Prof. apt. Umi Athiyah, M.Si. — Topik 6
  6. Prof. Surakit Nathisuwan — Topik 8 & 9
- Topik 7 (Sharing Experiences, PP APTFI) **tidak dimasukkan**. Bisa ditambahkan dari **Evaluasi → Pemateri → Tambah pemateri**.
- Admin melihat **rekap rata-rata per pemateri per pertanyaan** dan bisa export rekap maupun seluruh jawaban.

### 4. Pretest
- Jadwal default diisi otomatis **7 Oktober 2026, 08.00–10.00 WIB**, tetapi hanya jika jadwal belum diatur admin.
- Tetap satu kali kirim, wajib hadir Hari 1.

### 5. Admin (Super Admin)
Menu **Pelaksanaan** sekarang berisi **Pretest**, **Evaluasi**, dan **Posttest**. Di setiap modul tersedia:
- pengaturan jadwal, prasyarat presensi, aktif/nonaktif, dan tampil skor (untuk Posttest juga batas attempt dan nilai lulus);
- bank soal: muat standar, tambah, edit, dan hapus pertanyaan per tipe;
- statistik eligible, selesai, belum, rata-rata, lulus, total attempt, dan akun TEST;
- tabel hasil peserta, reset per peserta, dan reset seluruh akun TEST;
- export Excel. Akun TEST tidak ikut export:
  - **Pretest/Posttest**: satu baris per peserta, berisi data pendaftaran, nilai, dan jawaban tiap soal (pilihan dari attempt terbaik, esai dari attempt terakhir);
  - **Posttest**: tambahan **Export semua attempt**;
  - **Evaluasi**: **Export rekap** (rata-rata per pemateri) dan **Export jawaban** (satu baris per peserta per pemateri).

Bank soal dan daftar pemateri **terkunci** begitu ada hasil, termasuk hasil akun TEST. Nama, instansi, dan topik pemateri tetap bisa dikoreksi.

### 6. Peserta
- Menu baru di sidebar: **Pretest**, **Evaluasi**, **Posttest**.
- Jawaban tersimpan otomatis di perangkat sampai dikirim, jadi tidak hilang bila halaman tertutup.
- Jika ada pertanyaan wajib yang belum dijawab, halaman langsung menggulir ke pertanyaan tersebut.

### 7. Perbaikan kecil
- Membuka dashboard dengan `?tab=attendance` (atau tab lain) sekarang langsung memuat datanya. Sebelumnya tombol **Buka Kehadiran** di Pretest membuka halaman Kehadiran yang kosong.
- Tombol **Buka Kehadiran** berpindah tab tanpa memuat ulang halaman.
- Kotak info (`alert-info`) sekarang memiliki style.

---

## Catatan isi soal

- Typo "verbal messagge" di Posttest diperbaiki menjadi "verbal message".
- Soal *near peer teaching* (Pretest no. 18 / Posttest no. 11) memakai kunci **Benar** sesuai dokumen. Mohon dikonfirmasi ke tim materi. Bila kunci perlu diubah, edit soal di admin **sebelum ada hasil**.

---

## Instalasi

1. Stop `npm run dev`.
2. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
3. Jalankan migration di Supabase SQL Editor:

```text
supabase/migrations/019_posttest_evaluation.sql
```

4. Tidak ada dependency baru, jadi tidak perlu `npm install`.
5. Jalankan `npm run dev`.

## Setup modul (lokal dulu, lalu production)

Untuk setiap modul di **Admin → Pelaksanaan**:

1. **Pretest**: jika ada hasil uji dari v0.6.0, klik **Reset hasil TEST** dulu. Setelah itu klik **Muat bank soal standar APTFI**.
2. **Evaluasi**: klik **Muat bank soal standar APTFI**. Pertanyaan dan 6 pemateri akan terisi.
3. **Posttest**: klik **Muat bank soal standar APTFI**.
4. Periksa jadwal, lalu biarkan **Aktifkan** dalam keadaan OFF selama pengujian.

## Test checklist (akun TEST)

Akun TEST bypass jadwal dan status aktif, tetapi tetap wajib presensi. Presensi akun TEST juga bypass jam, sehingga Hari 2 bisa di-check-in hari ini.

### A. Pretest
1. Akun TEST check-in **Hari 1**.
2. Buka **Pretest**. Muncul 19 pertanyaan dalam 3 kelompok.
3. Coba kirim dengan satu esai kosong. Halaman harus menggulir ke pertanyaan tersebut.
4. Isi lengkap, lalu kirim. Nilai muncul (misalnya 15/15 · 100%).
5. Coba buka lagi. Status **Sudah selesai**, dan form tidak muncul.

### B. Evaluasi
1. Akun TEST check-in **Hari 2**.
2. Buka **Evaluasi**. Muncul 6 kartu pemateri, masing-masing 4 skala dan saran.
3. Kirim. Muncul pesan **Terima kasih**.
4. Admin → Evaluasi → **Rekap per pemateri**: akun TEST **tidak** dihitung (rekap resmi tetap kosong). Hasil TEST terlihat di tabel hasil peserta dengan label TEST.

### C. Posttest
1. Buka **Posttest**, jawab dengan sengaja salah beberapa (nilai < 80), lalu kirim. Status **Belum lulus**.
2. Klik **Kerjakan Posttest lagi**. Esai sudah terisi. Jawab benar dan kirim. Status **Lulus**, nilai terbaik diperbarui.
3. Kirim attempt ketiga dengan nilai lebih rendah. Nilai terbaik **tidak turun**.
4. Admin → Posttest: kolom **Attempt** = 3, dan **Export semua attempt** berisi 3 baris (akun TEST tidak masuk export resmi, jadi uji export dengan akun resmi bila perlu).

### D. Reset
Setelah selesai menguji: **Reset hasil TEST** di ketiga modul.

## Push ke production

1. Jalankan `019_posttest_evaluation.sql` di Supabase SQL Editor **production**. Lewati langkah ini jika lokal dan production memakai project Supabase yang sama.
2. Build dan push:

```powershell
npm run build
npm run audit:prod
git add .
git commit -m "Add posttest, evaluation and standard question banks v0.7.0"
git push origin main
```

3. Setelah deploy, lakukan **Setup modul** di production.

## Jadwal aktivasi Hari-H

| Kapan | Tindakan Super Admin |
|---|---|
| Sebelum 7 Okt 08.00 | Pretest: bank soal sudah dimuat, jadwal 08.00–10.00, **Aktifkan** |
| Sebelum 8 Okt 14.00 | Evaluasi: jadwal 14.00–17.00, **Aktifkan** |
| Sebelum 8 Okt 16.00 | Posttest: jadwal 16.00–18.00, **Aktifkan** |

Waktu buka/tutup bisa diperpanjang kapan saja dari halaman modul.

## File

Baru:
```text
supabase/migrations/019_posttest_evaluation.sql
lib/assessment-admin.js
lib/assessment-banks.js
lib/assessment-participant.js
components/AssessmentAdmin.js
components/AssessmentParticipantPanel.js
app/api/admin/posttest/route.js
app/api/admin/evaluation/route.js
app/api/me/posttest/route.js
app/api/me/evaluation/route.js
```

Diubah:
```text
lib/assessment.js
app/api/admin/pretest/route.js
app/api/me/pretest/route.js
components/PretestAdmin.js
components/AdminDashboard.js
components/ParticipantDashboard.js
app/globals.css
```

## Migration / Dependency

- SQL migration: **YA — 019** (wajib sebelum push)
- npm install: **TIDAK**
