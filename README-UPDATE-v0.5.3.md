# APTFI Preseptor — Update v0.5.2 → v0.5.3

## Header Mobile & Logout Sidebar

Perubahan sesuai revisi UI Dashboard Peserta:

- logo tetap di kiri atas pada layar kecil;
- tombol menu `☰` dipindah ke kanan atas;
- tombol `Keluar` dihapus dari header;
- `Keluar` menjadi satu item di sidebar/drawer;
- pada mobile, item `Keluar` ditempatkan di bagian bawah drawer;
- pada desktop, logout juga tetap berada di sidebar agar konsisten;
- tidak ada perubahan database atau dependency.

## Instalasi

Baseline: **v0.5.2**

1. Stop `npm run dev`.
2. Extract ZIP ke root project.
3. Replace / Yes to All.
4. Jalankan kembali:

```powershell
npm run dev
```

## Test

### Mobile
- logo APTFI berada di kiri header;
- tombol `☰` berada di kanan header;
- tidak ada tombol `Keluar` di header;
- buka sidebar, item `Keluar` berada di bawah;
- klik `Keluar` tetap sign out dan kembali ke halaman awal/login.

### Desktop
- sidebar tetap tampil;
- logout berada di sidebar;
- collapse sidebar tetap berfungsi.

## Migration
- SQL migration: **TIDAK**
- npm install: **TIDAK**
