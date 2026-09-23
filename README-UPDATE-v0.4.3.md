# Update APTFI Preseptor Web App v0.4.3

## Dari versi
v0.4.2 → v0.4.3

## Ringkasan perubahan

### 1. Homebase perguruan tinggi
Native `datalist` diganti dengan combobox pencarian buatan aplikasi agar konsisten di desktop dan mobile.

- pencarian realtime berdasarkan sebagian nama kampus;
- dropdown desktop tampil tepat di bawah field;
- di layar mobile daftar pilihan tampil sebagai panel/bottom sheet agar tidak tertutup keyboard;
- mendukung keyboard Arrow Up/Down, Enter, dan Escape pada desktop;
- pilihan aktif/terpilih lebih jelas;
- tombol hapus pilihan tersedia.

### 2. Tabel pendaftar admin
Informasi peserta dibuat lebih lengkap tanpa harus membuka database:

- email;
- nomor WhatsApp (klik langsung ke WhatsApp);
- homebase;
- kategori peserta;
- jenis/nama tempat praktik;
- nomor STRA;
- tombol **Lihat detail**.

Popup detail menampilkan identitas, kontak, profesi, pengalaman, mode keikutsertaan, status persyaratan/pembayaran, tanggal verifikasi pembayaran, dan penanda bila data berasal dari migrasi WordPress.

## Database / migration
Tidak ada migration SQL baru.

## Dependency
Tidak ada dependency baru. `npm install` tidak wajib jika project sudah berada di v0.4.2.

## Cara update
1. Backup/commit project v0.4.2.
2. Extract patch ke root project dan pilih **Replace / Yes to All**.
3. Jalankan:

```powershell
npm run dev
```

4. Test form `/daftar` di desktop dan mobile, terutama field **Homebase perguruan tinggi**.
5. Test Admin → Pendaftar dan klik **Lihat detail**.
6. Sebelum production:

```powershell
npm run build
git add .
git commit -m "Release Preseptor App v0.4.3"
git push origin main
```

## Checklist
- [ ] Homebase dapat dicari dan dipilih di desktop.
- [ ] Homebase nyaman digunakan di iPhone/Android.
- [ ] Nomor WhatsApp terlihat di tabel admin.
- [ ] Link WhatsApp membuka chat/nomor yang benar.
- [ ] Homebase dan informasi profesi terlihat di tabel.
- [ ] Popup detail peserta dapat dibuka dan ditutup.
- [ ] Review dokumen, Tagihan/Kwitansi, Print, dan Export Excel tetap berfungsi.
