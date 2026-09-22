import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

function latestDocuments(list=[]){
  const out={};
  for(const doc of list){if(!out[doc.document_type]) out[doc.document_type]=doc;}
  return out;
}

export async function GET(request){
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('registrations').select('*,registration_documents(*)').ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(error) return NextResponse.json({message:'Gagal membaca pendaftaran.'},{status:500});
  if(!data) return NextResponse.json({message:'Tidak ada pendaftaran yang terkait dengan email ini.'},{status:404});
  const documents=latestDocuments((data.registration_documents||[]).sort((a,b)=>new Date(b.created_at)-new Date(a.created_at)));
  delete data.registration_documents;
  return NextResponse.json({registration:{...data,documents}});
}
