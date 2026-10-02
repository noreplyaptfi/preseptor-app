import fs from 'node:fs';
import path from 'node:path';

const root=process.cwd();
const targets=[
  'app/api/register/finalize/route.js',
  'app/api/me/payment/route.js',
  'app/api/me/uploads/prepare/route.js'
];

let changed=0;
for(const rel of targets){
  const file=path.join(root,rel);
  if(!fs.existsSync(file))continue;
  let source=fs.readFileSync(file,'utf8');
  const before=source;
  source=source.replaceAll(".neq('lifecycle_status','withdrawn')", ".in('lifecycle_status',['active','withdrawal_requested'])");
  source=source.replaceAll("reg.lifecycle_status==='withdrawn'", "['withdrawn','rejected'].includes(reg.lifecycle_status)");
  source=source.replaceAll("reg.lifecycle_status!=='withdrawn'", "!['withdrawn','rejected'].includes(reg.lifecycle_status)");
  if(source!==before){fs.writeFileSync(file,source,'utf8');changed++;console.log(`OK: ${rel} diselaraskan dengan lifecycle v0.4.16.`)}
}
console.log(`Selesai. ${changed} file tambahan diperbarui.`);
