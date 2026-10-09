'use client';
import { useState } from 'react';
import NavIcon from './NavIcon';
import FlowPhases from './FlowPhases';

// v0.8.0 — Panduan panitia: alur pelaksanaan Hari-H (H-1 → Hari 1 → Hari 2 → pasca acara)
// dan alur administrasi pendaftaran. Tombol aksi membuka menu terkait.

const ACCESS={
  dayh:['super_admin'],pretest:['super_admin'],evaluation:['super_admin'],posttest:['super_admin'],certificates:['super_admin'],testaccounts:['super_admin'],
  assets:['super_admin','event_admin'],documentation:['super_admin','event_admin'],announcements:null,access:null,participants:null,scan:null
};

export const EVENT_FLOW=[
  {id:'prep',chip:'H-1 · Selasa 6 Okt',title:'Persiapan',lead:'Selesaikan sebelum malam. Semua modul diuji dengan Akun Uji sebelum dibuka untuk peserta resmi.',steps:[
    {title:'Uji alur lengkap dengan Akun Uji',copy:'Buat akun TEST Online dan Offline. Login sebagai peserta, lalu jalankan presensi Hari 1 & 2 → Pretest → Evaluasi → Posttest → unduh sertifikat (bertanda TEST). Akun TEST melewati jadwal, tetapi tetap wajib presensi.',to:'testaccounts',cta:'Akun Uji'},
    {title:'Siapkan Pretest',copy:'Muat bank soal standar, Reset hasil TEST, pastikan jadwal 7 Okt 08.00–10.00 WIB dan prasyarat Hadir Hari 1. Aktifkan sebelum Hari 1.',to:'pretest',cta:'Pretest'},
    {title:'Aktifkan Hari-H',copy:'Di Command Center, aktifkan modul Hari-H dan cek jam presensi Hari 1 & 2 (default 07.00–09.00 WIB).',to:'dayh',cta:'Command Center'},
    {title:'Publikasikan akses acara',copy:'Isi dan publikasikan link Zoom (Online) serta info lokasi: nama tempat, alamat, kontak (Offline). QR presensi Offline tidak diatur di sini: QR ada di menu Kehadiran peserta dan muncul otomatis saat jam presensi.',to:'access',cta:'Akses Acara'},
    {title:'Unggah virtual background & materi',copy:'Unggah virtual background Zoom (1920 × 1080 px) dan materi yang sudah ada. Materi dari pemateri dapat menyusul.',to:'assets',cta:'Materi & Background'},
    {title:'Kirim pengumuman ke peserta',copy:'Bagikan jadwal, cara presensi (Online: tombol Check-in; Offline: tunjukkan QR di menu Kehadiran), dan pengingat Pretest.',to:'announcements',cta:'Pengumuman'},
    {title:'Siapkan HP panitia scanner',copy:'Login sekali di /admin/login memakai browser bawaan HP (Chrome/Safari), bukan dari dalam WhatsApp. Buka Scan QR → Buka kamera → izinkan kamera, lalu uji dengan QR Akun Uji Offline. Semua akun panitia bisa Scan QR.',to:'scan',cta:'Scan QR'}
  ]},
  {id:'day1',chip:'Hari 1 · Rabu 7 Okt',title:'Presensi & Pretest',lead:'Fokus: semua peserta tercatat hadir, lalu mengerjakan Pretest.',steps:[
    {time:'07.00–09.00',title:'Presensi Hari 1',copy:'Offline: di halaman Scan QR tekan Buka kamera, lalu pindai QR peserta satu per satu (presensi langsung tercatat). Online: peserta menekan Check-in di menu Kehadiran. Pantau angka hadir/belum hadir di Command Center.',to:'dayh',cta:'Command Center'},
    {time:'Sepanjang presensi',title:'Tangani kendala presensi',copy:'Peserta yang gagal presensi (sinyal, HP mati, QR tidak terbaca) dicatat lewat Check-in manual oleh Super Admin dengan alasan. Jam tutup bisa diperpanjang di Command Center.',to:'dayh',cta:'Check-in manual'},
    {time:'08.00–10.00',title:'Pretest',copy:'Sesuai rundown, Pretest dikerjakan pukul 08.45–09.00. Peserta wajib sudah presensi Hari 1. Pantau jumlah yang selesai di tab Hasil.',to:'pretest',cta:'Hasil Pretest'},
    {time:'Setelah sesi',title:'Unggah materi pemateri',copy:'Unggah materi Topik 1–4 begitu diterima dari pemateri. Materi langsung muncul di dashboard peserta.',to:'assets',cta:'Materi'}
  ]},
  {id:'day2',chip:'Hari 2 · Kamis 8 Okt',title:'Presensi, Evaluasi & Posttest',lead:'Fokus: semua peserta hadir, mengisi evaluasi pemateri, dan lulus Posttest.',steps:[
    {time:'07.00–09.00',title:'Presensi Hari 2',copy:'Alurnya sama dengan Hari 1. Presensi Hari 2 menjadi syarat Evaluasi, Posttest, dan sertifikat.',to:'dayh',cta:'Command Center'},
    {time:'Sebelum 14.00',title:'Aktifkan Evaluasi',copy:'Pastikan 6 pemateri sudah benar dan jadwal 14.00–17.00 WIB, lalu aktifkan. Evaluasi diisi sekali per peserta untuk setiap pemateri.',to:'evaluation',cta:'Evaluasi'},
    {time:'Sebelum 16.00',title:'Aktifkan Posttest',copy:'Jadwal 16.00–18.00 WIB (rundown 16.15–16.30). Peserta boleh mengulang selama jadwal dibuka; nilai terbaik dipakai, lulus ≥ 80.',to:'posttest',cta:'Posttest'},
    {time:'16.30–18.00',title:'Ingatkan yang belum lulus',copy:'Di Posttest → Hasil, saring peserta berstatus Belum lulus atau Belum, lalu ingatkan lewat Pengumuman atau grup WhatsApp sebelum jadwal ditutup.',to:'posttest',cta:'Hasil Posttest'},
    {time:'Setelah sesi',title:'Unggah materi Topik 5–9',copy:'Lengkapi materi Hari 2 agar peserta bisa mengunduh semua materi.',to:'assets',cta:'Materi'}
  ]},
  {id:'after',chip:'Setelah acara',title:'Sertifikat & laporan',lead:'Sertifikat hanya bisa diunduh peserta setelah dirilis Super Admin.',steps:[
    {title:'Periksa status sertifikat',copy:'Menu Sertifikat menampilkan 8 syarat per peserta: aktif, dokumen valid, pembayaran terverifikasi, hadir Hari 1 & 2, Pretest, Evaluasi, dan Posttest lulus.',to:'certificates',cta:'Sertifikat'},
    {title:'Selesaikan kasus khusus',copy:'Untuk kendala yang sudah dikonfirmasi panitia (misalnya presensi gagal), gunakan Check-in manual bila masih relevan, atau Terbitkan manual dengan alasan yang jelas.',to:'certificates',cta:'Terbitkan manual'},
    {title:'Finalkan template & rilis',copy:'Di Pengaturan template: unggah tanda tangan & cap, cek teks, nomor awal, dan tabel materi halaman 2 lewat tombol Contoh. Lengkapi tab Pemateri & Moderator. Klik Siapkan nomor (pemateri → moderator → peserta abjad), lalu Rilis ke peserta.',to:'certificates',cta:'Sertifikat'},
    {title:'Kirim sertifikat pemateri & moderator',copy:'Tab Pemateri & Moderator → Unduh per orang (2 halaman; versi Inggris untuk penerima luar negeri), lalu kirim lewat email/WhatsApp. QR di sertifikat bisa diverifikasi publik.',to:'certificates',cta:'Pemateri & Moderator'},
    {title:'Bagikan dokumentasi',copy:'Simpan foto & video di Google Drive / Google Photos / YouTube (akses: siapa saja yang memiliki link), lalu tempel tautannya di menu Dokumentasi. Bisa banyak tautan sekaligus dan dikelompokkan per hari.',to:'documentation',cta:'Dokumentasi'},
    {title:'Export laporan',copy:'Export Excel tersedia di Command Center (presensi), Pretest, Posttest (termasuk semua attempt), Evaluasi (rekap & jawaban), dan Sertifikat. Akun TEST tidak ikut export.',to:'dayh',cta:'Export presensi'},
    {title:'Kumpulkan NIK peserta SKP',copy:'Peserta SKP (ditandai di Pendaftar) wajib mengisi NIK di Profil Saya dan mendapat pengingat di dashboard; peserta lain boleh mengosongkan. Pantau di Ringkasan → Peserta SKP & NIK, kirim pengingat lewat Pengumuman (penerima "Peserta SKP yang belum mengisi NIK"), lalu Export Excel dengan filter SKP untuk mengambil kolom NIK.',to:'participants',cta:'Pendaftar'}
  ]}
];

const ISSUES=[
  ['Peserta lupa / gagal presensi','Super Admin melakukan Check-in manual di Command Center dengan alasan. Jangan membuat akun baru.'],
  ['Peserta Offline tidak menemukan QR','QR presensi hanya ada di menu Kehadiran (bukan Akses Acara) dan muncul otomatis saat jam presensi dibuka. Minta peserta membuka Kehadiran lalu menekan Perbarui.'],
  ['QR tidak bisa dipindai','Di halaman Scan QR tekan Buka kamera (izinkan akses kamera). Naikkan kecerahan layar HP peserta, coba Ganti kamera, atau pakai aplikasi kamera HP. Bila tetap gagal, salin token/URL QR ke kolom Input manual.'],
  ['Pretest / Posttest tidak bisa dibuka','Cek tiga hal: peserta sudah presensi hari yang disyaratkan, modul aktif, dan jam sedang di dalam jadwal.'],
  ['Nama di sertifikat salah','Peserta memperbaiki nama & gelar di Profil Saya, lalu mengunduh ulang. Nama mengikuti data terbaru setiap kali diunduh.'],
  ['Sertifikat terbit untuk orang yang salah','Cabut sertifikat dengan alasan. Halaman verifikasi otomatis menampilkan status dicabut.'],
  ['Materi terlalu besar (> 50 MB)','Unggah ke Google Drive lalu tambahkan sebagai Tautan di menu Materi.']
];

const ADMIN_FLOW=[
  ['Pantau pendaftaran','Buka Ringkasan untuk melihat total peserta, kuota, dokumen pending, pembayaran pending, dan status form.'],
  ['Review dokumen','Masuk ke Pendaftar, klik STRA atau Pengalaman. Periksa preview di popup, lalu Verifikasi atau Tolak. Penolakan wajib disertai alasan dan langkah selanjutnya.'],
  ['Verifikasi pembayaran','Klik dokumen Pembayaran pada peserta. Setelah bukti sesuai, verifikasi. Kwitansi otomatis tersedia setelah pembayaran terverifikasi.'],
  ['Profil peserta','Peserta dapat memperbarui nama, gelar, WhatsApp, homebase, STRA, dan data profesional dari Profil Saya. Perubahan STRA atau pengalaman otomatis kembali ke status Menunggu.'],
  ['Permintaan peserta','Perubahan email, mode Online/Offline, dan pengunduran diri tidak langsung diterapkan. Review dari menu Permintaan lalu Setujui atau Tolak dengan catatan yang jelas.'],
  ['Penolakan & pengunduran diri','Jika salah satu dokumen tidak valid, Super Admin/Admin Event dapat menolak pendaftaran dari detail peserta. Pendaftaran ditolak dan withdrawal yang disetujui tidak memakai kuota, tetapi datanya tetap tersimpan.'],
  ['Refund','Review pengajuan refund, ubah menjadi Siap Diproses, buat Batch, Export Excel untuk transfer massal, lalu tandai batch Selesai setelah transfer.'],
  ['Data Master & Homebase','Kelola jenis tempat praktik, minimum pengalaman, dan daftar perguruan tinggi. Opsi yang dinonaktifkan tidak menghapus data lama.'],
  ['Pengumuman & form','Gunakan Pengumuman untuk broadcast peserta dan Status Form untuk buka/tutup/maintenance pendaftaran.'],
  ['Peserta SKP & NIK','Status SKP diatur Super Admin/Admin Event: per peserta dari detail peserta (Tandai SKP / Keluarkan dari SKP) atau sekaligus lewat tombol Tandai SKP sekaligus (tempel Nomor Pendaftaran). Peserta SKP wajib mengisi NIK; peserta lain opsional dan tidak diingatkan. NIK lengkap hanya terlihat oleh Super Admin/Admin Event dan di Export Excel.']
];

function canOpen(role,to){
  const roles=ACCESS[to];
  return roles===null||roles===undefined||roles.includes(role);
}

export default function AdminGuide({role,onNavigate}){
  const [tab,setTab]=useState('event');
  const open=to=>{if(to==='scan'){location.href='/admin/checkin';return}onNavigate?.(to)};
  return <section className="admin-guide flow-guide">
    <div className="panel guide-hero">
      <div><div className="eyebrow brand-blue">Panduan Panitia</div><h2>{tab==='event'?'Alur pelaksanaan Hari-H sampai sertifikat':'Alur administrasi pendaftaran'}</h2><p>{tab==='event'?'Ikuti urutan ini dari H-1 sampai setelah acara. Klik tombol di setiap langkah untuk membuka menu terkait.':'Gunakan sebagai checklist harian selama masa pendaftaran dan verifikasi.'}</p></div>
      <div className="guide-security-note"><strong>Pembagian akses</strong><span>Command Center, check-in manual, Pretest/Evaluasi/Posttest, Akun Uji, dan Sertifikat hanya untuk Super Admin. Scan QR terbuka untuk semua panitia. Materi & Background untuk Super Admin dan Admin Event.</span></div>
    </div>
    <nav className="asm-tabs" role="tablist">
      <button type="button" className={tab==='event'?'active':''} onClick={()=>setTab('event')}>Pelaksanaan Hari-H</button>
      <button type="button" className={tab==='admin'?'active':''} onClick={()=>setTab('admin')}>Pendaftaran & administrasi</button>
    </nav>
    {tab==='event'&&<>
      <FlowPhases phases={EVENT_FLOW} renderAction={s=>s.to&&canOpen(role,s.to)?<button type="button" className="btn btn-secondary btn-small" onClick={()=>open(s.to)}>{s.cta||'Buka'} <NavIcon name="chevron-right" size={14}/></button>:null}/>
      <div className="panel guide-emergency"><h3>Kendala umum saat Hari-H</h3><div className="guide-emergency-grid">{ISSUES.map(([t,c])=><div key={t}><strong>{t}</strong><p>{c}</p></div>)}</div></div>
    </>}
    {tab==='admin'&&<div className="flow-simple">{ADMIN_FLOW.map(([t,c],i)=><article key={t} className="flow-step"><span className="flow-num">{i+1}</span><div className="flow-body"><h4>{t}</h4><p>{c}</p></div></article>)}</div>}
  </section>;
}
