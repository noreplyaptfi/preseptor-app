# APTFI Preseptor — Update v0.4.15

## Baseline
Update ini dipasang di atas **v0.4.14**.

## Perubahan
Card status pendaftaran di homepage dibuat lebih ringkas.

Dihilangkan dari card homepage:
- ribbon/pill `PENDAFTARAN`;
- notice tambahan seperti `Satu mode pendaftaran masih tersedia...`;
- informasi biaya pendaftaran;
- informasi rekening;
- ringkasan syarat utama;
- link `Lihat persyaratan lengkap`.

Tetap ditampilkan:
- `Status pendaftaran`;
- `Online & Offline`;
- status Online;
- status Offline;
- informasi jadwal tutup/buka atau kondisi kuota penuh per mode.

Logika status tetap menggunakan endpoint dan pengaturan yang sama dengan v0.4.14. Update ini hanya merapikan tampilan homepage.

## Instalasi
1. Pastikan project saat ini sudah **v0.4.14**.
2. Stop development server.
3. Extract ZIP update ke root project dan pilih **Replace / Yes to All**.
4. Tidak ada migration SQL.
5. Tidak ada dependency baru, sehingga tidak perlu `npm install`.
6. Jalankan:

```powershell
npm run dev
```

## Checklist test
- Homepage hanya menampilkan status Online dan Offline pada card kanan.
- Ribbon `PENDAFTARAN` sudah tidak ada.
- Biaya, rekening, syarat, dan link persyaratan sudah tidak muncul di card tersebut.
- Status `Dibuka`, `Ditutup`, dan `Kuota penuh` tetap bekerja.
- `/daftar` tidak berubah.

## Sebelum production
```powershell
npm run build
npm run audit:prod

git add .
git commit -m "Simplify homepage registration status card v0.4.15"
git push origin main
```

## Day-H
Day-H Operations tetap ditunda sampai 6 Oktober dan tidak termasuk dalam update ini.
