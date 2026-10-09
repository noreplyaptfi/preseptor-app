import { PDFDocument,StandardFonts,rgb,degrees } from 'pdf-lib';
import QRCode from 'qrcode';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { certificateConfig,modeText,winAnsiSafe,parseSyllabus,formatHours,RECIPIENT_ROLES } from './certificate';

// v0.8.0 — Sertifikat PDF, desain bawaan A4 landscape.
// v0.8.6 — + tanda tangan & cap (gambar), halaman 2 tabel materi & JEP,
//          sertifikat pemateri/moderator, dan versi bahasa Inggris.

const W=841.89,H=595.28;
const NAVY=rgb(0.067,0.094,0.365);
const BLUE=rgb(0.094,0.341,0.910);
const SKY=rgb(0.78,0.85,0.98);
const PALE=rgb(0.945,0.96,0.995);
const MUTED=rgb(0.38,0.44,0.58);
const INK=rgb(0.11,0.16,0.33);
const RED=rgb(0.78,0.09,0.09);
const WHITE=rgb(1,1,1);

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

// Teks satu baris rata tengah yang diperkecil bila terlalu lebar.
function centeredFit(page,text,y,size,font,color,maxWidth,minSize=8){
  const t=winAnsiSafe(text);
  if(!t)return 0;
  let s=size;
  while(s>minSize&&widthOf(font,t,s)>maxWidth)s-=0.5;
  return centered(page,t,y,s,font,color);
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

// Nama: perkecil sampai muat; bila masih terlalu panjang, pecah menjadi dua baris.
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
  page.drawRectangle({x,y,width:size,height:size,color:WHITE});
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

function drawFrame(page){
  page.drawRectangle({x:0,y:0,width:W,height:H,color:WHITE});
  page.drawRectangle({x:16,y:16,width:W-32,height:H-32,borderColor:NAVY,borderWidth:2.4});
  page.drawRectangle({x:25,y:25,width:W-50,height:H-50,borderColor:SKY,borderWidth:1});
  corner(page,25,25,1,1);corner(page,W-25,H-25,-1,-1);corner(page,W-25,25,-1,1);corner(page,25,H-25,1,-1);
}

const TEXT={
  id:{
    numberLabel:'Nomor',presented:'diberikan kepada',
    participantLead:'atas partisipasinya sebagai ',recipientLead:'atas kontribusinya sebagai ',roleTail:' dalam',
    organizedBy:'yang diselenggarakan oleh ',on:'pada ',
    verifyTitle:'Verifikasi keaslian',verifyHint:'Pindai kode QR atau buka:',code:'Kode',
    footer:'Sertifikat elektronik ini diterbitkan melalui Sistem Pelatihan Preseptor APTFI.',
    attachment:'Lampiran Sertifikat Nomor',colTitle:'Materi',colHours:'Durasi (JEP)',total:'Total'
  },
  en:{
    numberLabel:'No.',presented:'is presented to',
    participantLead:'for participating as ',recipientLead:'in recognition of the valuable contribution as ',roleTail:' in the',
    organizedBy:'organized by the ',on:'held on ',
    verifyTitle:'Verify authenticity',verifyHint:'Scan the QR code or visit:',code:'Code',
    footer:'This electronic certificate was issued through the APTFI Preceptor Training System.',
    attachment:'Attachment to Certificate No.',colTitle:'Topic',colHours:'Duration (JEP)',total:'Total'
  }
};

function texts(c,lang){
  const en=lang==='en';
  return {
    t:TEXT[en?'en':'id'],
    heading:en?c.heading_en:c.heading,
    eventName:en?c.event_name_en:c.event_name,
    organizer:en?c.organizer_en:c.organizer,
    dateText:en?c.date_text_en:c.date_text,
    issueDate:en?c.issue_date_text_en:c.issue_date_text,
    signatoryTitle:en?c.signatory_title_en:c.signatory_title,
    syllabusTitle:en?c.syllabus_title_en:c.syllabus_title,
    syllabusText:en?c.syllabus_text_en:c.syllabus_text
  };
}

function roleWord(kind,lang,c){
  if(kind==='speaker'||kind==='moderator')return RECIPIENT_ROLES[kind][lang==='en'?'en':'id'];
  return lang==='en'?'PARTICIPANT':c.role_text;
}

async function embedSignature(pdf,signature){
  if(!signature)return null;
  try{return await pdf.embedPng(signature)}catch{return null}
}

// Gambar tanda tangan & cap di antara jabatan dan nama penandatangan.
function drawSignature(page,img,cx,top,bottom){
  const maxH=top-bottom,maxW=200;
  let h=maxH,w=img.width*h/img.height;
  if(w>maxW){w=maxW;h=img.height*w/img.width}
  page.drawImage(img,{x:cx-w/2,y:bottom+(maxH-h)/2,width:w,height:h});
}

async function drawTemplate(pdf,page,fonts,{name,certificateNo,mode,config,verifyUrl,verifyCode,kind,lang,topic,signature}){
  const {regular,bold,serifBold,serifItalic,serifBoldItalic}=fonts;
  const c=config;
  const x=texts(c,lang),t=x.t;
  const recipient=kind==='speaker'||kind==='moderator';

  drawFrame(page);

  // Lambang samar di latar
  const emblem=await pdf.embedPng(await asset('aptfi-emblem.png'));
  const es=250;
  page.drawImage(emblem,{x:W/2-es/2,y:H/2-es/2-28,width:es,height:es,opacity:0.05});

  // Logo
  const logo=await pdf.embedPng(await asset('aptfi-logo.png'));
  const lw=218,lh=logo.height*lw/logo.width;
  page.drawImage(logo,{x:W/2-lw/2,y:H-48-lh,width:lw,height:lh});

  // Judul & nomor
  spaced(page,x.heading,438,38,serifBold,NAVY,7);
  centered(page,`${t.numberLabel}: ${certificateNo}`,418,10,regular,MUTED);

  centered(page,t.presented,384,15,serifItalic,INK);

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
  let y=underlineY-28;
  centeredRich(page,[{text:recipient?t.recipientLead:t.participantLead,font:regular},{text:roleWord(kind,lang,c),font:bold,color:NAVY},{text:t.roleTail,font:regular}],y,12);
  y-=28;
  centeredFit(page,x.eventName,y,19,bold,NAVY,680,13);
  const topicText=recipient&&topic?`${RECIPIENT_ROLES[kind][lang==='en'?'topicEn':'topicId']} “${topic}”`:'';
  if(topicText){y-=21;centeredFit(page,topicText,y,12.5,serifItalic,INK,640,9)}
  y-=22;
  centeredFit(page,`${t.organizedBy}${x.organizer}`,y,11,regular,INK,640,8);
  y-=16;
  const where=modeText(mode,c,lang);
  centeredFit(page,`${t.on}${x.dateText}${where?` ${where}`:''}.`,y,11,regular,INK,640,8);
  if(!recipient&&c.note_text){y-=20;centeredFit(page,c.note_text,y,10,regular,MUTED,640,8)}

  // Tanda tangan (ruang lebih tinggi bila ada gambar tanda tangan & cap)
  const sx=W-208;
  const sig=await embedSignature(pdf,signature);
  const L=sig?{place:186,title:170,name:72}:{place:168,title:152,name:82};
  centered(page,`${c.issue_place}, ${x.issueDate}`,L.place,11,regular,INK,sx);
  centered(page,x.signatoryTitle,L.title,11,bold,NAVY,sx);
  const nw=centered(page,c.signatory_name,L.name,11.5,bold,NAVY,sx);
  page.drawLine({start:{x:sx-Math.max(nw,150)/2-6,y:L.name-5},end:{x:sx+Math.max(nw,150)/2+6,y:L.name-5},thickness:0.8,color:NAVY});
  if(sig)drawSignature(page,sig,sx,L.title-3,L.name+9);

  // QR verifikasi
  if(verifyUrl){
    const qs=78,qx=62,qy=62;
    drawQr(page,verifyUrl,qx,qy,qs);
    page.drawText(t.verifyTitle,{x:qx+qs+10,y:qy+54,size:8.5,font:bold,color:NAVY});
    page.drawText(t.verifyHint,{x:qx+qs+10,y:qy+41,size:7.5,font:regular,color:MUTED});
    const shortUrl=winAnsiSafe(verifyUrl.replace(/^https?:\/\//,''));
    page.drawText(shortUrl,{x:qx+qs+10,y:qy+30,size:7.5,font:regular,color:BLUE,maxWidth:230});
    if(verifyCode)page.drawText(`${t.code}: ${verifyCode}`,{x:qx+qs+10,y:qy+17,size:7.5,font:regular,color:MUTED});
  }

  centered(page,t.footer,36,7.5,regular,MUTED);
}

// Halaman 2: tabel materi & JEP.
async function drawSyllabus(pdf,page,fonts,{name,certificateNo,config,lang,syllabus}){
  const {regular,bold,italic,serifBold}=fonts;
  const c=config;
  const x=texts(c,lang),t=x.t;

  drawFrame(page);
  const logo=await pdf.embedPng(await asset('aptfi-logo.png'));
  const lw=150,lh=logo.height*lw/logo.width;
  page.drawImage(logo,{x:W/2-lw/2,y:H-46-lh,width:lw,height:lh});

  const titleY=H-46-lh-38;
  spaced(page,x.syllabusTitle,titleY,24,serifBold,NAVY,4);
  centeredFit(page,x.eventName,titleY-24,13,bold,NAVY,640,10);
  centeredFit(page,`${t.attachment} ${certificateNo} · ${winAnsiSafe(name)}`,titleY-42,9.5,regular,MUTED,680,7);

  // Tabel
  const colHours=130,tableW=560,colTitle=tableW-colHours;
  const left=W/2-tableW/2;
  const top=titleY-62;
  const n=syllabus.rows.length;
  const rowH=Math.max(16,Math.min(27,(top-92)/(n+2)));
  const size=rowH>=24?11:rowH>=20?10:9;
  const line=SKY;
  const textY=(rowY)=>rowY+rowH/2-size*0.35;

  // Header
  let rowY=top-rowH;
  page.drawRectangle({x:left,y:rowY,width:tableW,height:rowH,color:NAVY});
  page.drawText(winAnsiSafe(t.colTitle),{x:left+colTitle/2-widthOf(bold,winAnsiSafe(t.colTitle),size)/2,y:textY(rowY),size,font:bold,color:WHITE});
  centered(page,t.colHours,textY(rowY),size,bold,WHITE,left+colTitle+colHours/2);

  // Baris materi
  syllabus.rows.forEach((r,i)=>{
    rowY-=rowH;
    if(i%2===1)page.drawRectangle({x:left,y:rowY,width:tableW,height:rowH,color:PALE});
    const font=r.italic?italic:regular;
    let label=winAnsiSafe(r.title),s=size;
    while(s>7&&widthOf(font,label,s)>colTitle-22)s-=0.5;
    page.drawText(label,{x:left+12,y:textY(rowY),size:s,font,color:INK});
    centered(page,formatHours(r.hours,lang),textY(rowY),size,regular,INK,left+colTitle+colHours/2);
    page.drawLine({start:{x:left,y:rowY},end:{x:left+tableW,y:rowY},thickness:0.6,color:line});
  });

  // Total
  rowY-=rowH;
  page.drawRectangle({x:left,y:rowY,width:tableW,height:rowH,color:PALE});
  page.drawText(winAnsiSafe(t.total),{x:left+12,y:textY(rowY),size,font:bold,color:NAVY});
  centered(page,formatHours(syllabus.total,lang),textY(rowY),size,bold,NAVY,left+colTitle+colHours/2);

  // Garis tepi & pemisah kolom
  const tableH=top-rowY;
  page.drawRectangle({x:left,y:rowY,width:tableW,height:tableH,borderColor:NAVY,borderWidth:1});
  page.drawLine({start:{x:left+colTitle,y:rowY},end:{x:left+colTitle,y:top},thickness:0.6,color:line});
  page.drawLine({start:{x:left,y:rowY+rowH},end:{x:left+tableW,y:rowY+rowH},thickness:1,color:NAVY});

  centered(page,t.footer,36,7.5,regular,MUTED);
}

function drawWatermark(page,fonts,kind){
  if(kind==='test'){
    const text='DUMMY / TEST — TIDAK BERLAKU';
    const size=44,w=widthOf(fonts.bold,text,size),angle=22,rad=angle*Math.PI/180;
    page.drawText(text,{x:W/2-(w/2)*Math.cos(rad)+(size/3)*Math.sin(rad),y:H/2-(w/2)*Math.sin(rad)-(size/3)*Math.cos(rad),size,font:fonts.bold,color:RED,opacity:0.17,rotate:degrees(angle)});
    page.drawRectangle({x:32,y:H-58,width:208,height:22,color:RED,opacity:0.9});
    page.drawText('SERTIFIKAT UJI — TIDAK BERLAKU',{x:41,y:H-51,size:9,font:fonts.bold,color:WHITE});
  }else if(kind==='preview'){
    const text='CONTOH';
    const size=120,w=widthOf(fonts.bold,text,size),angle=20,rad=angle*Math.PI/180;
    page.drawText(text,{x:W/2-(w/2)*Math.cos(rad)+(size/3)*Math.sin(rad),y:H/2-(w/2)*Math.sin(rad)-(size/3)*Math.cos(rad),size,font:fonts.bold,color:BLUE,opacity:0.08,rotate:degrees(angle)});
  }
}

// kind: 'participant' | 'speaker' | 'moderator'; lang: 'id' | 'en'
// mode: 'Offline' | 'Online' | null; signature: bytes PNG (opsional); watermark: null | 'test' | 'preview'
export async function buildCertificatePdf({name,certificateNo,mode,config,verifyUrl,verifyCode,watermark=null,kind='participant',lang='id',topic=null,signature=null}){
  const c=certificateConfig(config);
  const pdf=await PDFDocument.create();
  pdf.setTitle(winAnsiSafe(`${lang==='en'?'Certificate':'Sertifikat'} ${name}`));
  pdf.setAuthor('APTFI');
  pdf.setSubject(winAnsiSafe(`${lang==='en'?c.event_name_en:c.event_name} — ${certificateNo}`));
  const fonts={
    regular:await pdf.embedFont(StandardFonts.Helvetica),
    bold:await pdf.embedFont(StandardFonts.HelveticaBold),
    italic:await pdf.embedFont(StandardFonts.HelveticaOblique),
    serifBold:await pdf.embedFont(StandardFonts.TimesRomanBold),
    serifItalic:await pdf.embedFont(StandardFonts.TimesRomanItalic),
    serifBoldItalic:await pdf.embedFont(StandardFonts.TimesRomanBoldItalic)
  };
  const page=pdf.addPage([W,H]);
  await drawTemplate(pdf,page,fonts,{name,certificateNo,mode,config:c,verifyUrl,verifyCode,kind,lang,topic,signature});
  drawWatermark(page,fonts,watermark);

  const syllabus=parseSyllabus(lang==='en'?c.syllabus_text_en:c.syllabus_text);
  if(syllabus.rows.length){
    const page2=pdf.addPage([W,H]);
    await drawSyllabus(pdf,page2,fonts,{name,certificateNo,config:c,lang,syllabus});
    drawWatermark(page2,fonts,watermark);
  }
  return pdf.save();
}

export function certificateFilename(registrationCode,isTest){
  const code=String(registrationCode||'peserta').replace(/[^A-Za-z0-9-]/g,'');
  return `${isTest?'TEST-':''}sertifikat-preseptor-2026-${code}.pdf`;
}

export function recipientFilename(role,name){
  const slug=String(name||'').normalize('NFKD').replace(/[^\w\s-]/g,'').trim().replace(/\s+/g,'-').toLowerCase().slice(0,60)||'penerima';
  return `sertifikat-${role==='moderator'?'moderator':'pemateri'}-${slug}.pdf`;
}
