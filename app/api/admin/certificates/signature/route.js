import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { logActivity } from '../../../../../lib/audit';
import { ASSET_BUCKET } from '../../../../../lib/event-assets';
import { certificateEvent } from '../../../../../lib/certificate-data';

// v0.8.6 — Gambar tanda tangan & cap untuk sertifikat (Super Admin).
// Disimpan di bucket privat event-assets (tidak di repo / folder public), hanya dibaca server saat membuat PDF.
//   GET    → status + tautan pratinjau sementara
//   POST   → { png: base64 } unggah/ganti (PNG transparan, maks. 3 MB)
//   DELETE → hapus
export const runtime='nodejs';
export const dynamic='force-dynamic';

const MAX_BYTES=3*1024*1024;
const PNG_MAGIC=[0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a];

function fail(message,status=500){return NextResponse.json({message},{status})}

async function ctx(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return {response:fail(auth.error,auth.status)};
  const db=getSupabaseAdmin();
  try{
    const event=await certificateEvent(db);
    if(!event)return {response:fail('Event tidak ditemukan.',404)};
    return {auth,db,event,config:{...(event.certificate_config||{})}};
  }catch(e){return {response:fail(e.message)}}
}

export async function GET(request){
  const c=await ctx(request);if(c.response)return c.response;
  const path=c.config.signature_path;
  if(!path)return NextResponse.json({exists:false},{headers:{'Cache-Control':'private, no-store'}});
  const {data}=await c.db.storage.from(ASSET_BUCKET).createSignedUrl(path,300);
  return NextResponse.json({exists:true,url:data?.signedUrl||null,updated_at:c.config.signature_updated_at||null},{headers:{'Cache-Control':'private, no-store'}});
}

export async function POST(request){
  const c=await ctx(request);if(c.response)return c.response;
  const b=await request.json().catch(()=>({}));
  const raw=String(b.png||'').replace(/^data:image\/png;base64,/,'');
  let buf;
  try{buf=Buffer.from(raw,'base64')}catch{return fail('File tidak terbaca.',422)}
  if(!buf.length)return fail('File belum dipilih.',422);
  if(buf.length>MAX_BYTES)return fail('Ukuran gambar maksimal 3 MB.',422);
  if(!PNG_MAGIC.every((v,i)=>buf[i]===v))return fail('Gambar harus berformat PNG.',422);
  const path=`certificates/signature-${Date.now()}.png`;
  const {error}=await c.db.storage.from(ASSET_BUCKET).upload(path,buf,{contentType:'image/png',upsert:false});
  if(error){console.error('signature upload:',error);return fail('Gambar gagal diunggah ke penyimpanan.')}
  const old=c.config.signature_path;
  const config={...c.config,signature_path:path,signature_updated_at:new Date().toISOString()};
  const {error:saveError}=await c.db.from('events').update({certificate_config:config}).eq('id',c.event.id);
  if(saveError){await c.db.storage.from(ASSET_BUCKET).remove([path]).catch(()=>{});return fail('Pengaturan tanda tangan gagal disimpan.')}
  if(old&&old!==path)await c.db.storage.from(ASSET_BUCKET).remove([old]).catch(()=>{});
  await logActivity({actorType:'admin',actorEmail:c.auth.user.email,action:'certificate_signature_uploaded',metadata:{bytes:buf.length}});
  return NextResponse.json({ok:true});
}

export async function DELETE(request){
  const c=await ctx(request);if(c.response)return c.response;
  const old=c.config.signature_path;
  if(!old)return NextResponse.json({ok:true,unchanged:true});
  const config={...c.config};
  delete config.signature_path;delete config.signature_updated_at;
  const {error}=await c.db.from('events').update({certificate_config:config}).eq('id',c.event.id);
  if(error)return fail('Tanda tangan gagal dihapus.');
  await c.db.storage.from(ASSET_BUCKET).remove([old]).catch(()=>{});
  await logActivity({actorType:'admin',actorEmail:c.auth.user.email,action:'certificate_signature_deleted'});
  return NextResponse.json({ok:true});
}
