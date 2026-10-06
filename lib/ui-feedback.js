// v0.7.2 — Notifikasi (toast) dan dialog konfirmasi in-app.
// Dipakai dari komponen client mana pun; ditampilkan oleh <UiFeedbackHost/> di app/layout.js.
// Menggantikan alert()/confirm() bawaan browser agar seluruh aplikasi memakai gaya yang sama.

const listeners=new Set();
const pending=[];
let seq=0;

function emit(evt){
  if(!listeners.size){
    // Host belum terpasang: simpan dulu, dikirim begitu host aktif.
    pending.push(evt);
    return;
  }
  for(const fn of listeners)fn(evt);
}

export function subscribeFeedback(fn){
  listeners.add(fn);
  while(pending.length)fn(pending.shift());
  return ()=>{listeners.delete(fn)};
}

export function toast(message,opts={}){
  const text=String(message??'').trim();
  if(!text||typeof window==='undefined')return null;
  const type=opts.type||'info';
  const id=++seq;
  emit({kind:'toast',id,type,title:opts.title||null,message:text,duration:opts.duration??(type==='error'?7000:4500)});
  return id;
}
toast.success=(message,opts={})=>toast(message,{...opts,type:'success'});
toast.error=(message,opts={})=>toast(message,{...opts,type:'error'});
toast.info=(message,opts={})=>toast(message,{...opts,type:'info'});
toast.warning=(message,opts={})=>toast(message,{...opts,type:'warning'});

// Mengembalikan Promise<boolean>.
// opts: { title, description, confirmLabel, cancelLabel, tone: 'default'|'danger' } atau string deskripsi.
export function confirmDialog(opts={}){
  const o=typeof opts==='string'?{description:opts}:opts;
  if(typeof window==='undefined')return Promise.resolve(false);
  return new Promise(resolve=>{
    emit({kind:'confirm',id:++seq,title:o.title||'Konfirmasi',description:o.description||'',confirmLabel:o.confirmLabel||'Lanjutkan',cancelLabel:o.cancelLabel||'Batal',tone:o.tone||'default',resolve});
  });
}
