import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { cleanText,maskAccount } from '../../../../lib/profile';
import { sendEmail } from '../../../../lib/email';
import { requestEmailHtml } from '../../../../lib/self-service';
import { logActivity } from '../../../../lib/audit';
export const dynamic='force-dynamic';

async function ctx(request){const auth=await requireAdmin(request,['super_admin','event_admin','payment_verifier']);if(auth.error)return {response:NextResponse.json({message:auth.error},{status:auth.status})};return {auth,db:getSupabaseAdmin()}}
async function list(db){
  const {data:items,error}=await db.from('refund_requests').select('*').order('requested_at',{ascending:false});if(error)throw error;
  const ids=[...new Set((items||[]).map(x=>x.registration_id))];let regs=[];if(ids.length){const r=await db.from('registrations').select('id,registration_code,full_name,email,whatsapp,university,attendance_mode,payment_status,lifecycle_status,amount_due').in('id',ids);regs=r.data||[]}
  const {data:batches}=await db.from('refund_batches').select('*').order('created_at',{ascending:false}).limit(100);const map=new Map(regs.map(r=>[r.id,r]));
  return {refunds:(items||[]).map(x=>({...x,account_number_masked:maskAccount(x.account_number),registration:map.get(x.registration_id)||null})),batches:batches||[]};
}
async function emailStatus(db,item,reg,subject,message,note=''){const result=await sendEmail({to:reg.email,subject,html:requestEmailHtml({name:reg.full_name,title:subject,message,note})});await db.from('email_logs').insert({registration_id:reg.id,email_type:'refund',recipient:reg.email,status:result.ok?'sent':result.skipped?'skipped':'failed',provider_id:result.id||null,error_message:result.error||null});return result}

export async function GET(request){const c=await ctx(request);if(c.response)return c.response;try{return NextResponse.json(await list(c.db),{headers:{'Cache-Control':'private, no-store'}})}catch(e){console.error(e);return NextResponse.json({message:'Gagal membaca data refund.'},{status:500})}}

export async function PATCH(request){
  const c=await ctx(request);if(c.response)return c.response;const b=await request.json().catch(()=>({}));const {data:item}=await c.db.from('refund_requests').select('*').eq('id',b.id).maybeSingle();if(!item)return NextResponse.json({message:'Pengajuan refund tidak ditemukan.'},{status:404});const {data:reg}=await c.db.from('registrations').select('*').eq('id',item.registration_id).single();const action=cleanText(b.action,50),note=cleanText(b.note,1500),amount=b.amount==null?Number(item.approved_amount||item.requested_amount):Number(b.amount);if(!Number.isFinite(amount)||amount<0)return NextResponse.json({message:'Nominal refund tidak valid.'},{status:422});
  if(action==='ready'){
    if(!['withdrawn','rejected'].includes(reg.lifecycle_status))return NextResponse.json({message:'Refund hanya dapat diproses untuk pendaftaran yang sudah tidak aktif (mengundurkan diri atau ditolak).'},{status:409});if(!['requested','under_review'].includes(item.status))return NextResponse.json({message:'Status refund tidak dapat diubah menjadi Siap.'},{status:409});await c.db.from('refund_requests').update({status:'ready',approved_amount:amount,admin_note:note||null,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',item.id);await emailStatus(c.db,item,reg,'Refund disetujui untuk diproses','Pengajuan refund Anda telah disetujui dan masuk antrean proses transfer.',note);
  }else if(action==='reject'){
    if(!note)return NextResponse.json({message:'Alasan penolakan refund wajib diisi.'},{status:422});if(['processing','refunded'].includes(item.status))return NextResponse.json({message:'Refund yang sudah diproses tidak dapat ditolak.'},{status:409});await c.db.from('refund_requests').update({status:'rejected',admin_note:note,reviewed_at:new Date().toISOString(),updated_at:new Date().toISOString()}).eq('id',item.id);await emailStatus(c.db,item,reg,'Pengajuan refund belum dapat disetujui','Pengajuan refund Anda ditolak oleh panitia.',note);
  }else if(action==='under_review'){
    if(item.status!=='requested')return NextResponse.json({message:'Refund bukan dalam status baru.'},{status:409});await c.db.from('refund_requests').update({status:'under_review',admin_note:note||null,updated_at:new Date().toISOString()}).eq('id',item.id);
  }else if(action==='update'){
    if(['processing','refunded'].includes(item.status))return NextResponse.json({message:'Refund dalam batch tidak dapat diedit.'},{status:409});const bank=cleanText(b.bank_name||item.bank_name,120),account=cleanText(b.account_number||item.account_number,80).replace(/\s+/g,''),holder=cleanText(b.account_holder||item.account_holder,160);if(!bank||account.length<5||!holder)return NextResponse.json({message:'Data rekening wajib lengkap.'},{status:422});await c.db.from('refund_requests').update({bank_name:bank,account_number:account,account_holder:holder,approved_amount:amount,admin_note:note||item.admin_note,updated_at:new Date().toISOString()}).eq('id',item.id);
  }else return NextResponse.json({message:'Aksi refund tidak dikenali.'},{status:422});
  await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:c.auth.user.email,action:`refund_${action}`});return NextResponse.json({ok:true,...(await list(c.db))});
}
