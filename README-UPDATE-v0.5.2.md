# APTFI Preseptor — Update v0.5.1 → v0.5.2

## Participant Mobile Layout & Drawer Sidebar

Update ini memperbaiki tampilan Dashboard Peserta pada layar kecil/HP setelah perubahan sidebar di v0.5.0.

### Perubahan

1. **Spacing mobile dikembalikan**
   - Dashboard tidak lagi menempel ke tepi viewport.
   - Seluruh konten peserta memiliki inset kiri/kanan yang konsisten.
   - Horizontal overflow dari menu mobile lama dihilangkan.

2. **Menu peserta menjadi drawer/sidebar buka-tutup di HP**
   - Tombol menu `☰` tampil di header mobile.
   - Sidebar muncul dari kiri sebagai off-canvas drawer.
   - Klik area gelap di luar sidebar, tombol `×`, atau pilih menu untuk menutup drawer.
   - Tombol `Esc` juga menutup drawer.
   - Background page dikunci dari scroll selama drawer terbuka.

3. **Desktop tetap memakai sidebar**
   - Sidebar desktop dan fitur collapse tetap dipertahankan.
   - Perubahan ini hanya mengubah perilaku navigasi pada layar `<= 760px`.

4. **Branding mobile tetap tampil**
   - Logo APTFI tetap tampil di header mobile.
   - Logo dalam drawer tetap memakai container putih agar kontras dengan sidebar navy.

## Instalasi

Baseline: **v0.5.1**.

1. Stop development server.
2. Extract ZIP ini ke root project.
3. Pilih **Replace / Yes to All**.
4. Tidak ada dependency baru.
5. Tidak ada migration SQL.
6. Jalankan:

```powershell
npm run dev
```

## Test checklist

Gunakan DevTools responsive mode atau HP asli.

- Lebar 320–760px:
  - ada ruang kiri/kanan di seluruh dashboard;
  - tidak ada horizontal scrollbar karena menu;
  - tombol `☰` terlihat di header;
  - klik `☰` membuka sidebar dari kiri;
  - klik `×` atau backdrop menutup sidebar;
  - memilih `Pendaftaran`, `Profil Saya`, `Kehadiran`, `Akses Acara`, atau `Pengumuman` menutup sidebar dan berpindah tab;
  - tombol `Keluar` tetap terlihat;
  - status card dan progress card tidak menempel ke tepi layar.

- Desktop > 760px:
  - sidebar tetap tampil;
  - tombol collapse `‹ / ›` tetap berfungsi;
  - tidak ada perubahan perilaku dashboard desktop.

## Migration

- SQL migration: **TIDAK**
- npm install: **TIDAK**
