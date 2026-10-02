import PublicHeader from '../components/PublicHeader';
import PublicEventSummary from '../components/PublicEventSummary';
import { getSupabaseAdmin } from '../lib/supabase-admin';
import { resolveEventState } from '../lib/event-state';
import LandingRegistrationStatus from '../components/LandingRegistrationStatus';

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
        <LandingRegistrationStatus />
      </section>
      <PublicEventSummary/>
      <section className="landing-choice-section landing-prep-section">
        <div className="section-intro"><div className="eyebrow brand-blue">Sebelum mendaftar</div><h2>Siapkan dokumen utama</h2><p>Pastikan dokumen terbaca jelas agar proses verifikasi panitia lebih cepat.</p></div>
        <div className="prep-grid">
          <article className="prep-card"><span>01</span><div><h3>STRA</h3><p>Siapkan nomor dan scan/foto STRA yang masih dapat dibaca dengan jelas.</p></div></article>
          <article className="prep-card"><span>02</span><div><h3>Bukti pengalaman</h3><p>Gunakan surat keterangan, SK, atau dokumen resmi yang menunjukkan masa praktik/mengajar.</p></div></article>
          <article className="prep-card"><span>03</span><div><h3>Bukti pembayaran</h3><p>Siapkan bukti transfer sesuai informasi rekening pada formulir pendaftaran.</p></div></article>
        </div>
      </section>
      <footer className="public-footer"><span>© 2026 Asosiasi Pendidikan Tinggi Farmasi Indonesia</span><a href="/login">Dashboard Peserta</a></footer>
    </div>
  </main>
}
