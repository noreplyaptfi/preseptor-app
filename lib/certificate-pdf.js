import { PDFDocument,StandardFonts,rgb,degrees } from 'pdf-lib';
import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { certificateConfig,modeText,winAnsiSafe } from './certificate';

// v0.8.0 — Sertifikat PDF, desain bawaan (sementara) A4 landscape.
// Template final dapat menggantikan fungsi drawTemplate() tanpa mengubah API.

const W=841.89,H=595.28;
const NAVY=rgb(0.067,0.094,0.365);
const BLUE=rgb(0.094,0.341,0.910);
const SKY=rgb(0.78,0.85,0.98);
const MUTED=rgb(0.38,0.44,0.58);
const INK=rgb(0.11,0.16,0.33);
const RED=rgb(0.78,0.09,0.09);

const assetCache=new Map();
function asset(name){
  if(!assetCache.has(name))assetCache.set(name,readFile(path.join(process.cwd(),'public',name)));
  return assetCache.get(name);
}

function widthOf(font,text,size){return font.widthOfTextAtSize(text,size)}

function centered(page,text,y,size,font,color=INK,cx=W/2){
  const t=winAnsiSafe(text);
  if(!t)return 0;
  const w=widthOf(font,t,size);
  page.drawText(t,{x:cx-w/2,y,size,font,color});
  return w;
}

// Beberapa potongan teks dengan font berbeda dalam satu baris, rata tengah.
function centeredRich(page,parts,y,size,cx=W/2){
  const segs=parts.map(p=>({...p,text:winAnsiSafe(p.text,{trim:false})})).filter(p=>p.text);
  const total=segs.reduce((s,p)=>s+widthOf(p.font,p.text,size),0);
  let x=cx-total/2;
  for(const p of segs){page.drawText(p.text,{x,y,size,font:p.font,color:p.color||INK});x+=widthOf(p.font,p.text,size)}
}

function spaced(page,text,y,size,font,color,spacing){
  const chars=[...winAnsiSafe(text)];
  const widths=chars.map(c=>widthOf(font,c,size));
  const total=widths.reduce((a,b)=>a+b,0)+spacing*Math.max(0,chars.length-1);
  let x=W/2-total/2;
  chars.forEach((c,i)=>{page.drawText(c,{x,y,size,font,color});x+=widths[i]+spacing});
}

// Nama peserta: perkecil sampai muat; bila masih terlalu panjang, pecah menjadi dua baris.
function fitName(font,name,maxWidth){
  for(let size=34;size>=22;size-=1){if(widthOf(font,name,size)<=maxWidth)return {lines:[name],size}}
  const words=name.split(' ');
  let best=null;
  for(let i=1;i<words.length;i++){
    const a=words.slice(0,i).join(' '),b=words.slice(i).join(' ');
    const w=Math.max(widthOf(font,a,24),widthOf(font,b,24));
    if(!best||w<best.w)best={w,lines:[a,b]};
  }
  if(best){
    let size=26;
    while(size>14&&Math.max(...best.lines.map(l=>widthOf(font,l,size)))>maxWidth)size-=1;
    return {lines:best.lines,size};
  }
  let size=22;
  while(size>12&&widthOf(font,name,size)>maxWidth)size-=1;
  return {lines:[name],size};
}

function drawQr(page,text,x,y,size){
  const qr=QRCode.create(text,{errorCorrectionLevel:'M'});
  const n=qr.modules.size,data=qr.modules.data;
  const quiet=2,cell=size/(n+quiet*2);
  page.drawRectangle({x,y,width:size,height:size,color:rgb(1,1,1)});
  for(let r=0;r<n;r++){
    let c=0;
    while(c<n){
      if(!data[r*n+c]){c++;continue}
      let end=c;
      while(end+1<n&&data[r*n+end+1])end++;
      page.drawRectangle({x:x+(quiet+c)*cell,y:y+size-(quiet+r+1)*cell,width:(end-c+1)*cell+0.15,height:cell+0.15,color:NAVY});
      c=end+1;
    }
  }
}

function corner(page,x,y,dx,dy){
  const L=58,T=4;
  page.drawRectangle({x:dx>0?x:x-L,y:dy>0?y:y-T,width:L,height:T,color:NAVY});
  page.drawRectangle({x:dx>0?x:x-T,y:dy>0?y:y-L,width:T,height:L,color:NAVY});
}

async function drawTemplate(pdf,page,fonts,{name,certificateNo,mode,config,verifyUrl,verifyCode}){
  const {regular,bold,serifBold,serifItalic,serifBoldItalic}=fonts;
  const c=config;

  // Bingkai
  page.drawRectangle({x:0,y:0,width:W,height:H,color:rgb(1,1,1)});
  page.drawRectangle({x:16,y:16,width:W-32,height:H-32,borderColor:NAVY,borderWidth:2.4});
  page.drawRectangle({x:25,y:25,width:W-50,height:H-50,borderColor:SKY,borderWidth:1});
  corner(page,25,25,1,1);corner(page,W-25,H-25,-1,-1);corner(page,W-25,25,-1,1);corner(page,25,H-25,1,-1);

  // Lambang samar di latar
  const emblem=await pdf.embedPng(await asset('aptfi-emblem.png'));
  const es=250;
  page.drawImage(emblem,{x:W/2-es/2,y:H/2-es/2-28,width:es,height:es,opacity:0.05});

  // Logo
  const logo=await pdf.embedPng(await asset('aptfi-logo.png'));
  const lw=218,lh=logo.height*lw/logo.width;
  page.drawImage(logo,{x:W/2-lw/2,y:H-48-lh,width:lw,height:lh});

  // Judul & nomor
  spaced(page,c.heading,438,38,serifBold,NAVY,7);
  centered(page,`Nomor: ${certificateNo}`,418,10,regular,MUTED);

  centered(page,'diberikan kepada',384,15,serifItalic,INK);

  // Nama
  const clean=winAnsiSafe(name)||'-';
  const fit=fitName(serifBoldItalic,clean,640);
  const lineGap=fit.size*1.12;
  const topY=fit.lines.length>1?354:342;
  let widest=0;
  fit.lines.forEach((l,i)=>{widest=Math.max(widest,centered(page,l,topY-i*lineGap,fit.size,serifBoldItalic,NAVY))});
  const underlineY=topY-(fit.lines.length-1)*lineGap-12;
  const uw=Math.min(680,Math.max(360,widest+50));
  page.drawLine({start:{x:W/2-uw/2,y:underlineY},end:{x:W/2+uw/2,y:underlineY},thickness:0.9,color:BLUE});

  // Keterangan kegiatan
  centeredRich(page,[{text:'atas partisipasinya sebagai ',font:regular},{text:c.role_text,font:bold,color:NAVY},{text:' dalam',font:regular}],underlineY-28,12);
  centered(page,c.event_name,underlineY-56,19,bold,NAVY);
  centered(page,`yang diselenggarakan oleh ${c.organizer}`,underlineY-78,11,regular,INK);
  centered(page,`pada ${c.date_text} ${modeText(mode,c)}.`,underlineY-94,11,regular,INK);
  if(c.note_text)centered(page,c.note_text,underlineY-114,10,regular,MUTED);

  // Tanda tangan
  const sx=W-208;
  centered(page,`${c.issue_place}, ${c.issue_date_text}`,168,11,regular,INK,sx);
  centered(page,c.signatory_title,152,11,bold,NAVY,sx);
  const nw=centered(page,c.signatory_name,82,11.5,bold,NAVY,sx);
  page.drawLine({start:{x:sx-Math.max(nw,150)/2-6,y:77},end:{x:sx+Math.max(nw,150)/2+6,y:77},thickness:0.8,color:NAVY});

  // QR verifikasi
  if(verifyUrl){
    const qs=78,qx=62,qy=62;
    drawQr(page,verifyUrl,qx,qy,qs);
    page.drawText('Verifikasi keaslian',{x:qx+qs+10,y:qy+54,size:8.5,font:bold,color:NAVY});
    page.drawText('Pindai kode QR atau buka:',{x:qx+qs+10,y:qy+41,size:7.5,font:regular,color:MUTED});
    const shortUrl=winAnsiSafe(verifyUrl.replace(/^https?:\/\//,''));
    page.drawText(shortUrl,{x:qx+qs+10,y:qy+30,size:7.5,font:regular,color:BLUE,maxWidth:230});
    if(verifyCode)page.drawText(`Kode: ${verifyCode}`,{x:qx+qs+10,y:qy+17,size:7.5,font:regular,color:MUTED});
  }

  centered(page,'Sertifikat elektronik ini diterbitkan melalui Sistem Pelatihan Preseptor APTFI.',36,7.5,regular,MUTED);
}

function drawWatermark(page,fonts,kind){
  if(kind==='test'){
    const text='DUMMY / TEST — TIDAK BERLAKU';
    const size=44,w=widthOf(fonts.bold,text,size),angle=22,rad=angle*Math.PI/180;
    page.drawText(text,{x:W/2-(w/2)*Math.cos(rad)+(size/3)*Math.sin(rad),y:H/2-(w/2)*Math.sin(rad)-(size/3)*Math.cos(rad),size,font:fonts.bold,color:RED,opacity:0.17,rotate:degrees(angle)});
    page.drawRectangle({x:32,y:H-58,width:208,height:22,color:RED,opacity:0.9});
    page.drawText('SERTIFIKAT UJI — TIDAK BERLAKU',{x:41,y:H-51,size:9,font:fonts.bold,color:rgb(1,1,1)});
  }else if(kind==='preview'){
    const text='CONTOH';
    const size=120,w=widthOf(fonts.bold,text,size),angle=20,rad=angle*Math.PI/180;
    page.drawText(text,{x:W/2-(w/2)*Math.cos(rad)+(size/3)*Math.sin(rad),y:H/2-(w/2)*Math.sin(rad)-(size/3)*Math.cos(rad),size,font:fonts.bold,color:BLUE,opacity:0.08,rotate:degrees(angle)});
  }
}

// watermark: null | 'test' | 'preview'
export async function buildCertificatePdf({name,certificateNo,mode,config,verifyUrl,verifyCode,watermark=null}){
  const pdf=await PDFDocument.create();
  pdf.setTitle(winAnsiSafe(`Sertifikat ${name}`));
  pdf.setAuthor('APTFI');
  pdf.setSubject(winAnsiSafe(`${certificateConfig(config).event_name} — ${certificateNo}`));
  const page=pdf.addPage([W,H]);
  const fonts={
    regular:await pdf.embedFont(StandardFonts.Helvetica),
    bold:await pdf.embedFont(StandardFonts.HelveticaBold),
    serifBold:await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic:await pdf.embedFont(StandardFonts.TimesRomanItalic),
    serifBoldItalic:await pdf.embedFont(StandardFonts.TimesRomanBoldItalic)
  };
  await drawTemplate(pdf,page,fonts,{name,certificateNo,mode,config:certificateConfig(config),verifyUrl,verifyCode});
  drawWatermark(page,fonts,watermark);
  return pdf.save();
}

export function certificateFilename(registrationCode,isTest){
  const code=String(registrationCode||'peserta').replace(/[^A-Za-z0-9-]/g,'');
  return `${isTest?'TEST-':''}sertifikat-preseptor-2026-${code}.pdf`;
}
