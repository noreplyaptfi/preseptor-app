import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { logActivity } from '../../../../../lib/audit';
import { RECIPIENT_ROLES } from '../../../../../lib/certificate';
import { certificateEvent,listRecipients,recipientById } from '../../../../../lib/certificate-data';

// v0.8.6 — Kelola penerima sertifikat non-peserta: pemateri & moderator (Super Admin).
//   POST action: create | update | move | delete | revoke | restore
export const dynamic='force-dynamic';

function fail(message,status=500){return NextResponse.json({message},{status})}
function clean(v,max){return String(v??'').replace(/\s+/g,' ').trim().slice(0,max)}

function fields(b){
  const out={};
  if('name' in b)out.name=clean(b.name,160);
  if('role' in b)out.role=String(b.role||'');
  if('language' in b)out.language=b.language==='en'?'en':'id';
  if('topic' in b)out.topic=clean(b.topic,200)||null;
  if('attendance_mode' in b)out.attendance_mode=['Online','Offline'].includes(b.attendance_mode)?b.attendance_mode:null;
  return out;
}
function invalid(f,creating){
  if((creating||'name' in f)&&String(f.name||'').length<3)return 'Nama wajib diisi (minimal 3 karakter), lengkap dengan gelar.';
  if((creating||'role' in f)&&!RECIPIENT_ROLES[f.role])return 'Peran harus Pemateri atau Moderator.';
  return '';
}

export async function POST(request){
  const auth=await requireAdmin(request,['super_admin']);
  if(auth.error)return fail(auth.error,auth.status);
  const db=getSupabaseAdmin();
  let event;
  try{event=await certificateEvent(db)}catch(e){return fail(e.message)}
  if(!event)return fail('Event tidak ditemukan.',404);
  const b=await request.json().catch(()=>({}));
  const action=String(b.action||'');
  const actor=auth.user.email;
  const now=new Date().toISOString();

  let list;
  try{list=await listRecipients(db,event.id)}catch(e){return fail(e.message,503)}

  if(action==='create'){
    const f=fields(b);
    const err=invalid(f,true);if(err)return fail(err,422);
    const position=Math.max(0,...list.filter(r=>r.role===f.role).map(r=>Number(r.position||0)))+1;
    const {data,error}=await db.from('certificate_recipients').insert({event_id:event.id,...f,language:f.language||'id',position,created_by:actor}).select('*').single();
    if(error)return fail('Penerima gagal ditambahkan.');
    await logActivity({actorType:'admin',actorEmail:actor,action:'certificate_recipient_created',metadata:{id:data.id,role:data.role}});
    return NextResponse.json({ok:true,recipient:data});
  }

  const r=await recipientById(db,event.id,b.id);
  if(!r)return fail('Penerima tidak ditemukan.',404);
  const {data:cert}=await db.from('certificates').select('id,revoked_at').eq('recipient_id',r.id).maybeSingle();

  if(action==='update'){
    const f=fields(b);
    delete f.role; // peran tidak diubah setelah dibuat (urutan nomor bergantung pada peran)
    const err=invalid(f,false);if(err)return fail(err,422);
    const {error}=await db.from('certificate_recipients').update({...f,updated_at:now}).eq('id',r.id);
    if(error)return fail('Perubahan gagal disimpan.');
    await logActivity({actorType:'admin',actorEmail:actor,action:'certificate_recipient_updated',metadata:{id:r.id,numbered:!!cert}});
    return NextResponse.json({ok:true});
  }

  if(action==='move'){
    const same=list.filter(x=>x.role===r.role);
    const i=same.findIndex(x=>x.id===r.id),j=i+(b.dir==='up'?-1:1);
    if(i<0||j<0||j>=same.length)return NextResponse.json({ok:true,unchanged:true});
    const order=[...same];[order[i],order[j]]=[order[j],order[i]];
    for(let k=0;k<order.length;k++){
      if(Number(order[k].position)!==k+1)await db.from('certificate_recipients').update({position:k+1,updated_at:now}).eq('id',order[k].id);
    }
    return NextResponse.json({ok:true});
  }

  if(action==='delete'){
    if(cert)return fail('Penerima ini sudah memiliki nomor sertifikat. Gunakan Cabut agar nomor tetap tercatat.',409);
    const {error}=await db.from('certificate_recipients').delete().eq('id',r.id);
    if(error)return fail('Penerima gagal dihapus.');
    await logActivity({actorType:'admin',actorEmail:actor,action:'certificate_recipient_deleted',metadata:{id:r.id,name:r.name,role:r.role}});
    return NextResponse.json({ok:true});
  }

  if(action==='revoke'||action==='restore'){
    if(!cert)return fail('Sertifikat penerima ini belum terbit.',409);
    const reason=String(b.reason||'').trim().slice(0,500);
    if(action==='revoke'&&reason.length<5)return fail('Alasan pencabutan wajib diisi (minimal 5 karakter).',422);
    const patch=action==='revoke'?{revoked_at:now,revoked_by:actor,revoke_reason:reason,updated_at:now}:{revoked_at:null,revoked_by:null,revoke_reason:null,updated_at:now};
    const {error}=await db.from('certificates').update(patch).eq('id',cert.id);
    if(error)return fail('Status sertifikat gagal diubah.');
    await logActivity({actorType:'admin',actorEmail:actor,action:action==='revoke'?'certificate_recipient_revoked':'certificate_recipient_restored',metadata:{id:r.id,reason:reason||undefined}});
    return NextResponse.json({ok:true});
  }

  return fail('Aksi tidak dikenal.',400);
}
