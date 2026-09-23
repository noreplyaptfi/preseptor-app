import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { clean,validEmail,validStraNumber,allowedModes } from '../../../../../lib/validation';
import { normalizeEmail,normalizePhone,normalizeStra } from '../../../../../lib/normalization';
import { overallStatus } from '../../../../../lib/status';
import { logActivity } from '../../../../../lib/audit';

const roles=['super_admin','event_admin'];
const participantTypes=['','practitioner','lecturer','lecturer_practitioner'];
const sensitiveStra=['stra_number'];
const sensitiveExperience=['participant_type','practice_type','practice_name','practice_years','teaching_years'];
function latestByType(docs=[]){const out={};for(const d of docs){if(!out[d.document_type])out[d.document_type]=d}return out}
function changed(a,b){return String(a??'')!==String(b??'')}

export async function PATCH(request,{params}){
  const auth=await requireAdmin(request,roles);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const {id}=await params;
  const db=getSupabaseAdmin();
  const {data:reg,error:regError}=await db.from('registrations').select('*').eq('id',id).single();
  if(regError||!reg) return NextResponse.json({message:'Pendaftar tidak ditemukan.'},{status:404});
  const body=await request.json();
  const patch={
    full_name:clean(body.full_name,255),
    email:normalizeEmail(clean(body.email,190)),
    whatsapp:clean(body.whatsapp,50),
    university:clean(body.university,255),
    attendance_mode:clean(body.attendance_mode,20),
    participant_type:clean(body.participant_type,40),
    practice_type:clean(body.practice_type,100),
    practice_name:clean(body.practice_name,255),
    practice_years:Number(body.practice_years||0),
    teaching_years:Number(body.teaching_years||0),
    stra_number:clean(body.stra_number,100)
  };
  if(patch.full_name.length<3) return NextResponse.json({message:'Nama peserta wajib diisi.'},{status:422});
  if(!validEmail(patch.email)) return NextResponse.json({message:'Email tidak valid.'},{status:422});
  patch.normalized_email=changed(reg.email,patch.email)?normalizeEmail(patch.email):reg.normalized_email;
  patch.normalized_whatsapp=changed(reg.whatsapp,patch.whatsapp)?normalizePhone(patch.whatsapp):reg.normalized_whatsapp;
  patch.normalized_stra=changed(reg.stra_number,patch.stra_number)?(patch.stra_number?normalizeStra(patch.stra_number):null):reg.normalized_stra;
  if(patch.normalized_whatsapp.length<10) return NextResponse.json({message:'Nomor WhatsApp tidak valid.'},{status:422});
  if(patch.stra_number&&!validStraNumber(patch.stra_number)) return NextResponse.json({message:'Nomor STRA tidak valid.'},{status:422});
  if(!patch.university) return NextResponse.json({message:'Homebase wajib diisi.'},{status:422});
  if(!allowedModes.includes(patch.attendance_mode)) return NextResponse.json({message:'Mode keikutsertaan tidak valid.'},{status:422});
  if(!participantTypes.includes(patch.participant_type)) return NextResponse.json({message:'Kategori peserta tidak valid.'},{status:422});

  if(patch.attendance_mode!==reg.attendance_mode){
    const {data:event}=await db.from('events').select('quota_online,quota_offline').eq('id',reg.event_id).single();
    const {count}=await db.from('registrations').select('id',{count:'exact',head:true}).eq('event_id',reg.event_id).eq('attendance_mode',patch.attendance_mode).neq('id',reg.id);
    const quota=patch.attendance_mode==='Offline'?Number(event?.quota_offline||50):Number(event?.quota_online||150);
    if(quota>0&&Number(count||0)>=quota) return NextResponse.json({message:`Kuota ${patch.attendance_mode} sudah penuh.`},{status:409});
  }

  const fieldNames=Object.keys(patch).filter(k=>!k.startsWith('normalized_'));
  const changedFields=fieldNames.filter(k=>changed(reg[k],patch[k]));
  if(!changedFields.length) return NextResponse.json({ok:true,noChanges:true});
  patch.updated_at=new Date().toISOString();
  if(changed(reg.email,patch.email)){patch.email_needs_update=false;patch.legacy_contact_email=reg.legacy_contact_email||reg.email}

  let authUser=null;
  if(changed(reg.email,patch.email)){
    try{const {data:list}=await db.auth.admin.listUsers({page:1,perPage:1000});authUser=(list?.users||[]).find(u=>String(u.email||'').toLowerCase()===String(reg.email||'').toLowerCase())||null}catch(e){console.error('lookup participant auth user:',e)}
  }

  const {error:updateError}=await db.from('registrations').update(patch).eq('id',reg.id);
  if(updateError){
    if(updateError.code==='23505') return NextResponse.json({message:'Email, WhatsApp, atau nomor STRA sudah digunakan pendaftar lain.'},{status:409});
    if(String(updateError.message||'').includes('quota_online_full')) return NextResponse.json({message:'Kuota Online sudah penuh.'},{status:409});
    if(String(updateError.message||'').includes('quota_offline_full')) return NextResponse.json({message:'Kuota Offline sudah penuh.'},{status:409});
    return NextResponse.json({message:'Gagal memperbarui data peserta.'},{status:500});
  }

  if(authUser&&changed(reg.email,patch.email)){
    try{
      const {error:authError}=await db.auth.admin.updateUserById(authUser.id,{email:patch.email,email_confirm:true});
      if(authError) throw authError;
    }catch(e){
      const rollback={};
      for(const key of Object.keys(patch)){if(key!=='updated_at')rollback[key]=reg[key]??null}
      rollback.updated_at=new Date().toISOString();
      await db.from('registrations').update(rollback).eq('id',reg.id);
      console.error('admin participant auth email update:',e);
      return NextResponse.json({message:'Email akun peserta gagal diperbarui. Perubahan dibatalkan; silakan coba lagi.'},{status:500});
    }
  }

  const {data:docsData}=await db.from('registration_documents').select('*').eq('registration_id',reg.id).order('created_at',{ascending:false});
  const docs=latestByType(docsData||[]);
  const now=new Date().toISOString();
  const resetTypes=[];
  if(sensitiveStra.some(k=>changedFields.includes(k))&&docs.stra) resetTypes.push('stra');
  if(sensitiveExperience.some(k=>changedFields.includes(k))&&docs.experience) resetTypes.push('experience');
  for(const type of resetTypes){
    const doc=docs[type];
    await db.from('registration_documents').update({status:'pending',review_note:null,next_action:null,reviewed_at:null,reviewed_by:null}).eq('id',doc.id);
    docs[type]={...doc,status:'pending'};
  }
  const reqDocs=[docs.stra,docs.experience];
  let requirementsStatus='pending';
  if(reqDocs.some(x=>!x)) requirementsStatus='incomplete';
  else if(reqDocs.some(x=>x.status==='rejected')) requirementsStatus='rejected';
  else if(reqDocs.every(x=>x.status==='valid')) requirementsStatus='valid';
  const paymentStatus=!docs.payment_proof?'pending':docs.payment_proof.status==='valid'?'verified':docs.payment_proof.status==='rejected'?'rejected':'pending';
  await db.from('registrations').update({requirements_status:requirementsStatus,payment_status:paymentStatus,overall_status:overallStatus(requirementsStatus,paymentStatus),requirements_verified_at:requirementsStatus==='valid'?reg.requirements_verified_at:null,requirements_verified_by:requirementsStatus==='valid'?reg.requirements_verified_by:null,updated_at:now}).eq('id',reg.id);

  await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:auth.user.email,action:'participant_profile_updated',metadata:{changed_fields:changedFields,review_reset:resetTypes}});
  return NextResponse.json({ok:true,changedFields,reviewReset:resetTypes});
}
