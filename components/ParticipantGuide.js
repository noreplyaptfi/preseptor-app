'use client';
import NavIcon from './NavIcon';
import FlowPhases from './FlowPhases';

// v0.8.0 — Panduan peserta: alur dari persiapan, Hari 1, Hari 2, sampai sertifikat. Disesuaikan mode Online/Offline.

function phasesFor(mode){
  const online=mode!=='Offline';
  return [
    {id:'prep',chip:'Sebelum acara',title:'Persiapan',lead:'Lakukan paling lambat malam sebelum Hari 1.',steps:[
      {title:'Pastikan pendaftaran terverifikasi',copy:'Menu Status Pendaftaran harus menunjukkan Persyaratan Valid dan Pembayaran Terverifikasi. Presensi, assessment, materi, dan sertifikat hanya terbuka untuk peserta terverifikasi.',to:'registration',cta:'Status'},
      {title:'Periksa nama & gelar',copy:'Nama dan gelar di Profil Saya akan tercetak di sertifikat. Perbaiki sekarang bila ada yang kurang tepat.',to:'profile',cta:'Profil Saya'},
      online
        ?{title:'Siapkan Zoom & virtual background',copy:'Buka Akses Acara untuk link Zoom. Unduh virtual background resmi dan pasang di aplikasi Zoom.',to:'backgrounds',cta:'Virtual Background'}
        :{title:'Cek lokasi & siapkan HP',copy:'Lihat nama tempat, alamat, dan peta di menu Akses Acara. Pastikan Anda bisa login ke dashboard dari HP (Chrome/Safari). QR presensi hanya ada di menu Kehadiran dan muncul saat jam presensi dibuka.',to:'access',cta:'Lokasi'},
      {title:'Baca pengumuman panitia',copy:'Informasi jadwal, lokasi, dan perubahan teknis disampaikan melalui menu Pengumuman.',to:'announcements',cta:'Pengumuman'}
    ]},
    {id:'day1',chip:'Hari 1 · Rabu 7 Okt',title:'Presensi & Pretest',steps:[
      {time:'07.00–09.00',title:'Presensi Hari 1',copy:online?'Buka menu Kehadiran, lalu tekan tombol Check-in Hari 1. Pastikan statusnya berubah menjadi Hadir.':'Buka menu Kehadiran dan tunjukkan QR Hari 1 kepada panitia di meja registrasi. Status berubah menjadi Hadir setelah dipindai. QR muncul otomatis pukul 07.00.',to:'attendance',cta:'Kehadiran'},
      {time:'08.00–10.00',title:'Kerjakan Pretest',copy:'Pretest dikerjakan saat sesi pembukaan (sesuai rundown 08.45–09.00). Pretest hanya bisa dikirim satu kali, jadi periksa jawaban sebelum mengirim.',to:'pretest',cta:'Pretest'},
      {title:'Ikuti sesi & unduh materi',copy:'Materi dari pemateri diunggah panitia setelah sesi dan dapat diunduh di menu Materi.',to:'materials',cta:'Materi'}
    ]},
    {id:'day2',chip:'Hari 2 · Kamis 8 Okt',title:'Presensi, Evaluasi & Posttest',steps:[
      {time:'07.00–09.00',title:'Presensi Hari 2',copy:online?'Tekan Check-in Hari 2 di menu Kehadiran. Presensi Hari 2 wajib untuk Evaluasi, Posttest, dan sertifikat.':'Tunjukkan QR Hari 2 kepada panitia. Presensi Hari 2 wajib untuk Evaluasi, Posttest, dan sertifikat.',to:'attendance',cta:'Kehadiran'},
      {time:'14.00–17.00',title:'Isi evaluasi pemateri',copy:'Nilai setiap pemateri (skala 1–5) dan beri saran. Evaluasi dikirim satu kali dan menjadi syarat sertifikat.',to:'evaluation',cta:'Evaluasi'},
      {time:'16.00–18.00',title:'Kerjakan Posttest',copy:'Posttest boleh diulang selama jadwal masih dibuka. Nilai terbaik yang dipakai, dan batas lulus adalah 80.',to:'posttest',cta:'Posttest'}
    ]},
    {id:'after',chip:'Setelah acara',title:'Sertifikat',steps:[
      {title:'Cek syarat sertifikat',copy:'Menu Sertifikat menampilkan 8 syarat: pendaftaran aktif, dokumen valid, pembayaran terverifikasi, hadir Hari 1 & 2, Pretest, Evaluasi, dan Posttest lulus.',to:'certificate',cta:'Sertifikat'},
      {title:'Unduh sertifikat',copy:'Sertifikat dapat diunduh dalam format PDF setelah dirilis panitia. Setiap sertifikat memiliki QR code untuk verifikasi keaslian.',to:'certificate',cta:'Sertifikat'}
    ]}
  ];
}

export default function ParticipantGuide({mode,onOpen}){
  return <div className="flow-guide participant-guide">
    <section className="participant-card guide-intro">
      <div className="participant-card-head"><div><div className="eyebrow brand-blue">Panduan Peserta · {mode==='Offline'?'Offline (luring)':'Online (daring)'}</div><h2>Alur mengikuti pelatihan sampai sertifikat</h2><p>Ikuti langkah berikut secara berurutan. Tekan tombol di setiap langkah untuk langsung membuka menu terkait.</p></div></div>
    </section>
    <FlowPhases phases={phasesFor(mode)} renderAction={s=>s.to?<button type="button" className="btn btn-secondary btn-small" onClick={()=>onOpen(s.to)}>{s.cta||'Buka'} <NavIcon name="chevron-right" size={14}/></button>:null}/>
    <section className="participant-card guide-help">
      <h3>Butuh bantuan?</h3>
      <p>Gunakan tombol WhatsApp di pojok kanan bawah untuk menghubungi panitia. Sertakan nomor pendaftaran agar kendala Anda cepat ditangani.</p>
    </section>
  </div>;
}
