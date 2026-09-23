import { NextResponse } from 'next/server';
import writeExcelFile from 'write-excel-file/node';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';

export const runtime='nodejs';

const HEADERS=['No','Nomor Pendaftaran','Nama','Email','Status Email','WhatsApp','Nomor STRA','Homebase','Kategori','Tempat Praktik','Mode','Status Persyaratan','Status Pembayaran','Status Akhir','Biaya','Tanggal Daftar','Tanggal Verifikasi Bayar','Sumber'];
const WIDTHS=[6,25,30,30,18,18,20,34,22,32,12,20,20,20,16,22,24,16];
const BORDER={style:'hair',color:'#E2E8F0'};
function text(value){return value==null?'':String(value)}
function dateId(value){
  if(!value)return '';
  try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(value))}catch{return ''}
}
function cell(value,extra={}){return {value:text(value),wrap:true,alignVertical:'top',...extra}}

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
  const {data,error}=await query;
  if(error) return NextResponse.json({message:'Gagal membaca data pendaftar.'},{status:500});

  const titleRow=[{value:'DATA PENDAFTAR PELATIHAN PRESEPTOR APTFI 2026',columnSpan:18,fontWeight:'bold',fontSize:14,textColor:'#11185D',height:28},...Array(17).fill(null)];
  const exportedAt=`Diekspor: ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date())}`;
  const metaRow=[{value:exportedAt,columnSpan:18,fontSize:9,textColor:'#657395'},...Array(17).fill(null)];
  const emptyRow=Array(18).fill(null);
  const headerRow=HEADERS.map(h=>({value:h,fontWeight:'bold',textColor:'#FFFFFF',backgroundColor:'#11185D',alignVertical:'center',height:24,wrap:true}));
  const rows=(data||[]).map((r,i)=>{
    const values=[
      i+1,r.registration_code,r.full_name,(r.email_needs_update?(r.legacy_contact_email||r.email):r.email),(r.email_needs_update?'PERLU DIPERBARUI':'OK'),r.whatsapp,r.stra_number||'',r.university||'',r.participant_type||'',
      [r.practice_type,r.practice_name].filter(Boolean).join(' - '),r.attendance_mode||'',r.requirements_status,r.payment_status,r.overall_status,
      Number(r.amount_due||1000000),dateId(r.created_at),dateId(r.payment_verified_at),r.legacy_source||'webapp'
    ];
    return values.map((v,index)=> index===14
      ? {value:Number(v||0),type:Number,format:'"Rp" #,##0',alignVertical:'top',bottomBorderStyle:BORDER.style,bottomBorderColor:BORDER.color}
      : cell(v,{bottomBorderStyle:BORDER.style,bottomBorderColor:BORDER.color})
    );
  });
  const columns=WIDTHS.map(width=>({width}));
  const buffer=await writeExcelFile([titleRow,metaRow,emptyRow,headerRow,...rows],{columns,stickyRowsCount:4,orientation:'landscape'},{fontFamily:'Lato',fontSize:10}).toBuffer();
  return new Response(buffer,{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="pendaftar-preseptor-2026.xlsx"','Cache-Control':'no-store'}});
}
