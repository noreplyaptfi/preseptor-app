import PublicHeader from '../../components/PublicHeader';

const steps=[
  ['Pastikan memenuhi syarat','Peserta memiliki STRA dan memenuhi ketentuan pengalaman praktik atau pengalaman mengajar.'],
  ['Siapkan dokumen','Siapkan file STRA, bukti pengalaman praktik/mengajar, serta bukti pembayaran dalam format JPG, PNG, atau PDF.'],
  ['Isi formulir pendaftaran','Masukkan identitas, nomor STRA, data profesi, homebase, serta pilih mode Online atau Offline.'],
  ['Unggah dokumen','Unggah STRA, bukti pengalaman, dan bukti pembayaran. Maksimal 5 MB per file.'],
  ['Aktifkan akun peserta','Setelah pendaftaran berhasil, buka email dari APTFI dan buat password untuk Dashboard Peserta.'],
  ['Pantau proses verifikasi','Panitia memeriksa dokumen persyaratan dan bukti pembayaran. Status dapat dipantau dari dashboard.'],
  ['Perbaiki jika diminta','Jika ada dokumen ditolak, alasan dan langkah selanjutnya akan muncul di dashboard serta dikirim melalui email.'],
  ['Pendaftaran selesai','Jika dokumen dan pembayaran telah valid, status pendaftaran berubah menjadi Terverifikasi.']
];

export default function GuidePage(){
  return <main className="public-page">
    <div className="public-shell narrow-public">
      <PublicHeader compact/>
      <section className="page-heading guide-heading"><div className="eyebrow brand-blue">Panduan Pendaftaran</div><h1>Daftar dengan alur yang jelas.</h1><p>Luangkan beberapa menit untuk memastikan data dan dokumen sudah siap. Ini membantu proses verifikasi berlangsung lebih cepat.</p></section>
      <section className="guide-requirements">
        <div className="requirement-main"><span className="requirement-mark">✓</span><div><small>Syarat utama</small><h2>Peserta wajib terdaftar sebagai apoteker dan memiliki STRA.</h2></div></div>
        <div className="requirement-cards"><div><strong>Praktisi</strong><p>Apotek, rumah sakit, industri, atau PBF minimal 3 tahun; puskesmas minimal 1 tahun.</p></div><div><strong>Dosen</strong><p>Telah mengajar minimal 2 tahun.</p></div></div>
      </section>
      <section className="guide-steps"><div className="section-intro"><div className="eyebrow brand-blue">Step-by-step</div><h2>Tata cara pendaftaran</h2></div><div className="guide-step-list">{steps.map((s,i)=><article className="guide-step" key={s[0]}><span>{String(i+1).padStart(2,'0')}</span><div><h3>{s[0]}</h3><p>{s[1]}</p></div></article>)}</div></section>
      <section className="guide-docs panel-blue"><div><div className="eyebrow light">Checklist dokumen</div><h2>Siapkan sebelum membuka form</h2></div><ul><li>Nomor dan file STRA</li><li>Bukti pengalaman praktik atau mengajar</li><li>Bukti transfer biaya pendaftaran Rp 1.000.000</li><li>Email aktif dan nomor WhatsApp</li></ul></section>
      <section className="cta-card"><div><div className="eyebrow brand-blue">Sudah siap?</div><h2>Lanjutkan ke formulir pendaftaran.</h2><p>Pastikan seluruh file dapat dibaca dengan jelas sebelum diunggah.</p></div><a href="/daftar" className="btn btn-brand-primary">Daftar Sekarang</a></section>
      <footer className="public-footer"><a href="/">← Kembali ke beranda</a><a href="/login">Masuk Peserta</a></footer>
    </div>
  </main>
}
