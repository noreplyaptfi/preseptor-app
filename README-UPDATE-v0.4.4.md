# APTFI Preseptor Web App — Update v0.4.3 → v0.4.4

## Ringkasan
Update ini berfokus pada efisiensi dashboard panitia dan pengelolaan data operasional:

1. Sidebar admin dapat di-collapse/expand dan pilihan tersimpan di browser.
2. Tabel pendaftar dibuat lebih ringkas agar muat di satu layar desktop tanpa scroll horizontal pada ukuran normal.
3. Menu baru **Data Homebase** untuk CRUD perguruan tinggi.
4. Admin dapat mengubah data peserta dari popup **Lihat detail → Edit data**.
5. Tombol bantuan WhatsApp ke **+62 882-3893-5083** ditambahkan pada seluruh halaman user/publik.
6. Panduan Admin diperbarui agar mencakup koreksi peserta dan pengelolaan homebase.

## File yang berubah / ditambahkan
- `app/globals.css`
- `app/layout.js`
- `components/AdminDashboard.js`
- `components/RegistrationForm.js`
- `components/UniversityCombobox.js`
- `components/SupportWhatsApp.js` (baru)
- `app/api/universities/route.js` (baru)
- `app/api/admin/universities/route.js` (baru)
- `app/api/admin/participants/[id]/route.js` (baru)
- `supabase/migrations/009_admin_homebase_participant_edit.sql` (baru)
- `package.json`

## Migration SQL wajib
Di Supabase → SQL Editor, jalankan **hanya**:

```text
supabase/migrations/009_admin_homebase_participant_edit.sql
```

Migration ini:
- membuat tabel `public.universities`;
- mengisi katalog awal dari 252 homebase yang sebelumnya berada di `public/universities.json`;
- membuat trigger keamanan kuota saat admin mengubah mode peserta Online ↔ Offline.

Jangan menjalankan ulang migration 001–008.

## Cara update
1. Stop dev server:

```powershell
Ctrl + C
```

2. Backup/commit project bila perlu.
3. Extract patch ke root project dan pilih **Replace / Yes to All**.
4. Jalankan migration `009_admin_homebase_participant_edit.sql` di Supabase.
5. Tidak ada dependency baru, sehingga `npm install` **tidak wajib**.
6. Jalankan:

```powershell
npm run dev
```

7. Setelah test lokal lolos:

```powershell
npm run build
git add .
git commit -m "Release Preseptor App v0.4.4"
git push origin main
```

## Perubahan dashboard admin
### Sidebar collapse
- Tombol `‹ / ›` di bagian atas sidebar.
- Saat collapsed hanya icon yang ditampilkan.
- Status collapse tersimpan di `localStorage` browser.
- Mobile tetap menggunakan navigasi horizontal seperti sebelumnya.

### Tabel pendaftar compact
Kolom utama sekarang hanya:
- Pendaftar + nomor registrasi + WhatsApp
- Mode
- Status dokumen & pembayaran
- Tombol dokumen STRA / EXP / PAY
- Tagihan / Kwitansi
- Lihat detail

Email, homebase, profesi, STRA, pengalaman, dan detail lainnya tetap tersedia pada popup **Lihat detail**.

### Data Homebase
Role `Super Admin` dan `Admin Event` mendapatkan menu **Data Homebase**.

Fitur:
- tambah homebase;
- edit nama;
- nonaktifkan;
- aktifkan kembali;
- pencarian.

Penghapusan menggunakan metode **soft delete/nonaktif** agar pendaftaran lama tetap konsisten. Homebase nonaktif tidak muncul lagi pada form pendaftaran baru.

## Koreksi data peserta
Admin `Super Admin` dan `Admin Event` dapat:

`Pendaftar → Lihat detail → Edit data`

Data yang dapat diubah:
- nama;
- email;
- WhatsApp;
- Nomor STRA;
- homebase;
- mode Online/Offline;
- kategori peserta;
- jenis/nama tempat praktik;
- lama praktik;
- lama mengajar.

### Perlindungan verifikasi
Jika admin mengubah:
- Nomor STRA → dokumen STRA kembali `Menunggu`;
- data profesi/pengalaman → Bukti Pengalaman kembali `Menunggu`.

Hal ini mencegah data yang sudah berubah tetap dianggap tervalidasi berdasarkan dokumen lama.

Perubahan tercatat ke `activity_logs`.

Jika email peserta yang sudah memiliki akun Auth berubah, sistem juga mencoba memperbarui email login Supabase Auth. Jika proses Auth gagal, perubahan email dibatalkan agar data login dan registrasi tidak berbeda.

Perubahan mode Online/Offline tetap mematuhi kuota event.

## Bantuan WhatsApp peserta
Seluruh halaman publik/user sekarang mempunyai tombol bantuan mengambang menuju:

**+62 882-3893-5083**

Tombol tidak ditampilkan pada halaman `/admin`.

## Checklist test
Setelah update, cek:

- [ ] Sidebar dapat collapse dan expand.
- [ ] Refresh halaman mempertahankan state sidebar.
- [ ] Tabel Pendaftar tidak perlu scroll horizontal pada desktop normal.
- [ ] Nomor WhatsApp muncul dan tombol membuka WhatsApp.
- [ ] Lihat Detail menampilkan informasi lengkap.
- [ ] Edit Data berhasil mengubah nama/WhatsApp/homebase.
- [ ] Mengubah Nomor STRA mengembalikan review STRA ke pending.
- [ ] Mengubah data pengalaman mengembalikan Bukti Pengalaman ke pending.
- [ ] Perubahan mode ditolak bila kuota tujuan penuh.
- [ ] Menu Data Homebase dapat tambah/edit/nonaktif/aktifkan.
- [ ] Homebase baru muncul di form `/daftar`.
- [ ] Homebase nonaktif tidak muncul pada form peserta baru.
- [ ] Tombol WhatsApp bantuan terlihat pada beranda, panduan, form, login, dan dashboard peserta.
- [ ] Tombol WhatsApp bantuan tidak terlihat di admin.
- [ ] `npm run build` sukses.

## Rollback
Jika perlu rollback sebelum production:
- restore file project ke commit v0.4.3;
- tabel `universities` dan trigger migration 009 boleh dibiarkan karena tidak mengganggu v0.4.3;
- bila ingin membersihkan penuh, lakukan hanya setelah backup dan jangan hapus data homebase yang sudah diedit admin.
