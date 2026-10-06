import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { logActivity } from '../../../../lib/audit';
import { CERTIFICATE_DEFAULTS,CERTIFICATE_FIELDS,certificateConfig,formatCertificateNo,STATUS_LABEL } from '../../../../lib/certificate';
import { certificateEvent,allCertificates,registrationById,publicCertificate,isTestReg,participantCertificate } from '../../../../lib/certificate-data';
import { displayName } from '../../../../lib/profile';

// v0.8.0 — Admin sertifikat (Super Admin): status semua peserta, pengaturan rilis & template, terbit manual, cabut.
export const dynamic='force-dynamic';
const NO_STORE={headers:{'Cache-Control':'private, no-store'}};

function fail(message,status=500){return NextResponse.json({message},{status})}
function fmt(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return String(v)}}

async function ctx(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return {response:fail(auth.error,auth.status)};
  const db=getSupabaseAdmin();
  try{
    const event=await certificateEvent(db);
    if(!event)return {response:fail('Event tidak ditemukan.',404)};
    return {auth,db,event};
  }catch(e){return {response:fail(e.message)}}
}

function rowView(r,config,request){
  const items=Object.fromEntries(r.checklist.items.map(i=>[i.key,i.ok]));
  return {
    id:r.reg.id,
    registration_code:r.reg.registration_code,
    name:displayName(r.reg)||r.reg.full_name,
    email:r.reg.email,
    university:r.reg.university,
    attendance_mode:r.reg.attendance_mode,
    lifecycle_status:r.reg.lifecycle_status,
    test:isTestReg(r.reg),
    items,
    missing:r.checklist.items.filter(i=>!i.ok).map(i=>i.label),
    best:r.checklist.best,
    eligible:r.checklist.eligible,
    status:r.status,
    statusLabel:STATUS_LABEL[r.status],
    certificate:publicCertificate(r.cert,config,request)
  };
}

export async function GET(request){
  const c=await ctx(request);
  if(c.response)return c.response;
  try{
    const data=await allCertificates(c.db,c.event);
    const rows=data.rows.map(r=>rowView(r,data.config,request));
    const official=rows.filter(r=>!r.test&&['active','withdrawal_requested'].includes(String(r.lifecycle_status||'active')));
    if(new URL(request.url).searchParams.get('export')==='1'){
      const yes=v=>v?'Ya':'Belum';
      const columns=[
        {header:'No. Pendaftaran',width:18},{header:'Nama',width:36},{header:'Email',width:30},{header:'Homebase',width:30},{header:'Mode',width:10},
        {header:'Dokumen',width:10},{header:'Pembayaran',width:12},{header:'Hari 1',width:9},{header:'Hari 2',width:9},
        {header:'Pretest',width:9},{header:'Evaluasi',width:10},{header:'Posttest terbaik',width:14},{header:'Posttest lulus',width:13},
        {header:'Status',width:22},{header:'Nomor sertifikat',width:32},{header:'Terbit',width:20},{header:'Jenis terbit',width:12},{header:'Diunduh (x)',width:11}
      ];
      const out=official.map(r=>[
        r.registration_code||'',r.name||'',r.email||'',r.university||'',r.attendance_mode||'',
        yes(r.items.requirements),yes(r.items.payment),yes(r.items.day1),yes(r.items.day2),
        yes(r.items.pretest),yes(r.items.evaluation),r.best??'',yes(r.items.posttest),
        r.statusLabel,r.certificate?.number||'',r.certificate?fmt(r.certificate.issued_at):'',r.certificate?(r.certificate.issued_via==='manual'?'Manual':'Otomatis'):'',r.certificate?.download_count??''
      ]);
      return NextResponse.json({filename:'sertifikat-preseptor-2026.xlsx',sheet:'Sertifikat',columns,rows:out},NO_STORE);
    }
    const stats={
      participants:official.length,
      eligible:official.filter(r=>r.eligible).length,
      issued:official.filter(r=>r.certificate&&!r.certificate.revoked_at).length,
      downloaded:official.filter(r=>(r.certificate?.download_count||0)>0).length,
      manual:official.filter(r=>r.certificate?.issued_via==='manual').length,
      testAccounts:rows.filter(r=>r.test).length
    };
    return NextResponse.json({
      released:!!c.event.certificate_enabled,
      config:data.config,
      defaults:CERTIFICATE_DEFAULTS,
      sampleNumber:formatCertificateNo(data.config.number_format,1,false),
      stats,rows
    },NO_STORE);
  }catch(e){return fail(e.message||'Data sertifikat gagal dimuat.')}
}

export async function PATCH(request){
  const c=await ctx(request);
  if(c.response)return c.response;
  const b=await request.json().catch(()=>({}));
  const patch={};
  if(Object.prototype.hasOwnProperty.call(b,'certificate_enabled'))patch.certificate_enabled=!!b.certificate_enabled;
  if(b.config&&typeof b.config==='object'){
    const merged=certificateConfig({...(c.event.certificate_config||{}),...b.config});
    if(!/\{N+\}/.test(merged.number_format))return fail('Format nomor wajib memuat {NNN} sebagai nomor urut, contoh {NNN}/APTFI/PRESEPTOR/X/2026.',422);
    const stored={};
    for(const [key] of CERTIFICATE_FIELDS)stored[key]=merged[key];
    patch.certificate_config=stored;
  }
  if(!Object.keys(patch).length)return fail('Tidak ada perubahan.',422);
  const {error}=await c.db.from('events').update(patch).eq('id',c.event.id);
  if(error)return fail('Pengaturan sertifikat gagal disimpan.');
  await logActivity({actorType:'admin',actorEmail:c.auth.user.email,action:'certificate_settings_updated',metadata:{certificate_enabled:patch.certificate_enabled,config_changed:!!patch.certificate_config}});
  return NextResponse.json({ok:true});
}

export async function POST(request){
  const c=await ctx(request);
  if(c.response)return c.response;
  const b=await request.json().catch(()=>({}));
  const action=String(b.action||'');
  const reg=await registrationById(c.db,String(b.registrationId||''));
  if(!reg||reg.event_id!==c.event.id)return fail('Peserta tidak ditemukan.',404);
  const reason=String(b.reason||'').trim().slice(0,500);
  const actor=c.auth.user.email;
  const now=new Date().toISOString();

  if(action==='issue_manual'){
    if(reason.length<5)return fail('Alasan terbit manual wajib diisi (minimal 5 karakter).',422);
    const s=await participantCertificate(c.db,reg,c.event);
    if(s.cert){
      const {error}=await c.db.from('certificates').update({issued_via:'manual',override_reason:reason,issued_by:actor,revoked_at:null,revoked_by:null,revoke_reason:null,updated_at:now}).eq('id',s.cert.id);
      if(error)return fail('Sertifikat gagal diterbitkan.');
    }else{
      const {error}=await c.db.rpc('ensure_preseptor_certificate',{p_registration_id:reg.id,p_is_test:isTestReg(reg),p_via:'manual',p_reason:reason,p_actor:actor});
      if(error)return fail('Sertifikat gagal diterbitkan. Pastikan migration 020 sudah dijalankan.');
    }
    await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:actor,action:'certificate_issued_manual',metadata:{reason}});
    return NextResponse.json({ok:true});
  }

  if(action==='revoke'){
    if(reason.length<5)return fail('Alasan pencabutan wajib diisi (minimal 5 karakter).',422);
    const {data,error}=await c.db.from('certificates').update({revoked_at:now,revoked_by:actor,revoke_reason:reason,updated_at:now}).eq('registration_id',reg.id).select('id');
    if(error)return fail('Sertifikat gagal dicabut.');
    if(!data?.length)return fail('Peserta ini belum memiliki sertifikat yang terbit.',409);
    await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:actor,action:'certificate_revoked',metadata:{reason}});
    return NextResponse.json({ok:true});
  }

  if(action==='restore'){
    const {data,error}=await c.db.from('certificates').update({revoked_at:null,revoked_by:null,revoke_reason:null,updated_at:now}).eq('registration_id',reg.id).select('id');
    if(error)return fail('Sertifikat gagal dipulihkan.');
    if(!data?.length)return fail('Sertifikat tidak ditemukan.',404);
    await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:actor,action:'certificate_restored'});
    return NextResponse.json({ok:true});
  }

  return fail('Aksi tidak dikenal.',400);
}
