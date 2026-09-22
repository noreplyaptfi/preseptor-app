import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

export async function GET(request,{params}){
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const {id}=await params;
  const type=new URL(request.url).searchParams.get('type');
  if(!['stra','experience','payment_proof'].includes(type)) return NextResponse.json({message:'Jenis dokumen tidak valid.'},{status:422});
  const db=getSupabaseAdmin();
  const {data:reg}=await db.from('registrations').select('id,email,full_name,registration_code,requirements_status,payment_status').eq('id',id).single();
  if(!reg) return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  let allowed=reg.email.toLowerCase()===auth.user.email.toLowerCase();
  if(!allowed){const {data:admin}=await db.from('admin_users').select('id').eq('email',auth.user.email.toLowerCase()).eq('active',true).maybeSingle();allowed=!!admin}
  if(!allowed) return NextResponse.json({message:'Akses ditolak.'},{status:403});
  const {data:doc}=await db.from('registration_documents').select('*').eq('registration_id',id).eq('document_type',type).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!doc) return NextResponse.json({message:'Dokumen belum tersedia.'},{status:404});
  const {data,error}=await db.storage.from('preseptor-private').createSignedUrl(doc.storage_path,300);
  if(error) return NextResponse.json({message:'Gagal membuat tautan dokumen.'},{status:500});
  return NextResponse.json({url:data.signedUrl,expiresIn:300,document:doc,registration:reg});
}
