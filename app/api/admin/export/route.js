import { NextResponse } from 'next/server';
import ExcelJS from 'exceljs';
import { requireAdmin } from '../../../../lib/auth';
import { getSupabaseAdmin } from '../../../../lib/supabase-admin';
import { rupiah } from '../../../../lib/billing';

export const runtime='nodejs';

export async function POST(request){
  const auth=await requireAdmin(request,['super_admin','event_admin']);
  if(auth.error) return NextResponse.json({message:auth.error},{status:auth.status});
  const body=await request.json().catch(()=>({}));
  const ids=Array.isArray(body.ids)?body.ids.filter(Boolean).slice(0,500):null;
  if(Array.isArray(ids)&&ids.length===0) return NextResponse.json({message:'Tidak ada data untuk diekspor.'},{status:422});
  const db=getSupabaseAdmin();
  let query=db.from('registrations').select('*').order('created_at',{ascending:true});
  if(Array.isArray(ids)) query=query.in('id',ids);
  const {data,error}=await query;
  if(error) return NextResponse.json({message:'Gagal membaca data pendaftar.'},{status:500});

  const wb=new ExcelJS.Workbook();
  wb.creator='APTFI Preseptor';
  wb.created=new Date();
  const ws=wb.addWorksheet('Pendaftar');
  ws.mergeCells('A1:R1');
  ws.getCell('A1').value='DATA PENDAFTAR PELATIHAN PRESEPTOR APTFI 2026';
  ws.getCell('A1').font={bold:true,size:14,color:{argb:'FF11185D'}};
  ws.getCell('A1').alignment={vertical:'middle'};
  ws.getRow(1).height=28;
  ws.mergeCells('A2:R2');
  ws.getCell('A2').value=`Diekspor: ${new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date())}`;
  ws.getCell('A2').font={size:9,color:{argb:'FF657395'}};
  const headers=['No','Nomor Pendaftaran','Nama','Email','Status Email','WhatsApp','Nomor STRA','Homebase','Kategori','Tempat Praktik','Mode','Status Persyaratan','Status Pembayaran','Status Akhir','Biaya','Tanggal Daftar','Tanggal Verifikasi Bayar','Sumber'];
  ws.addRow([]);
  const headerRow=ws.addRow(headers);
  headerRow.font={bold:true,color:{argb:'FFFFFFFF'}};
  headerRow.fill={type:'pattern',pattern:'solid',fgColor:{argb:'FF11185D'}};
  headerRow.alignment={vertical:'middle'};
  headerRow.height=24;
  (data||[]).forEach((r,i)=>ws.addRow([
    i+1,r.registration_code,r.full_name,(r.email_needs_update?(r.legacy_contact_email||r.email):r.email),(r.email_needs_update?'PERLU DIPERBARUI':'OK'),r.whatsapp,r.stra_number||'',r.university||'',r.participant_type||'',
    [r.practice_type,r.practice_name].filter(Boolean).join(' - '),r.attendance_mode||'',r.requirements_status,r.payment_status,r.overall_status,
    Number(r.amount_due||1000000),r.created_at?new Date(r.created_at):'',r.payment_verified_at?new Date(r.payment_verified_at):'',r.legacy_source||'webapp'
  ]));
  ws.getColumn(15).numFmt='"Rp" #,##0';
  ws.getColumn(16).numFmt='dd mmmm yyyy hh:mm';
  ws.getColumn(17).numFmt='dd mmmm yyyy hh:mm';
  const widths=[6,25,30,30,18,18,20,34,22,32,12,20,20,20,16,22,24,16];
  widths.forEach((w,i)=>ws.getColumn(i+1).width=w);
  ws.views=[{state:'frozen',ySplit:4}];
  ws.autoFilter={from:{row:4,column:1},to:{row:4,column:18}};
  ws.eachRow((row,rowNumber)=>{if(rowNumber>4){row.alignment={vertical:'top',wrapText:true};row.border={bottom:{style:'hair',color:{argb:'FFE2E8F0'}}}}});
  const buffer=await wb.xlsx.writeBuffer();
  return new Response(Buffer.from(buffer),{headers:{'Content-Type':'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','Content-Disposition':'attachment; filename="pendaftar-preseptor-2026.xlsx"','Cache-Control':'no-store'}});
}
