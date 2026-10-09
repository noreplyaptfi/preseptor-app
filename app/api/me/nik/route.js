import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { logActivity } from '../../../../lib/audit';
import { enforceRequestLimit } from '../../../../lib/request-rate-limit';
import { normalizeNik,nikError } from '../../../../lib/nik';
import { nikRowFor,nikSummary,nikDuplicate,saveNik } from '../../../../lib/nik-data';

// v0.8.5 — NIK peserta.
// Wajib untuk peserta SKP, opsional untuk peserta lain. Hanya pemilik akun yang bisa melihat NIK lengkapnya.
export const dynamic='force-dynamic';

const NO_STORE={'Cache-Control':'private, no-store'};

async function myRegistration(db,email){
  const {data}=await db.from('registrations').select('*').ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  return data||null;
}

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const reg=await myRegistration(db,auth.user.email);
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const {row,ready}=await nikRowFor(db,reg.id);
  if(!ready)return NextResponse.json({message:'Fitur NIK belum aktif.'},{status:503});
  return NextResponse.json({skp:!!reg.skp_eligible,nik:row?.nik||'',...nikSummary(row)},{headers:NO_STORE});
}

export async function POST(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const reg=await myRegistration(db,auth.user.email);
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const test=!!reg.is_test_account||reg.lifecycle_status==='test';
  if(!test&&reg.lifecycle_status!=='active')return NextResponse.json({message:'NIK tidak dapat diubah karena status pendaftaran Anda tidak aktif.'},{status:409});

  try{
    const limit=await enforceRequestLimit({scope:'nik-save',identifier:String(auth.user.email).toLowerCase(),limit:10,windowSeconds:600});
    if(!limit.ok)return NextResponse.json({message:'Terlalu banyak percobaan. Coba lagi dalam 10 menit.'},{status:429});
  }catch(e){console.error('nik rate limit:',e)}

  const b=await request.json().catch(()=>({}));
  const nik=normalizeNik(b.nik);
  const err=nikError(nik);
  if(err)return NextResponse.json({message:err,errors:{nik:err}},{status:422});
  if(normalizeNik(b.nik_confirm)!==nik)return NextResponse.json({message:'Ulangi NIK belum sama dengan NIK yang diisi.',errors:{nik_confirm:'Belum sama.'}},{status:422});
  if(b.consent!==true)return NextResponse.json({message:'Centang pernyataan persetujuan terlebih dahulu.',errors:{consent:'Wajib dicentang.'}},{status:422});

  try{
    if(!test){
      const dup=await nikDuplicate(db,{eventId:reg.event_id,nik,registrationId:reg.id});
      if(dup)return NextResponse.json({message:'NIK ini sudah terdaftar pada peserta lain. Periksa kembali, atau hubungi panitia bila NIK tersebut memang milik Anda.'},{status:409});
    }
    const res=await saveNik(db,{reg,nik,source:'participant',actorEmail:auth.user.email,consent:true});
    if(res.created||res.changed)await logActivity({registrationId:reg.id,actorType:'participant',actorEmail:auth.user.email,action:res.created?'nik_added':'nik_updated',metadata:{skp:!!reg.skp_eligible}});
  }catch(e){
    return NextResponse.json({message:e.message||'NIK gagal disimpan.'},{status:500});
  }
  const {row}=await nikRowFor(db,reg.id);
  return NextResponse.json({ok:true,nik:nikSummary(row)},{headers:NO_STORE});
}
