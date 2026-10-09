import PublicHeader from '../../../components/PublicHeader';
import { getSupabaseAdmin } from '../../../lib/supabase-admin';
import { certificateConfig,certificateNumber,RECIPIENT_ROLES } from '../../../lib/certificate';

// v0.8.0 — Verifikasi keaslian sertifikat (publik). Dibuka dari QR code di sertifikat.
// v0.8.6 — + sertifikat pemateri & moderator.
export const dynamic='force-dynamic';
export const metadata={title:'Verifikasi Sertifikat · APTFI Preseptor',robots:{index:false,follow:false}};

function fmtDate(v){if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'long',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return String(v)}}

async function lookup(code){
  if(!/^[A-Z0-9]{6,20}$/.test(code))return null;
  const db=getSupabaseAdmin();
  const {data:cert}=await db.from('certificates').select('*').eq('verify_code',code).maybeSingle();
  if(!cert)return null;
  const [{data:event},{data:reg},{data:recipient}]=await Promise.all([
    db.from('events').select('title,certificate_config').eq('id',cert.event_id).maybeSingle(),
    cert.registration_id?db.from('registrations').select('full_name,attendance_mode').eq('id',cert.registration_id).maybeSingle():Promise.resolve({data:null}),
    cert.recipient_id?db.from('certificate_recipients').select('name,role,attendance_mode').eq('id',cert.recipient_id).maybeSingle():Promise.resolve({data:null})
  ]);
  const config=certificateConfig(event?.certificate_config);
  const mode=recipient?recipient.attendance_mode:reg?.attendance_mode;
  return {
    name:cert.name_on_certificate||recipient?.name||reg?.full_name||'—',
    role:recipient?(RECIPIENT_ROLES[recipient.role]?.label||'—'):'Peserta',
    number:certificateNumber(config,cert.serial,cert.is_test),
    eventName:config.event_name,
    organizer:config.organizer,
    dateText:config.date_text,
    mode:mode==='Offline'?`Luring · ${config.location_text}`:mode==='Online'?'Daring · Zoom Meeting':'',
    issuedAt:cert.issued_at,
    revoked:!!cert.revoked_at,
    test:!!cert.is_test
  };
}

export default async function VerifyCertificate({params}){
  const {code:raw}=await params;
  const code=String(raw||'').toUpperCase().trim();
  const c=await lookup(code);
  const state=!c?'missing':c.test?'test':c.revoked?'revoked':'valid';
  const copy={
    valid:{icon:'✓',title:'Sertifikat valid',text:'Sertifikat ini tercatat resmi di Sistem Pelatihan Preseptor APTFI.'},
    test:{icon:'!',title:'Sertifikat uji — tidak berlaku',text:'Sertifikat ini berasal dari akun uji coba panitia dan tidak berlaku sebagai sertifikat resmi.'},
    revoked:{icon:'!',title:'Sertifikat telah dicabut',text:'Sertifikat ini pernah diterbitkan, tetapi telah dicabut oleh panitia dan tidak berlaku.'},
    missing:{icon:'?',title:'Sertifikat tidak ditemukan',text:'Kode verifikasi tidak dikenali. Pastikan Anda memindai QR code langsung dari sertifikat.'}
  }[state];
  return <main className="public-page">
    <div className="public-shell">
      <PublicHeader/>
      <section className={`verify-card verify-${state}`}>
        <div className="verify-icon" aria-hidden="true">{copy.icon}</div>
        <div className="eyebrow brand-blue">Verifikasi Sertifikat</div>
        <h1>{copy.title}</h1>
        <p>{copy.text}</p>
        {c&&<dl className="verify-data">
          <div><dt>Nama</dt><dd>{c.name}</dd></div>
          <div><dt>Peran</dt><dd>{c.role}</dd></div>
          <div><dt>Nomor sertifikat</dt><dd>{c.number}</dd></div>
          <div><dt>Kegiatan</dt><dd>{c.eventName}</dd></div>
          <div><dt>Penyelenggara</dt><dd>{c.organizer}</dd></div>
          <div><dt>Pelaksanaan</dt><dd>{c.dateText}{c.mode?` · ${c.mode}`:''}</dd></div>
          <div><dt>Diterbitkan</dt><dd>{fmtDate(c.issuedAt)}</dd></div>
        </dl>}
        <small className="verify-code">Kode verifikasi: {code||'—'}</small>
      </section>
      <footer className="public-footer"><span>© 2026 Asosiasi Pendidikan Tinggi Farmasi Indonesia</span><a href="/">Beranda</a></footer>
    </div>
  </main>;
}
