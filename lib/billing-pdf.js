import { PDFDocument,StandardFonts,rgb } from 'pdf-lib';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { billingNumber,formatBillingDate,rupiah,terbilangRupiah } from './billing';

const A4=[595.28,841.89];
const NAVY=rgb(0.07,0.10,0.36);
const BLUE=rgb(0.09,0.34,0.91);
const MUTED=rgb(0.34,0.40,0.54);
const LINE=rgb(0.84,0.88,0.94);
const SOFT=rgb(0.95,0.97,1);
let letterheadBytesPromise;
function getLetterheadBytes(){
  if(!letterheadBytesPromise) letterheadBytesPromise=readFile(path.join(process.cwd(),'public','aptfi-letterhead.png'));
  return letterheadBytesPromise;
}

function text(page,value,x,y,size,font,color=NAVY,options={}){
  page.drawText(String(value??''),{x,y,size,font,color,maxWidth:options.maxWidth,lineHeight:options.lineHeight||size*1.35});
}
function line(page,y,x1=44,x2=551,color=LINE){page.drawLine({start:{x:x1,y},end:{x:x2,y},thickness:1,color});}
function field(page,label,value,x,y,width,font,bold){
  text(page,label,x,y,8,font,MUTED);
  text(page,value||'-',x,y-16,10,bold,NAVY,{maxWidth:width});
}

export async function buildBillingPdf({kind,registration,event}){
  const pdf=await PDFDocument.create();
  const page=pdf.addPage(A4);
  const regular=await pdf.embedFont(StandardFonts.Helvetica);
  const bold=await pdf.embedFont(StandardFonts.HelveticaBold);
  const headerBytes=await getLetterheadBytes();
  const header=await pdf.embedPng(headerBytes);
  const scale=Math.min(507/header.width,108/header.height);
  page.drawImage(header,{x:44,y:841.89-46-header.height*scale,width:header.width*scale,height:header.height*scale});

  const receipt=kind==='receipt';
  const title=receipt?'KWITANSI PEMBAYARAN':'TAGIHAN / INVOICE';
  const number=billingNumber(kind,registration);
  const amount=Number(registration.amount_due||event?.registration_fee||1000000);
  const top=665;
  text(page,title,44,top,19,bold,NAVY);
  text(page,number,44,top-23,9,regular,MUTED);
  page.drawRectangle({x:414,y:top-28,width:137,height:42,borderColor:LINE,borderWidth:1,color:receipt?rgb(0.92,0.98,0.94):SOFT});
  text(page,receipt?'LUNAS / TERVERIFIKASI':registration.payment_status==='verified'?'LUNAS / TERVERIFIKASI':'MENUNGGU VERIFIKASI',427,top-5,9,bold,receipt?rgb(0.06,0.46,0.22):BLUE,{maxWidth:112});

  line(page,top-48);
  field(page,receipt?'Diterima dari':'Ditagihkan kepada',registration.full_name,44,top-72,230,regular,bold);
  field(page,'Nomor pendaftaran',registration.registration_code,300,top-72,251,regular,bold);
  field(page,'Institusi / homebase',registration.university,44,top-121,230,regular,bold);
  field(page,'Mode keikutsertaan',registration.attendance_mode||'-',300,top-121,251,regular,bold);
  field(page,receipt?'Tanggal verifikasi':'Tanggal tagihan',formatBillingDate(receipt?(registration.payment_verified_at||registration.updated_at):registration.created_at),44,top-170,230,regular,bold);
  const displayEmail=registration.email_needs_update?(registration.legacy_contact_email||registration.email):registration.email;
  field(page,'Email',displayEmail,300,top-170,251,regular,bold);

  const tableTop=top-230;
  page.drawRectangle({x:44,y:tableTop,width:507,height:34,color:SOFT,borderColor:LINE,borderWidth:1});
  text(page,'URAIAN',58,tableTop+12,9,bold,NAVY);
  text(page,'JUMLAH',440,tableTop+12,9,bold,NAVY);
  page.drawRectangle({x:44,y:tableTop-58,width:507,height:58,borderColor:LINE,borderWidth:1});
  text(page,'Biaya Pendaftaran Pelatihan Preseptor APTFI',58,tableTop-25,10,bold,NAVY,{maxWidth:330});
  text(page,'7-8 Oktober 2026 | Padang | Online & Offline',58,tableTop-42,8,regular,MUTED,{maxWidth:330});
  text(page,rupiah(amount).replace('Rp','Rp '),425,tableTop-32,10,bold,NAVY,{maxWidth:112});

  page.drawRectangle({x:330,y:tableTop-104,width:221,height:36,color:rgb(0.97,0.98,1),borderColor:LINE,borderWidth:1});
  text(page,'TOTAL',347,tableTop-90,9,bold,MUTED);
  text(page,rupiah(amount).replace('Rp','Rp '),425,tableTop-90,11,bold,NAVY,{maxWidth:112});

  let y=tableTop-145;
  if(receipt){
    text(page,'Terbilang',44,y,8,bold,MUTED);
    page.drawRectangle({x:44,y:y-48,width:507,height:36,color:SOFT,borderColor:LINE,borderWidth:1});
    text(page,terbilangRupiah(amount),58,y-34,10,bold,NAVY,{maxWidth:480});
    y-=82;
    text(page,'Pembayaran di atas telah diterima dan diverifikasi oleh panitia Pelatihan Preseptor APTFI.',44,y,9,regular,MUTED,{maxWidth:507,lineHeight:13});
  }else{
    text(page,'Informasi Pembayaran',44,y,10,bold,NAVY);
    text(page,'BNI 6666512055 a.n APTFI',44,y-22,11,bold,NAVY);
    text(page,'Silakan transfer sesuai jumlah tagihan dan unggah bukti pembayaran melalui formulir / Dashboard Peserta.',44,y-42,9,regular,MUTED,{maxWidth:507,lineHeight:13});
  }

  line(page,118);
  text(page,'Dokumen ini dihasilkan otomatis oleh Sistem Pendaftaran Pelatihan Preseptor APTFI.',44,94,8,regular,MUTED,{maxWidth:507});
  text(page,receipt?'Kwitansi diterbitkan setelah pembayaran dinyatakan terverifikasi.':'Tagihan ini terkait langsung dengan nomor pendaftaran peserta.',44,79,8,regular,MUTED,{maxWidth:507});
  text(page,'Asosiasi Pendidikan Tinggi Farmasi Indonesia (APTFI)',44,52,8,bold,NAVY);
  return pdf.save();
}
