# Update APTFI Preseptor Web App v0.3.1

Patch ini ditujukan untuk project **v0.3.0** yang sudah berjalan. Tidak perlu membuat project baru.

## Fokus update

Memperbaiki tombol **Print** di menu **Pendaftar** yang pada sebagian browser membuka halaman/tab kosong.

### Penyebab
Implementasi v0.3.0 membuka window baru dengan `window.open(..., 'noopener,noreferrer')` lalu menulis isi dokumen ke window tersebut. Pada beberapa konfigurasi Chromium/Chrome, WindowProxy yang dibuka dengan fitur tersebut tidak dapat digunakan secara konsisten untuk `document.write()`, sehingga hasilnya terlihat blank.

### Perbaikan v0.3.1
- Print tidak lagi membuka tab kosong.
- Dokumen cetak dibuat di iframe sementara pada halaman admin, lalu langsung memanggil dialog print browser.
- Iframe otomatis dibersihkan setelah proses print.
- Tetap hanya mencetak data sesuai **filter/pencarian aktif**.
- Layout print A4 landscape.
- Ditambahkan kop APTFI pada hasil print.
- Status ditampilkan dalam label Bahasa Indonesia.

## File yang berubah

- `components/AdminDashboard.js`
- `package.json` (versi aplikasi menjadi `0.3.1`)

## Database / migration

**Tidak ada migration SQL baru.**

Jangan menjalankan ulang migration sebelumnya.

## Dependency

**Tidak ada dependency baru.**

`npm install` tidak wajib untuk patch ini. Bila package-lock ingin diselaraskan dengan nomor versi package, menjalankan `npm install` aman tetapi tidak diperlukan untuk fungsi Print.

## Cara update

1. Stop development server:
   ```bash
   Ctrl + C
   ```
2. Backup/commit project v0.3.0.
3. Extract patch v0.3.1 langsung ke root project.
4. Pilih **Replace / Yes to All** untuk file yang sama.
5. `.env.local` tidak perlu diubah.
6. Tidak ada SQL yang perlu dijalankan.
7. Jalankan kembali:
   ```bash
   npm run dev
   ```

## Checklist test

- [ ] Buka `Admin > Pendaftar`.
- [ ] Klik `Print` tanpa filter: dialog print browser muncul dan preview berisi tabel.
- [ ] Terapkan filter `Offline`, klik `Print`: hanya peserta Offline yang tercetak.
- [ ] Terapkan pencarian nama/email, klik `Print`: hanya hasil pencarian yang tercetak.
- [ ] Kop APTFI terlihat pada preview print.
- [ ] Export Excel `.xlsx` tetap bekerja seperti v0.3.0.

## Rollback

Jika diperlukan, kembalikan dua file berikut dari backup v0.3.0:
- `components/AdminDashboard.js`
- `package.json`

Tidak ada rollback database karena v0.3.1 tidak mengubah schema.
