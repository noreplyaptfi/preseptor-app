import PublicHeader from '../../components/PublicHeader';
import MaintenanceCountdown from '../../components/MaintenanceCountdown';
import RegistrationForm from '../../components/RegistrationForm';
import { getSupabaseAdmin } from '../../lib/supabase-admin';
import { resolveEventState } from '../../lib/event-state';

export const dynamic='force-dynamic';
export default async function RegisterPage(){
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event,error}=await db.from('events').select('*').eq('slug',slug).single();
  if(error||!event) return <main className="public-page"><div className="public-shell narrow-public"><PublicHeader compact/><div className="alert alert-error">Konfigurasi event belum tersedia.</div></div></main>;
  const state=resolveEventState(event);
  return <main className="public-page">
    <div className="public-shell register-shell">
      <PublicHeader compact/>
      <section className="page-heading register-heading"><div><div className="eyebrow brand-blue">Pendaftaran Peserta</div><h1>Pelatihan Preseptor APTFI</h1><p>7–8 Oktober 2026 · Padang · Online & Offline</p></div><a href="/panduan" className="guide-inline-card"><strong>Belum membaca panduan?</strong><span>Lihat syarat dan alur pendaftaran →</span></a></section>
      {!state.isOpen?<section className="maintenance-card"><div className="maintenance-orb">i</div><div className="eyebrow brand-blue">Informasi Pendaftaran</div><h2>{state.status==='maintenance'?'Form sedang dalam perbaikan':state.status==='not_open'?'Pendaftaran belum dibuka':'Pendaftaran telah ditutup'}</h2><p>{state.message}</p>{state.status==='maintenance'&&state.maintenanceUntil&&<><MaintenanceCountdown until={state.maintenanceUntil}/><p className="maintenance-note">Data peserta yang sudah masuk tetap aman dan tidak perlu didaftarkan ulang.</p></>}<div className="landing-actions center-actions"><a href="/panduan" className="btn btn-brand-secondary">Baca Panduan</a><a href="/login" className="btn btn-brand-primary">Masuk Peserta</a></div></section>:<RegistrationForm/>}
      <footer className="public-footer"><a href="/">← Kembali ke beranda</a><span>APTFI · Preseptor 2026</span></footer>
    </div>
  </main>
}
