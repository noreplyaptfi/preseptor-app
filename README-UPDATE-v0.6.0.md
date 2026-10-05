# APTFI Preseptor — Update v0.5.3 → v0.6.0

## Hari-H Tahap 2: Pretest Native

Baseline wajib: **v0.5.3**.

Update ini melanjutkan roadmap Hari-H setelah presensi stabil. Modul berikutnya adalah **Pretest** dan dibuat sebagai assessment native di aplikasi agar hasil tersimpan langsung di database APTFI. Engine database dibuat generik supaya dapat dipakai ulang untuk Posttest dan Evaluasi pada update berikutnya.

### Fitur Super Admin

Menu baru: `Pelaksanaan -> Pretest`

- aktif/nonaktif Pretest;
- atur waktu buka dan tutup dalam WIB;
- atur apakah skor ditampilkan kepada peserta;
- prasyarat presensi dapat dipilih: tanpa prasyarat / Hari 1 / Hari 2;
- tambah soal pilihan tunggal;
- 2–6 opsi per soal;
- tepat satu jawaban benar;
- bobot nilai per soal;
- edit dan hapus soal selama belum ada hasil peserta;
- statistik eligible, selesai, belum selesai, rata-rata nilai;
- hasil akun TEST dipisahkan dari statistik resmi;
- reset hasil per peserta;
- reset seluruh hasil akun TEST;
- export hasil resmi ke Excel; akun TEST tidak masuk export.

### Fitur Peserta

Menu baru: `Pretest`

- hanya peserta eligible yang dapat mengerjakan;
- default migration mensyaratkan sudah hadir **Hari 1**;
- peserta resmi hanya dapat mengerjakan di window yang diaktifkan panitia;
- satu kali submit;
- jawaban dinilai server-side;
- setelah submit, peserta melihat status selesai;
- skor ditampilkan hanya jika opsi `Tampilkan skor` diaktifkan admin;
- akun TEST bypass jadwal aktif/waktu, tetapi **tetap wajib check-in Hari 1** agar flow Hari-H benar-benar diuji;
- hasil akun TEST tidak masuk statistik/export resmi.

## Migration SQL — WAJIB

Jalankan setelah file patch dipasang:

```text
supabase/migrations/018_pretest_core.sql
```

Migration membuat:

- `assessment_modules`
- `assessment_questions`
- `assessment_options`
- `assessment_attempts`
- `assessment_answers`

serta seed modul `pretest` untuk event `preseptor-2026` dalam kondisi **nonaktif**.

## Instalasi

1. Pastikan local sudah v0.5.3.
2. Stop `npm run dev`.
3. Extract ZIP ini ke root project → **Replace / Yes to All**.
4. Jalankan migration `018_pretest_core.sql` di Supabase SQL Editor.
5. Tidak ada dependency baru, jadi tidak perlu `npm install`.
6. Jalankan:

```powershell
npm run dev
```

## Urutan test yang disarankan

### A. Siapkan soal

1. Login Super Admin.
2. Buka `Pelaksanaan -> Pretest`.
3. Tambahkan minimal 2–3 soal dummy.
4. Atur waktu buka/tutup.
5. Biarkan **Aktifkan Pretest** OFF dulu.

### B. Test akun TEST

1. Gunakan akun TEST yang sudah dibuat.
2. Pastikan akun sudah check-in Hari 1 dari menu Kehadiran.
3. Buka menu Pretest.
4. Walaupun modul belum aktif dan waktu tidak sesuai, akun TEST dapat mengerjakan.
5. Submit sekali.
6. Dashboard admin harus menunjukkan hasil TEST, tetapi statistik resmi tidak bertambah.
7. Gunakan `Reset hasil TEST` untuk mengulang testing atau mengedit bank soal.

### C. Test peserta resmi

1. Setelah soal final, aktifkan Pretest.
2. Peserta yang belum check-in Hari 1 harus mendapat pesan untuk presensi dulu.
3. Peserta yang sudah hadir dapat mengerjakan hanya di window yang ditetapkan.
4. Setelah submit, percobaan kedua harus ditolak.
5. Export Excel tidak boleh menyertakan akun TEST.

## Catatan aman

- Jangan aktifkan Pretest resmi sebelum bank soal final.
- Begitu ada hasil peserta, bank soal dikunci. Reset hasil terlebih dahulu bila memang perlu perubahan.
- Reset hasil peserta adalah aksi Super Admin dan tercatat di audit log.
- Pretest saat ini menggunakan pilihan tunggal. Dukungan Posttest/Evaluasi akan memakai engine yang sama pada fase berikutnya.

## Migration / Dependency

- SQL migration: **YA — 018**
- npm install: **TIDAK**
