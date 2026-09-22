import { NextResponse } from 'next/server';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { overallStatus } from '../../../../lib/status';
import { logActivity } from '../../../../lib/audit';
import { normalizeName,normalizeInstitution } from '../../../../lib/normalization';

function latestDocuments(list=[]){
  const out={};
  for(const doc of list){if(!out[doc.document_type]) out[doc.document_type]=doc;}
  return out;
}

export async function GET(request){
  const auth=await requireAdmin(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data,error}=await db.from('registrations').select('*,registration_documents(*)').order('created_at',{ascending:false}).order('created_at',{referencedTable:'registration_documents',ascending:false});
  if(error) return NextResponse.json({message:'Gagal membaca data.'},{status:500});

  const softKeys=new Map();
  for(const r of data||[]){
    const key=`${normalizeName(r.full_name)}|${normalizeInstitution(r.university)}`;
    if(key==='|') continue;
    softKeys.set(key,(softKeys.get(key)||0)+1);
  }
  const registrations=(data||[]).map(r=>{
    const documents=latestDocuments(r.registration_documents||[]);
    const key=`${normalizeName(r.full_name)}|${normalizeInstitution(r.university)}`;
    return {...r,registration_documents:undefined,documents,document_types:Object.keys(documents),possible_duplicate:(softKeys.get(key)||0)>1};
  });
  return NextResponse.json({adminUser:auth.adminUser,registrations});
}

// Legacy aggregate-status endpoint retained for backward compatibility.
export async function PATCH(request){
  const body=await request.json();
  if(!body.id||!['requirements','payment'].includes(body.kind)) return NextResponse.json({message:'Permintaan tidak valid.'},{status:422});
  const roles=body.kind==='requirements'?['super_admin','event_admin','document_verifier']:['super_admin','event_admin','payment_verifier'];
  const auth=await requireAdmin(request,roles);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const db=getSupabaseAdmin();
  const {data:reg}=await db.from('registrations').select('*').eq('id',body.id).single();
  if(!reg) return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  let patch={updated_at:new Date().toISOString()};
  if(body.kind==='requirements'){
    if(!['pending','valid','rejected'].includes(body.status)) return NextResponse.json({message:'Status dokumen tidak valid.'},{status:422});
    patch.requirements_status=body.status;
    patch.requirements_verified_at=['valid','rejected'].includes(body.status)?new Date().toISOString():null;
    patch.requirements_verified_by=auth.user.email;
  }else{
    if(!['pending','verified','rejected'].includes(body.status)) return NextResponse.json({message:'Status pembayaran tidak valid.'},{status:422});
    patch.payment_status=body.status;
    patch.payment_verified_at=['verified','rejected'].includes(body.status)?new Date().toISOString():null;
    patch.payment_verified_by=auth.user.email;
  }
  patch.overall_status=overallStatus(patch.requirements_status||reg.requirements_status,patch.payment_status||reg.payment_status);
  await db.from('registrations').update(patch).eq('id',reg.id);
  await logActivity({registrationId:reg.id,actorType:'admin',actorEmail:auth.user.email,action:`${body.kind}_status_${body.status}`});
  return NextResponse.json({ok:true});
}
