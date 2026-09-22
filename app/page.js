import PublicHeader from '../components/PublicHeader';
import PublicEventSummary from '../components/PublicEventSummary';
import { getSupabaseAdmin } from '../lib/supabase-admin';
import { resolveEventState } from '../lib/event-state';

export const dynamic='force-dynamic';

export default async function Home(){
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event}=await db.from('events').select('*').eq('slug',slug).single();
  const state=event?resolveEventState(event):null;
  return <main className="public-page">
    <div className="public-shell">
      <PublicHeader/>
      <section className="landing-hero">
        <div className="landing-hero-copy">
          <div className="event-kicker">Pelatihan Preseptor APTFI 2026</div>
          <h1>Menyiapkan preseptor yang siap membimbing, mengevaluasi, dan menjadi teladan.</h1>
          <p>Pelatihan hybrid untuk apoteker praktisi dan dosen yang memenuhi persyaratan pengalaman. Pelaksanaan 7–8 Oktober 2026 di Padang dan melalui Zoom Meeting.</p>
          {state&&!state.isOpen&&<div className={`landing-state state-${state.status}`}><strong>{state.status==='maintenance'?'Pendaftaran sedang dalam pemeliharaan':state.status==='not_open'?'Pendaftaran belum dibuka':'Pendaftaran ditutup'}</strong><span>{state.message}</span></div>}
          <div className="landing-actions">
            <a href="/daftar" className="btn btn-brand-primary">Daftar Sekarang</a>
            <a href="/panduan" className="btn btn-brand-secondary">Baca Panduan</a>
          </div>
          <div className="trust-row"><span>Dokumen privat</span><span>Status dapat dipantau</span><span>Email konfirmasi otomatis</span></div>
        </div>
        <aside className="landing-info-card">
          <div className="info-ribbon">Pendaftaran</div>
          <div className="landing-info-block"><small>Batas pendaftaran</small><strong>1 Oktober 2026</strong><span>atau jika kuota telah terpenuhi</span></div>
          <div className="landing-info-block"><small>Biaya pendaftaran</small><strong>Rp 1.000.000</strong><span>BNI 6666512055 · a.n APTFI</span></div>
          <div className="landing-info-block"><small>Syarat utama</small><ul><li>Memiliki STRA</li><li>Pengalaman praktik/mengajar sesuai ketentuan</li></ul></div>
          <a href="/panduan" className="text-link">Lihat persyaratan lengkap →</a>
        </aside>
      </section>
      <PublicEventSummary/>
      <section className="landing-choice-section">
        <div className="section-intro"><div className="eyebrow brand-blue">Mulai dari sini</div><h2>Pilih langkah yang paling sesuai</h2><p>Jika baru pertama kali membuka halaman ini, kami sarankan membaca panduan singkat sebelum mengisi form.</p></div>
        <div className="choice-grid">
          <a className="choice-card guide" href="/panduan"><span className="choice-number">01</span><div><h3>Baca Panduan</h3><p>Lihat syarat peserta, dokumen yang perlu disiapkan, alur verifikasi, dan tahapan setelah mendaftar.</p><strong>Pelajari tata cara →</strong></div></a>
          <a className="choice-card register" href="/daftar"><span className="choice-number">02</span><div><h3>Daftar Sekarang</h3><p>Sudah menyiapkan STRA, bukti pengalaman, dan bukti pembayaran? Lanjutkan ke formulir.</p><strong>Buka formulir →</strong></div></a>
        </div>
      </section>
      <footer className="public-footer"><span>© 2026 Asosiasi Pendidikan Tinggi Farmasi Indonesia</span><a href="/login">Dashboard Peserta</a></footer>
    </div>
  </main>
}
