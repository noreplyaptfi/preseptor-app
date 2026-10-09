import { NextResponse } from 'next/server';
import writeExcelFile from 'write-excel-file/node';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { nikRowsForEvent } from '../../../../lib/nik-data';

export const runtime='nodejs';

// v0.8.5 — + kolom SKP (Ya/Tidak) dan NIK. NIK ditulis sebagai teks agar 16 digit tidak dibulatkan Excel.
const BORDER={style:'hair',color:'#E2E8F0'};
function text(value){return value==null?'':String(value)}
function dateId(value){
  if(!value)return '';
  try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))}catch{return ''}
}
function cell(value,extra={}){return {value:text(value),wrap:true,alignVertical:'top',...extra}}
function email(r){return r.email_needs_update?(r.legacy_contact_email||r.email):r.email}

// [judul kolom, lebar, nilai(r, nomor, nikRow)]
const COLUMNS=[
  ['No',6,(r,i)=>i+1],
  ['Nomor Pendaftaran',25,r=>r.registration_code],
  ['Nama',30,r=>r.full_name],
  ['Email',30,r=>email(r)],
  ['Status Email',18,r=>r.email_needs_update?'PERLU DIPERBARUI':'OK'],
  ['WhatsApp',18,r=>r.whatsapp],
  ['Nomor STRA',20,r=>r.stra_number||''],
  ['SKP',8,r=>r.skp_eligible?'Ya':'Tidak'],
  ['NIK',20,(r,i,n)=>n?.nik||''],
  ['Homebase',34,r=>r.university||''],
  ['Kategori',22,r=>r.participant_type||''],
  ['Tempat Praktik',32,r=>[r.practice_type,r.practice_name].filter(Boolean).join(' - ')],
  ['Mode',12,r=>r.attendance_mode||''],
  ['Status Persyaratan',20,r=>r.requirements_status],
  ['Status Pembayaran',20,r=>r.payment_status],
  ['Status Akhir',20,r=>r.overall_status],
  ['Biaya',16,r=>Number(r.amount_due||1000000),'money'],
  ['Tanggal Daftar',22,r=>dateId(r.created_at)],
  ['Tanggal Verifikasi Bayar',24,r=>dateId(r.payment_verified_at)],
  ['NIK Diperbarui',22,(r,i,n)=>dateId(n?.updated_at)],
  ['Sumber',16,r=>r.legacy_source||'webapp']
];

export async function POST(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json().catch(()=>({}));
  const ids=Array.isArray(body.ids)?body.ids.filter(Boolean).slice(0,500):null;
  if(Array.isArray(ids)&&ids.length===0) return NextResponse.json({message:'Tidak ada data untuk diekspor.'},{status:422});
  const db=getSupabaseAdmin();
  const slug=process.env.NEXT_PUBLIC_EVENT_SLUG||'preseptor-2026';
  const {data:event,error:eventError}=await db.from('events').select('id').eq('slug',slug).single();
  if(eventError||!event) return NextResponse.json({message:'Event tidak ditemukan.'},{status:404});
  let query=db.from('registrations').select('*').eq('event_id',event.id).order('created_at',{ascending:true});
  if(Array.isArray(ids)) query=query.in('id',ids);
  const [{data,error},nikData]=await Promise.all([query,nikRowsForEvent(db,event.id)]);
  if(error) return NextResponse.json({message:'Gagal membaca data pendaftar.'},{status:500});

  const span=COLUMNS.length;
  const titleRow=[{value:'DATA PENDAFTAR PELATIHAN PRESEPTOR APTFI 2026',columnSpan:span,fontWeight:'bold',fontSize:14,textColor:'#11185D',height:28},...Array(span-1).fill(null)];
  const exportedAt=`Diekspor: ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date())}`;
  const metaRow=[{value:exportedAt,columnSpan:span,fontSize:9,textColor:'#657395'},...Array(span-1).fill(null)];
  const emptyRow=Array(span).fill(null);
  const headerRow=COLUMNS.map(([h])=>({value:h,fontWeight:'bold',textColor:'#FFFFFF',backgroundColor:'#11185D',alignVertical:'center',height:24,wrap:true}));
  const rows=(data||[]).map((r,i)=>{
    const nik=nikData.map.get(r.id)||null;
    return COLUMNS.map(([,,get,kind])=>{
      const v=get(r,i,nik);
      return kind==='money'
        ? {value:Number(v||0),type:Number,format:'"Rp" #,##0',alignVertical:'top',bottomBorderStyle:BORDER.style,bottomBorderColor:BORDER.color}
        : cell(v,{bottomBorderStyle:BORDER.style,bottomBorderColor:BORDER.color});
    });
  });
  const columns=COLUMNS.map(([,width])=>({width}));
  const buffer=await writeExcelFile([titleRow,metaRow,emptyRow,headerRow,...rows],{columns,stickyRowsCount:4,orientation:'landscape'},{fontFamily:'Lato',fontSize:10}).toBuffer();
  return new Response(buffer,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="pendaftar-preseptor-2026.xlsx"','Cache-Control':'no-store'}});
}
