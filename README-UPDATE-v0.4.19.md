# README UPDATE — v0.4.19

## Hotfix Export Excel Refund

Baseline: **v0.4.18** → target: **v0.4.19**.

### Masalah
`write-excel-file@4.1.1` tidak lagi menyediakan entry point `write-excel-file` untuk browser. Komponen Refund sebelumnya masih memakai dynamic import lama dan API v3 (`schema` + `fileName`), sehingga Next.js/Turbopack menampilkan `Module not found: Can't resolve 'write-excel-file'`.

### Perbaikan
- Browser import diubah menjadi `write-excel-file/browser`.
- Export refund menggunakan API v4: `writeExcelFile(...).toFile(...)`.
- Menghapus penggunaan `schema` lama yang sudah tidak didukung v4.
- Header, format nominal, dan lebar kolom Excel tetap dipertahankan.

### Instalasi
Tidak ada migration SQL dan tidak ada dependency baru.

Jika `write-excel-file@4.1.1` sudah terpasang, tidak perlu `npm install` ulang.

1. Stop dev server.
2. Extract patch ke root project dan Replace/Yes to All.
3. Bersihkan cache Next.js:
   ```powershell
   Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
   ```
4. Jalankan:
   ```powershell
   npm run dev
   ```
5. Pastikan warning `Can't resolve 'write-excel-file'` sudah tidak muncul.
6. Test Admin → Refund → Batch Refund → Export Excel.
7. Jalankan build:
   ```powershell
   npm run build
   npm run audit:prod
   ```

### Commit
```powershell
git add .
git commit -m "Fix refund Excel export for write-excel-file v4"
git push origin main
```
