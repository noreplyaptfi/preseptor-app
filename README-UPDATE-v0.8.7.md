# APTFI Preseptor — Update v0.8.6 → v0.8.7

## Tabel materi halaman 2: sebagian kata bisa dicetak miring

Baseline: **v0.8.6**. Tanpa migration, tanpa dependency baru.

- Di **Sertifikat → Pengaturan template → Halaman 2 · tabel materi**, kata atau kalimat yang diapit garis bawah `_..._` dicetak miring.
- Sekarang boleh **sebagian kata saja**. Sebelumnya hanya bisa satu baris penuh.
- Pratinjau tabel di halaman pengaturan ikut menampilkan huruf miring.

Contoh:

```text
Peran Preseptor Sebagai _Role Model_ dan Edukator | 1,5
_Interprofesional Education_ dan _Interprofesional Collaboration_ | 1,5
_Sharing Experiences_ | 1
```

Berlaku juga untuk tabel versi Inggris.

## File
Diubah:
- `lib/certificate.js`
- `lib/certificate-pdf.js`
- `components/CertificatesAdmin.js`

Baru:
- `README-UPDATE-v0.8.7.md`

## Cara pasang
1. Stop `npm run dev`.
2. Extract ZIP ke root project, lalu pilih **Replace / Yes to All**.
3. Jalankan `npm run dev`.
4. Test: ubah satu baris tabel materi seperti contoh → pratinjau tabel menampilkan huruf miring → **Simpan** → **Contoh Peserta Offline** → halaman 2 sesuai.

## Push
```powershell
npm run build
git add .
git commit -m "Certificate syllabus: partial italics with _..._ v0.8.7"
git push origin main
```

## Migration / Dependency
- SQL migration: **TIDAK**
- npm install: **TIDAK**
