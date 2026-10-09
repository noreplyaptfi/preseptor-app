import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { nikRowFor,nikSummary } from '../../../../lib/nik-data';
export const dynamic='force-dynamic';

export async function GET(request){
  const auth=await requireUser(request);if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});const db=getSupabaseAdmin();const {data:reg,error}=await db.from('registrations').select('*').ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();if(error)return NextResponse.json({message:'Gagal membaca pendaftaran.'},{status:500});if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});const [{data:documents},nikResult]=await Promise.all([db.from('registration_documents').select('*').eq('registration_id',reg.id).order('created_at',{ascending:false}),nikRowFor(db,reg.id)]);const docs={};for(const doc of documents||[]){if(!docs[doc.document_type])docs[doc.document_type]=doc}
  // v0.8.5 — ringkasan NIK (tanpa NIK lengkap). null bila migration 023 belum dijalankan.
  const nik=nikResult.ready?nikSummary(nikResult.row):null;
  return NextResponse.json({registration:{...reg,documents:docs,nik}},{headers:{'Cache-Control':'private, no-store'}});
}
