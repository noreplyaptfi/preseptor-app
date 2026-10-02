import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const pagePath=path.join(root,'app','page.js');
const componentImport="import LandingRegistrationStatus from '../components/LandingRegistrationStatus';";

if(!fs.existsSync(pagePath)){
  console.error('ERROR: app/page.js tidak ditemukan. Jalankan script dari root project.');
  process.exit(1);
}

let source=fs.readFileSync(pagePath,'utf8');

if(!source.includes('LandingRegistrationStatus')){
  const lines=source.split(/\r?\n/);
  let lastImport=-1;
  for(let i=0;i<lines.length;i++)if(/^\s*import\s/.test(lines[i]))lastImport=i;
  if(lastImport<0){
    console.error('ERROR: import section pada app/page.js tidak ditemukan. Tidak ada file yang diubah.');
    process.exit(1);
  }
  lines.splice(lastImport+1,0,componentImport);
  source=lines.join('\n');
}

function replaceLandingCard(input){
  if(input.includes('<LandingRegistrationStatus'))return input;
  const marker='className="landing-info-card"';
  const markerPos=input.indexOf(marker);
  if(markerPos<0)throw new Error('Elemen .landing-info-card tidak ditemukan pada app/page.js.');
  const start=input.lastIndexOf('<',markerPos);
  if(start<0)throw new Error('Tag pembuka landing-info-card tidak ditemukan.');
  const openMatch=input.slice(start).match(/^<([A-Za-z][A-Za-z0-9]*)\b/);
  if(!openMatch)throw new Error('Tag landing-info-card tidak dapat dikenali.');
  const tag=openMatch[1];
  const tokenRe=new RegExp(`<\\/?${tag}\\b[^>]*>`,'g');
  tokenRe.lastIndex=start;
  let depth=0;
  let end=-1;
  let match;
  while((match=tokenRe.exec(input))){
    const token=match[0];
    const closing=token.startsWith(`</${tag}`);
    const selfClosing=/\/\s*>$/.test(token);
    if(closing)depth--;
    else if(!selfClosing)depth++;
    if(depth===0){end=tokenRe.lastIndex;break;}
  }
  if(end<0)throw new Error('Tag penutup landing-info-card tidak ditemukan.');
  return input.slice(0,start)+'<LandingRegistrationStatus />'+input.slice(end);
}

try{
  const next=replaceLandingCard(source);
  fs.writeFileSync(pagePath,next,'utf8');
  console.log('OK: halaman utama sekarang memakai status pendaftaran dinamis v0.4.14.');
  console.log('Selanjutnya jalankan: npm run dev');
}catch(error){
  console.error(`ERROR: ${error.message}`);
  console.error('app/page.js tidak ditimpa oleh proses penggantian card.');
  process.exit(1);
}
