import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { participantEligible,isTestRegistration } from '../../../../lib/day-h';
import { ASSET_BUCKET,assetVisibleFor,downloadName } from '../../../../lib/event-assets';

// v0.8.0 — Virtual background & materi untuk peserta terverifikasi (dan akun TEST).
// v0.8.4 — + dokumentasi (tautan).
export const dynamic='force-dynamic';
const NO_STORE={headers:{'Cache-Control':'private, no-store'}};

async function load(db,email){
  const {data:reg}=await db.from('registrations').select('id,event_id,attendance_mode,requirements_status,payment_status,lifecycle_status,is_test_account').ilike('email',email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  return reg||null;
}

function publicAsset(a,preview){
  return {id:a.id,kind:a.kind,title:a.title,description:a.description,group_label:a.group_label||null,original_name:a.original_name,mime_type:a.mime_type,file_size:a.file_size,is_link:!a.storage_path&&!!a.link_url,link_url:!a.storage_path?a.link_url:null,preview_url:preview||null,created_at:a.created_at};
}

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const reg=await load(db,auth.user.email);
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const kind=new URL(request.url).searchParams.get('kind');
  if(!participantEligible(reg))return NextResponse.json({locked:true,mode:reg.attendance_mode,assets:[]},NO_STORE);
  let q=db.from('event_assets').select('*').eq('event_id',reg.event_id).eq('published',true);
  if(['virtual_background','material','documentation'].includes(kind))q=q.eq('kind',kind);
  const {data,error}=await q.order('position').order('created_at');
  if(error)return NextResponse.json({locked:false,mode:reg.attendance_mode,assets:[],message:'Belum tersedia.'},NO_STORE);
  const visible=(data||[]).filter(a=>assetVisibleFor(a,reg.attendance_mode));
  const imgs=visible.filter(a=>a.storage_path&&String(a.mime_type||'').startsWith('image/')).map(a=>a.storage_path);
  const previews=new Map();
  if(imgs.length){
    const {data:signed}=await db.storage.from(ASSET_BUCKET).createSignedUrls(imgs,3600);
    for(const s of signed||[])if(s?.signedUrl)previews.set(s.path,s.signedUrl);
  }
  return NextResponse.json({locked:false,mode:reg.attendance_mode,testAccount:isTestRegistration(reg),assets:visible.map(a=>publicAsset(a,a.storage_path?previews.get(a.storage_path):null))},NO_STORE);
}

// Mengembalikan URL unduhan berumur pendek (5 menit) dan mencatat jumlah unduhan.
export async function POST(request){
  const auth=await requireUser(request);
  if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const reg=await load(db,auth.user.email);
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  if(!participantEligible(reg))return NextResponse.json({message:'Materi tersedia untuk peserta yang sudah terverifikasi.'},{status:403});
  const b=await request.json().catch(()=>({}));
  const {data:a}=await db.from('event_assets').select('*').eq('id',String(b.id||'')).eq('event_id',reg.event_id).maybeSingle();
  if(!a||!assetVisibleFor(a,reg.attendance_mode))return NextResponse.json({message:'File tidak ditemukan.'},{status:404});
  let url=a.link_url||null;
  if(a.storage_path){
    const {data,error}=await db.storage.from(ASSET_BUCKET).createSignedUrl(a.storage_path,300,{download:downloadName(a)});
    if(error||!data?.signedUrl)return NextResponse.json({message:'File gagal disiapkan. Coba lagi.'},{status:500});
    url=data.signedUrl;
  }
  if(!isTestRegistration(reg))await db.from('event_assets').update({download_count:Number(a.download_count||0)+1}).eq('id',a.id);
  return NextResponse.json({url,isLink:!a.storage_path},NO_STORE);
}
