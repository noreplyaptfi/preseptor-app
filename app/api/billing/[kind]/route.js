import { NextResponse } from 'next/server';
import { requireUser } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { buildBillingPdf } from '../../../../lib/billing-pdf';
import { billingNumber } from '../../../../lib/billing';

export const runtime='nodejs';

export async function GET(request,{params}){
  const {kind}=await params;
  if(!['invoice','receipt'].includes(kind)) return NextResponse.json({message:'Jenis dokumen tidak valid.'},{status:404});
  const auth=await requireUser(request);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const id=new URL(request.url).searchParams.get('id');
  if(!id) return NextResponse.json({message:'ID pendaftaran wajib diisi.'},{status:422});
  const db=getSupabaseAdmin();
  const {data:reg,error}=await db.from('registrations').select('*,events(*)').eq('id',id).maybeSingle();
  if(error||!reg) return NextResponse.json({message:'Pendaftaran tidak ditemukan.'},{status:404});
  const {data:admin}=await db.from('admin_users').select('id').eq('email',auth.user.email).eq('active',true).maybeSingle();
  const owns=String(reg.email||'').toLowerCase()===String(auth.user.email||'').toLowerCase();
  if(!admin&&!owns) return NextResponse.json({message:'Anda tidak memiliki akses ke dokumen ini.'},{status:403});
  if(kind==='receipt'&&reg.payment_status!=='verified') return NextResponse.json({message:'Kwitansi tersedia setelah pembayaran terverifikasi.'},{status:409});
  const event=Array.isArray(reg.events)?reg.events[0]:reg.events;
  delete reg.events;
  const bytes=await buildBillingPdf({kind,registration:reg,event});
  const filename=`${kind==='receipt'?'kwitansi':'tagihan'}-${reg.registration_code}.pdf`;
  return new Response(Buffer.from(bytes),{status:200,headers:{'Content-Type':'application/pdf','Content-Disposition':`inline; filename="${filename}"`,'Cache-Control':'private, max-age=300, must-revalidate','X-Document-Number':billingNumber(kind,reg)}});
}
