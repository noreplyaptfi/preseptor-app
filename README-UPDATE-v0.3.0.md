# Update APTFI Preseptor Web App v0.3.0

Patch ini ditujukan untuk project **v0.2.2** yang sudah berjalan. Tidak perlu membuat project baru.

## Fokus update

v0.3.0 menyelesaikan fase operasional sebelum migrasi peserta lama dari WordPress:

1. Tagihan / Invoice dan Kwitansi PDF.
2. Pengumuman di aplikasi + email Resend.
3. Print dan export data pendaftar ke Excel `.xlsx`.
4. Kuota 200 peserta: 150 Online + 50 Offline, lengkap dengan sisa kuota di form dan proteksi backend/database.

Fitur QR check-in Offline dan akses Zoom Online **belum** masuk v0.3.0. Fitur tersebut direncanakan sebagai update berikutnya setelah v0.3.0 lolos pengujian.

---

## 1. Tagihan dan Kwitansi

- Setiap pendaftaran memiliki nilai tagihan tetap berdasarkan `amount_due`.
- Default kegiatan saat ini: **Rp 1.000.000**.
- Peserta dapat membuka **Tagihan / Invoice** dari Dashboard Peserta sejak terdaftar.
- **Kwitansi** baru tersedia setelah status pembayaran `verified`.
- Admin mendapatkan tombol Tagihan dan Kwitansi pada tabel pendaftar.
- PDF menggunakan kop/header APTFI yang diberikan.
- PDF dibuat secara dinamis; tidak perlu menyimpan file PDF baru per peserta di Storage.
- Pendaftar lama hasil migrasi WordPress juga otomatis dapat Tagihan. Jika pembayaran lama dimigrasikan sebagai `verified`, Kwitansi langsung tersedia.

Nomor dokumen dibuat deterministik dari nomor pendaftaran, sehingga tidak berubah setiap kali PDF dibuka.

---

## 2. Pengumuman

Menu admin baru: **Pengumuman**.

Admin `super_admin` / `event_admin` dapat membuat:

- Subject.
- Isi menggunakan editor rich text sederhana.
- Target penerima:
  - Semua peserta.
  - Peserta Online.
  - Peserta Offline.
  - Peserta terverifikasi.

Saat dipublikasikan:

- Pengumuman langsung muncul di Dashboard Peserta.
- Email dikirim menggunakan Resend.
- Dashboard Peserta memiliki tab **Pengumuman** dengan badge jumlah belum dibaca.
- Daftar awal hanya menampilkan subject + waktu publikasi. Klik subject untuk membuka isi.
- Status dibaca disimpan per peserta.

Isi HTML disanitasi di server sebelum disimpan dan dikirim.

---

## 3. Print dan Export Excel

Di menu **Pendaftar** admin sekarang tersedia:

- `Print` untuk mencetak data yang sedang tampil setelah filter/pencarian.
- `Export Excel (.xlsx)` untuk data yang sedang tampil setelah filter/pencarian.

Excel berisi antara lain:

- nomor pendaftaran,
- nama,
- email,
- WhatsApp,
- STRA,
- homebase,
- kategori peserta,
- tempat praktik,
- mode Online/Offline,
- status persyaratan,
- status pembayaran,
- status akhir,
- biaya,
- tanggal daftar,
- tanggal verifikasi pembayaran,
- sumber data (`webapp` / legacy WordPress).

Export Excel dibatasi untuk `super_admin` dan `event_admin`.

---

## 4. Kuota Peserta

Konfigurasi kegiatan:

- Total: **200 peserta**.
- Online: **150 peserta**.
- Offline: **50 peserta**.

Form menampilkan counter real-time:

- jumlah terisi,
- total kuota,
- sisa kuota.

Jika salah satu mode penuh, pilihan mode tersebut otomatis dinonaktifkan pada UI.

Proteksi juga dilakukan di:

- API submit, dan
- database trigger Supabase dengan row lock,

sehingga dua pendaftar yang submit pada waktu hampir bersamaan tidak dapat melewati kuota.

Data legacy WordPress tetap dapat dimigrasikan walaupun trigger kuota aktif. Setelah migrasi, data legacy tetap dihitung pada counter kapasitas.

---

## Dependency baru - WAJIB npm install

v0.3.0 menambah dependency:

- `pdf-lib` - membuat PDF Tagihan/Kwitansi.
- `exceljs` - export `.xlsx`.
- `sanitize-html` - sanitasi isi Pengumuman.

Setelah patch ditimpa, **WAJIB** jalankan:

```bash
npm install
```

---

## Migration database - WAJIB

Setelah menimpa patch, buka **Supabase -> SQL Editor** dan jalankan hanya:

```text
supabase/migrations/005_billing_announcements_capacity.sql
```

Jangan menjalankan ulang migration 001-004.

Migration 005:

- menambah biaya & kuota pada event,
- menambah `amount_due` pada registrasi,
- membuat tabel `announcements`,
- membuat tabel `announcement_reads`,
- membuat trigger pengamanan kuota.

Migration bersifat additive dan mengisi data existing dengan biaya default Rp1.000.000.

---

## Environment variable

Tidak ada environment variable baru.

Pastikan yang sudah ada tetap benar:

```env
RESEND_API_KEY=re_xxxxxxxxx
EMAIL_FROM=APTFI Preseptor <noreply@aptfi.or.id>
NEXT_PUBLIC_SITE_URL=http://localhost:3000
```

Untuk production nanti:

```env
NEXT_PUBLIC_SITE_URL=https://preseptor.aptfi.or.id
```

---

## Cara update v0.2.2 -> v0.3.0

1. Stop development server:
   ```bash
   Ctrl + C
   ```
2. Backup / commit project v0.2.2.
3. Extract seluruh isi patch ke root project dan pilih **Replace / Yes to All**.
4. Jangan menghapus atau menimpa `.env.local`.
5. Jalankan migration:
   ```text
   supabase/migrations/005_billing_announcements_capacity.sql
   ```
6. Install dependency baru:
   ```bash
   npm install
   ```
7. Jalankan kembali:
   ```bash
   npm run dev
   ```

---

## Checklist test v0.3.0

### Tagihan / Kwitansi
- [ ] Peserta pending dapat membuka Tagihan PDF.
- [ ] Peserta pending belum dapat membuka Kwitansi.
- [ ] Setelah pembayaran diverifikasi, Kwitansi dapat dibuka.
- [ ] Admin dapat membuka Tagihan peserta.
- [ ] Admin dapat membuka Kwitansi peserta terverifikasi.
- [ ] Kop APTFI tampil utuh pada PDF.
- [ ] Nama, nomor registrasi, nominal, mode, dan status benar.

### Pengumuman
- [ ] Admin dapat membuka menu Pengumuman.
- [ ] Subject wajib diisi.
- [ ] Rich editor dapat Bold/Italic/List/Link.
- [ ] Pengumuman `Semua peserta` masuk ke app peserta.
- [ ] Email pengumuman masuk melalui Resend.
- [ ] Target Online hanya diterima peserta Online.
- [ ] Target Offline hanya diterima peserta Offline.
- [ ] Target Terverifikasi hanya diterima peserta verified.
- [ ] Badge unread berkurang setelah subject dibuka.

### Print / Excel
- [ ] Filter daftar peserta bekerja.
- [ ] Print hanya memuat data hasil filter.
- [ ] Export `.xlsx` hanya memuat data hasil filter.
- [ ] File Excel dapat dibuka dan kolom terbaca dengan baik.

### Kuota
- [ ] Form menampilkan total 200, Online 150, Offline 50.
- [ ] Counter sesuai jumlah row di Supabase.
- [ ] Setelah pendaftaran baru, counter berkurang.
- [ ] Mode penuh tidak dapat dipilih.
- [ ] API menolak submit jika kuota penuh.

---

## Rollback

Jika perlu rollback kode:

1. Stop server.
2. Kembalikan source code dari backup/commit v0.2.2.
3. Jalankan `npm install` bila `package.json` ikut dikembalikan.
4. Jalankan kembali `npm run dev`.

Migration 005 sebaiknya tidak perlu dihapus untuk rollback singkat karena perubahan tabel bersifat additive. Kode v0.2.2 akan mengabaikan kolom/tabel baru. Trigger kuota dapat dinonaktifkan manual bila benar-benar perlu menjalankan perilaku lama.
