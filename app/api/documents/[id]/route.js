import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

export async function GET(request,{params}){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const {id}=await params;
  const type=new URL(request.url).searchParams.get('type');
  if(!['stra','experience','payment_proof'].includes(type)) return NextResponse.json({message:'Jenis dokumen tidak valid.'},{status:422});
  const db=getSupabaseAdmin();
  const {data:doc,error:docError}=await db.from('registration_documents').select('*').eq('registration_id',id).eq('document_type',type).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(docError||!doc) return NextResponse.json({message:'Dokumen belum tersedia.'},{status:404});
  const {data,error}=await db.storage.from('preseptor-private').createSignedUrl(doc.storage_path,600);
  if(error) return NextResponse.json({message:'Gagal membuat tautan dokumen.'},{status:500});
  return NextResponse.json({url:data.signedUrl,expiresIn:600,document:doc},{headers:{'Cache-Control':'private, no-store'}});
}
