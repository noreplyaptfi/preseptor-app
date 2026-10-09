import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { logActivity } from '../../../../lib/audit';
import { normalizeNik,nikError,extractRegistrationCodes } from '../../../../lib/nik';
import { nikRowFor,nikSummary,nikDuplicate,saveNik,deleteNik } from '../../../../lib/nik-data';

// v0.8.5 — Peserta SKP & NIK (Super Admin, Admin Event).
//   GET  ?registrationId=   → NIK lengkap satu peserta (untuk dilihat/dicocokkan)
//   POST action=set_flag    → tandai / batalkan SKP satu peserta
//   POST action=bulk        → tandai / batalkan SKP banyak peserta via Nomor Pendaftaran (dryRun untuk pratinjau)
//   POST action=set_nik     → isi / ubah NIK atas nama peserta
//   POST action=clear_nik   → hapus NIK
export const dynamic='force-dynamic';

const ROLES=['super_admin','event_admin'];
const NO_STORE={'Cache-Control':'private, no-store'};
const MAX_BULK=1000;

async function context(request){
  const auth=await requireAdmin(request,ROLES);
  if(auth.error)return {response:NextResponse.json({message:auth.error},{status:auth.status})};
  const db=getSupabaseAdmin();
  const {data:event}=await db.from('events').select('id').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').maybeSingle();
  if(!event)return {response:NextResponse.json({message:'Event tidak ditemukan.'},{status:404})};
  return {auth,db,event};
}

async function registrationIn(db,event,id){
  if(!id)return null;
  const {data}=await db.from('registrations').select('*').eq('id',String(id)).maybeSingle();
  return data&&data.event_id===event.id?data:null;
}

function notReady(){return NextResponse.json({message:'Fitur SKP belum aktif. Jalankan migration 023 terlebih dahulu.'},{status:503})}

export async function GET(request){
  const c=await context(request);if(c.response)return c.response;
  const reg=await registrationIn(c.db,c.event,new URL(request.url).searchParams.get('registrationId'));
  if(!reg)return NextResponse.json({message:'Peserta tidak ditemukan.'},{status:404});
  const {row,ready}=await nikRowFor(c.db,reg.id);
  if(!ready)return notReady();
  return NextResponse.json({nik:row?.nik||'',consent_at:row?.consent_at||null,...nikSummary(row)},{headers:NO_STORE});
}

export async function POST(request){
  const c=await context(request);if(c.response)return c.response;
  const {db,event,auth}=c;
  const actor=auth.user.email;
  const b=await request.json().catch(()=>({}));
  const action=String(b.action||'');

  if(action==='bulk'){
    const codes=extractRegistrationCodes(Array.isArray(b.codes)?b.codes.join('\n'):b.codes);
    if(!codes.length)return NextResponse.json({message:'Tidak ada Nomor Pendaftaran yang dikenali (format APT-PRS-…).'},{status:422});
    if(codes.length>MAX_BULK)return NextResponse.json({message:`Maksimal ${MAX_BULK} nomor sekali proses.`},{status:422});
    const eligible=b.eligible!==false;
    const found=[];
    for(let i=0;i<codes.length;i+=200){
      const {data,error}=await db.from('registrations').select('id,registration_code,full_name,lifecycle_status,is_test_account,skp_eligible').eq('event_id',event.id).in('registration_code',codes.slice(i,i+200));
      if(error)return notReady();
      found.push(...(data||[]));
    }
    const foundCodes=new Set(found.map(r=>r.registration_code));
    const notFound=codes.filter(code=>!foundCodes.has(code));
    const toChange=found.filter(r=>!!r.skp_eligible!==eligible);
    const inactive=found.filter(r=>['withdrawn','rejected'].includes(r.lifecycle_status)).length;
    if(b.dryRun){
      return NextResponse.json({
        eligible,total:codes.length,found:found.length,notFound,toChange:toChange.length,unchanged:found.length-toChange.length,inactive,
        sample:toChange.slice(0,8).map(r=>({code:r.registration_code,name:r.full_name}))
      },{headers:NO_STORE});
    }
    const now=new Date().toISOString();
    const ids=toChange.map(r=>r.id);
    for(let i=0;i<ids.length;i+=200){
      const {error}=await db.from('registrations').update({skp_eligible:eligible,skp_marked_at:now,skp_marked_by:actor,updated_at:now}).in('id',ids.slice(i,i+200));
      if(error){console.error('skp bulk:',error);return NextResponse.json({message:'Sebagian data gagal diperbarui. Coba proses ulang (yang sudah berubah akan dilewati).'},{status:500})}
    }
    if(ids.length){
      const logs=ids.map(id=>({registration_id:id,actor_type:'admin',actor_email:actor,action:eligible?'skp_marked':'skp_unmarked',metadata:{bulk:true}}));
      for(let i=0;i<logs.length;i+=500)await db.from('activity_logs').insert(logs.slice(i,i+500));
    }
    return NextResponse.json({ok:true,eligible,updated:ids.length,unchanged:found.length-ids.length,notFound});
  }

  const reg=await registrationIn(db,event,b.registrationId);
  if(!reg)return NextResponse.json({message:'Peserta tidak ditemukan.'},{status:404});
  if(!('skp_eligible' in reg))return notReady();

  if(action==='set_flag'){
    const eligible=b.eligible===true;
    if(!!reg.skp_eligible===eligible)return NextResponse.json({ok:true,unchanged:true});
    const now=new Date().toISOString();
    const {error}=await db.from('registrations').update({skp_eligible:eligible,skp_marked_at:now,skp_marked_by:actor,updated_at:now}).eq('id',reg.id);
    if(error)return NextResponse.json({message:'Status SKP gagal disimpan.'},{status:500});
    await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:actor,action:eligible?'skp_marked':'skp_unmarked'});
    return NextResponse.json({ok:true,eligible});
  }

  if(action==='set_nik'){
    const nik=normalizeNik(b.nik);
    const err=nikError(nik);
    if(err)return NextResponse.json({message:err},{status:422});
    try{
      const test=!!reg.is_test_account||reg.lifecycle_status==='test';
      if(!test){
        const dup=await nikDuplicate(db,{eventId:event.id,nik,registrationId:reg.id});
        if(dup)return NextResponse.json({message:`NIK ini sudah tersimpan pada ${dup.full_name} (${dup.registration_code}). Periksa kembali sebelum menyimpan.`},{status:409});
      }
      const res=await saveNik(db,{reg,nik,source:'admin',actorEmail:actor});
      if(res.created||res.changed)await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:actor,action:res.created?'nik_added_by_admin':'nik_updated_by_admin'});
    }catch(e){return NextResponse.json({message:e.message||'NIK gagal disimpan.'},{status:500})}
    const {row}=await nikRowFor(db,reg.id);
    return NextResponse.json({ok:true,nik:nikSummary(row)});
  }

  if(action==='clear_nik'){
    try{await deleteNik(db,reg.id)}catch(e){return NextResponse.json({message:e.message},{status:500})}
    await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:actor,action:'nik_deleted_by_admin'});
    return NextResponse.json({ok:true});
  }

  return NextResponse.json({message:'Aksi tidak dikenal.'},{status:422});
}
