'use client';

import { useEffect, useId } from 'react';

export default function ActionDialog({
  open,
  title,
  description,
  tone='default',
  confirmLabel='Lanjutkan',
  cancelLabel='Kembali',
  busy=false,
  confirmDisabled=false,
  onConfirm,
  onClose,
  children,
}){
  const titleId=useId();
  const descId=useId();

  useEffect(()=>{
    if(!open)return;
    const handler=(event)=>{
      if(event.key==='Escape'&&!busy)onClose?.();
    };
    document.addEventListener('keydown',handler);
    const previous=document.body.style.overflow;
    document.body.style.overflow='hidden';
    return ()=>{
      document.removeEventListener('keydown',handler);
      document.body.style.overflow=previous;
    };
  },[open,busy,onClose]);

  if(!open)return null;
  const symbol=tone==='danger'?'!':tone==='success'?'✓':'i';
  const symbolClass=tone==='danger'?'danger':tone==='success'?'success':'info';
  const confirmClass=tone==='danger'?'btn btn-danger':'btn btn-brand-primary';

  return <div className="modal-backdrop modal-backdrop-top action-dialog-backdrop" onMouseDown={e=>{if(e.target===e.currentTarget&&!busy)onClose?.()}}>
    <section className="confirm-modal action-dialog" role="dialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={description?descId:undefined}>
      <div className={`confirm-symbol ${symbolClass}`}>{symbol}</div>
      <h2 id={titleId}>{title}</h2>
      {description&&<p id={descId}>{description}</p>}
      {children&&<div className="action-dialog-content">{children}</div>}
      <div className="confirm-actions action-dialog-actions">
        <button type="button" className="btn btn-secondary" onClick={onClose} disabled={busy}>{cancelLabel}</button>
        <button type="button" className={confirmClass} onClick={onConfirm} disabled={busy||confirmDisabled}>{busy?'Memproses...':confirmLabel}</button>
      </div>
    </section>
  </div>;
}
