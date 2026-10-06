import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { logActivity } from '../../../../lib/audit';
import { safeFileName,validateFileSignature } from '../../../../lib/validation';
import { ASSET_BUCKET,ASSET_KINDS,validateAssetFile,validLink,guessMime } from '../../../../lib/event-assets';

// v0.8.0 — Admin virtual background & materi (Super Admin, Admin Event).
// Upload langsung ke Supabase Storage lewat signed upload URL (tidak melewati batas body Vercel).
export const dynamic='force-dynamic';
const ROLES=['super_admin','event_admin'];
const NO_STORE={headers:{'Cache-Control':'private, no-store'}};
const AUDIENCES=['all','Online','Offline'];

function fail(message,status=500){return NextResponse.json({message},{status})}

async function ctx(request){
  const auth=await requireAdmin(request,ROLES);
  if(auth.error)return {response:fail(auth.error,auth.status)};
  const db=getSupabaseAdmin();
  const {data:event}=await db.from('events').select('id').eq('slug',process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026').maybeSingle();
  if(!event)return {response:fail('Event tidak ditemukan.',404)};
  return {auth,db,event};
}

function clean(v,max){return String(v??'').replace(/\s+/g,' ').trim().slice(0,max)}

async function verifyObject(db,path,mime){
  const {data,error}=await db.storage.from(ASSET_BUCKET).createSignedUrl(path,60);
  if(error||!data?.signedUrl)return 'File belum ditemukan di penyimpanan. Ulangi upload.';
  try{
    const r=await fetch(data.signedUrl,{headers:{Range:'bytes=0-15'},cache:'no-store'});
    if(!r.ok)return 'File gagal diverifikasi. Ulangi upload.';
    if(['image/jpeg','image/png','application/pdf'].includes(mime)){
      const buffer=Buffer.from(await r.arrayBuffer());
      if(!validateFileSignature(buffer,mime))return 'Isi file tidak sesuai formatnya. Pastikan file tidak rusak.';
    }
    return '';
  }catch{return 'File gagal diverifikasi. Ulangi upload.'}
}

export async function GET(request){
  const c=await ctx(request);
  if(c.response)return c.response;
  const {data,error}=await c.db.from('event_assets').select('*').eq('event_id',c.event.id).order('kind').order('position').order('created_at');
  if(error)return fail('Data aset belum tersedia. Pastikan migration 020 sudah dijalankan.');
  const rows=data||[];
  const imagePaths=rows.filter(a=>a.storage_path&&String(a.mime_type||'').startsWith('image/')).map(a=>a.storage_path);
  const previews=new Map();
  if(imagePaths.length){
    const {data:signed}=await c.db.storage.from(ASSET_BUCKET).createSignedUrls(imagePaths,3600);
    for(const s of signed||[])if(s?.signedUrl)previews.set(s.path,s.signedUrl);
  }
  return NextResponse.json({
    assets:rows.map(a=>({...a,preview_url:a.storage_path?previews.get(a.storage_path)||null:null})),
    limits:Object.fromEntries(Object.entries(ASSET_KINDS).map(([k,v])=>[k,{maxBytes:v.maxBytes,accept:v.accept,hint:v.hint}]))
  },NO_STORE);
}

export async function POST(request){
  const c=await ctx(request);
  if(c.response)return c.response;
  const b=await request.json().catch(()=>({}));
  const action=String(b.action||'');
  const kind=String(b.kind||'');

  if(action==='prepare'){
    const file={name:String(b.file?.name||''),type:guessMime(b.file?.name,b.file?.type),size:Number(b.file?.size||0)};
    const err=validateAssetFile(kind,file);
    if(err)return fail(err,422);
    const path=`${c.event.id}/${kind}/${Date.now()}-${crypto.randomUUID()}-${safeFileName(file.name)}`;
    const {data,error}=await c.db.storage.from(ASSET_BUCKET).createSignedUploadUrl(path);
    if(error||!data?.token)return fail('Gagal menyiapkan upload. Pastikan bucket event-assets sudah dibuat (migration 020).');
    return NextResponse.json({path,token:data.token,type:file.type});
  }

  if(action==='create'||action==='create_link'){
    if(!ASSET_KINDS[kind])return fail('Jenis aset tidak dikenal.',422);
    const title=clean(b.title,160);
    if(title.length<2)return fail('Judul wajib diisi.',422);
    const audience=AUDIENCES.includes(b.audience)?b.audience:'all';
    const row={event_id:c.event.id,kind,title,description:clean(b.description,500)||null,audience,published:b.published!==false,uploaded_by:c.auth.user.email};
    if(action==='create'){
      const path=String(b.path||'');
      if(!path.startsWith(`${c.event.id}/${kind}/`))return fail('Lokasi file tidak valid.',422);
      const file={name:String(b.original_name||''),type:guessMime(b.original_name,b.mime_type),size:Number(b.file_size||0)};
      const err=validateAssetFile(kind,file);
      if(err)return fail(err,422);
      const verr=await verifyObject(c.db,path,file.type);
      if(verr)return fail(verr,422);
      Object.assign(row,{storage_path:path,original_name:file.name.slice(0,200),mime_type:file.type,file_size:file.size});
    }else{
      if(kind!=='material')return fail('Tautan hanya untuk materi.',422);
      const url=validLink(b.link_url);
      if(!url)return fail('Tautan harus diawali https:// atau http://',422);
      row.link_url=url;
    }
    const {data:last}=await c.db.from('event_assets').select('position').eq('event_id',c.event.id).eq('kind',kind).order('position',{ascending:false}).limit(1).maybeSingle();
    row.position=Number(last?.position||0)+1;
    const {data,error}=await c.db.from('event_assets').insert(row).select('*').single();
    if(error){
      if(row.storage_path)await c.db.storage.from(ASSET_BUCKET).remove([row.storage_path]).catch(()=>{});
      return fail('Aset gagal disimpan.');
    }
    await logActivity({actorType:'admin',actorEmail:c.auth.user.email,action:'event_asset_created',metadata:{kind,asset_id:data.id,title}});
    return NextResponse.json({ok:true,asset:data});
  }

  if(action==='move'){
    const id=String(b.id||''),dir=b.direction==='up'?-1:1;
    const {data:asset}=await c.db.from('event_assets').select('id,kind,position').eq('id',id).eq('event_id',c.event.id).maybeSingle();
    if(!asset)return fail('Aset tidak ditemukan.',404);
    const {data:list}=await c.db.from('event_assets').select('id,position').eq('event_id',c.event.id).eq('kind',asset.kind).order('position').order('created_at');
    const items=list||[],i=items.findIndex(x=>x.id===id),j=i+dir;
    if(i<0||j<0||j>=items.length)return NextResponse.json({ok:true});
    [items[i],items[j]]=[items[j],items[i]];
    for(let k=0;k<items.length;k++){
      if(items[k].position!==k+1)await c.db.from('event_assets').update({position:k+1,updated_at:new Date().toISOString()}).eq('id',items[k].id);
    }
    return NextResponse.json({ok:true});
  }

  return fail('Aksi tidak dikenal.',400);
}

export async function PATCH(request){
  const c=await ctx(request);
  if(c.response)return c.response;
  const b=await request.json().catch(()=>({}));
  const id=String(b.id||'');
  const {data:asset}=await c.db.from('event_assets').select('*').eq('id',id).eq('event_id',c.event.id).maybeSingle();
  if(!asset)return fail('Aset tidak ditemukan.',404);
  const patch={updated_at:new Date().toISOString()};
  if(Object.prototype.hasOwnProperty.call(b,'title')){const t=clean(b.title,160);if(t.length<2)return fail('Judul wajib diisi.',422);patch.title=t}
  if(Object.prototype.hasOwnProperty.call(b,'description'))patch.description=clean(b.description,500)||null;
  if(Object.prototype.hasOwnProperty.call(b,'audience')){if(!AUDIENCES.includes(b.audience))return fail('Sasaran peserta tidak valid.',422);patch.audience=b.audience}
  if(Object.prototype.hasOwnProperty.call(b,'published'))patch.published=!!b.published;
  if(Object.prototype.hasOwnProperty.call(b,'link_url')&&!asset.storage_path){const url=validLink(b.link_url);if(!url)return fail('Tautan tidak valid.',422);patch.link_url=url}
  const {error}=await c.db.from('event_assets').update(patch).eq('id',id);
  if(error)return fail('Aset gagal diperbarui.');
  return NextResponse.json({ok:true});
}

export async function DELETE(request){
  const c=await ctx(request);
  if(c.response)return c.response;
  const b=await request.json().catch(()=>({}));
  const {data:asset}=await c.db.from('event_assets').select('*').eq('id',String(b.id||'')).eq('event_id',c.event.id).maybeSingle();
  if(!asset)return fail('Aset tidak ditemukan.',404);
  const {error}=await c.db.from('event_assets').delete().eq('id',asset.id);
  if(error)return fail('Aset gagal dihapus.');
  if(asset.storage_path)await c.db.storage.from(ASSET_BUCKET).remove([asset.storage_path]).catch(()=>{});
  await logActivity({actorType:'admin',actorEmail:c.auth.user.email,action:'event_asset_deleted',metadata:{kind:asset.kind,title:asset.title}});
  return NextResponse.json({ok:true});
}
