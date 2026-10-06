'use client';
import { useEffect,useRef,useState } from 'react';
import ActionDialog from './ActionDialog';
import { subscribeFeedback } from '../lib/ui-feedback';

// v0.7.2 — Penampil toast dan dialog konfirmasi global. Dipasang sekali di app/layout.js.

const ICON={success:'✓',error:'!',warning:'!',info:'i'};

export default function UiFeedbackHost(){
  const [toasts,setToasts]=useState([]);
  const [dialog,setDialog]=useState(null);
  const dialogRef=useRef(null);
  const timers=useRef(new Map());

  function dismiss(id){
    setToasts(list=>list.filter(t=>t.id!==id));
    const timer=timers.current.get(id);
    if(timer){clearTimeout(timer);timers.current.delete(id)}
  }

  function closeDialog(value){
    const current=dialogRef.current;
    dialogRef.current=null;
    setDialog(null);
    current?.resolve(value);
  }

  useEffect(()=>{
    const unsubscribe=subscribeFeedback(evt=>{
      if(evt.kind==='toast'){
        setToasts(list=>[...list.filter(t=>!(t.message===evt.message&&t.type===evt.type)),evt].slice(-4));
        if(evt.duration>0)timers.current.set(evt.id,setTimeout(()=>dismiss(evt.id),evt.duration));
      }else if(evt.kind==='confirm'){
        dialogRef.current?.resolve(false);
        dialogRef.current=evt;
        setDialog(evt);
      }
    });
    return ()=>{
      unsubscribe();
      for(const timer of timers.current.values())clearTimeout(timer);
      timers.current.clear();
      dialogRef.current?.resolve(false);
    };
  },[]);

  return <>
    <div className="ui-toasts" aria-live="polite" aria-atomic="false">
      {toasts.map(t=><div key={t.id} className={`ui-toast ${t.type}`} role={t.type==='error'?'alert':'status'}>
        <span className="ui-toast-icon" aria-hidden="true">{ICON[t.type]||'i'}</span>
        <div className="ui-toast-body">{t.title&&<strong>{t.title}</strong>}<p>{t.message}</p></div>
        <button type="button" className="ui-toast-close" onClick={()=>dismiss(t.id)} aria-label="Tutup notifikasi">×</button>
      </div>)}
    </div>
    <ActionDialog
      open={!!dialog}
      title={dialog?.title||'Konfirmasi'}
      description={dialog?.description||''}
      tone={dialog?.tone||'default'}
      confirmLabel={dialog?.confirmLabel||'Lanjutkan'}
      cancelLabel={dialog?.cancelLabel||'Batal'}
      onConfirm={()=>closeDialog(true)}
      onClose={()=>closeDialog(false)}
    />
  </>;
}
