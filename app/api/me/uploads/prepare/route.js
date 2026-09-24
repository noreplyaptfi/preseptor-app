import { NextResponse } from 'next/server';
import { requireUser } from '../../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../../lib/supabase-admin';
import { validateFileDescriptor,createSignedUpload } from '../../../../../lib/direct-upload';

export const runtime='nodejs';

export async function POST(request){
  const auth=await requireUser(request);if(auth.error)return NextResponse.json({message:auth.error},{status:auth.status});
  let body;try{body=await request.json()}catch{return NextResponse.json({message:'Permintaan tidak valid.'},{status:400})}
  const db=getSupabaseAdmin();
  const {data:reg}=await db.from('registrations').select('*').ilike('email',auth.user.email).order('created_at',{ascending:false}).limit(1).maybeSingle();
  if(!reg)return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const files=body.files||{},allowed=body.purpose==='payment'?['payment_proof']:['stra','experience'];
  const selected={};
  for(const type of allowed){if(!files[type])continue;const label=type==='stra'?'Bukti STRA':type==='experience'?'Bukti pengalaman':'Bukti pembayaran';const err=validateFileDescriptor(files[type],label);if(err)return NextResponse.json({message:err},{status:422});selected[type]=files[type]}
  if(!Object.keys(selected).length)return NextResponse.json({message:'Tidak ada file yang dipilih.'},{status:422});
  try{const uploads=await createSignedUpload(db,{registrationId:reg.id,files:selected});return NextResponse.json({ok:true,uploads:Object.fromEntries(Object.entries(uploads).map(([k,v])=>[k,{path:v.path,token:v.token,name:v.name,type:v.type,size:v.size}]))})}catch(e){console.error('me upload prepare:',e);return NextResponse.json({message:'Gagal menyiapkan unggahan.'},{status:500})}
}
