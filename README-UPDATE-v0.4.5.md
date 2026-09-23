# APTFI Preseptor Web App — Update v0.4.5

Hotfix untuk fitur **Edit Data Peserta** pada v0.4.4.

## Masalah yang diperbaiki

Pada peserta legacy hasil migrasi WordPress, `participant_type` di database bernilai `NULL` karena data profesi belum dilengkapi. Form edit admin menampilkan pilihan **Belum dilengkapi** dengan value string kosong (`""`). Route PATCH v0.4.4 kemudian menyimpan string kosong tersebut ke kolom `registrations.participant_type`.

Kolom database hanya mengizinkan:
- `practitioner`
- `lecturer`
- `lecturer_practitioner`
- `NULL`

Akibatnya PostgreSQL menolak update dengan check-constraint violation dan API mengembalikan HTTP 500.

## Perubahan

- Nilai kosong `participant_type` sekarang dinormalisasi menjadi `NULL` sebelum update database.
- `practice_type`, `practice_name`, dan `stra_number` kosong juga dinormalisasi menjadi `NULL` agar data legacy tetap konsisten.
- Validasi kategori peserta menerima `NULL` sebagai kondisi **Belum dilengkapi**.
- Logging error database pada route edit peserta diperjelas untuk troubleshooting development berikutnya.
- Tidak ada perubahan schema database.
- Tidak ada dependency baru.

## Cara update dari v0.4.4

1. Stop dev server (`Ctrl + C`).
2. Backup/commit perubahan lokal bila perlu.
3. Extract ZIP patch ke root project dan pilih **Replace / Yes to All**.
4. Tidak perlu menjalankan migration SQL.
5. Tidak perlu `npm install`.
6. Jalankan:

```powershell
npm run dev
```

## Test wajib

Test minimal pada satu peserta legacy:

1. Buka **Admin → Pendaftar → Lihat detail → Edit data**.
2. Ubah hanya nama / WhatsApp / homebase lalu Simpan.
3. Pastikan perubahan tersimpan.
4. Coba simpan peserta dengan kategori **Belum dilengkapi**.
5. Coba pilih kategori peserta yang valid lalu Simpan.
6. Refresh dashboard dan pastikan data tetap tersimpan.

Sebelum production:

```powershell
npm run build
git add .
git commit -m "Hotfix participant edit v0.4.5"
git push origin main
```
