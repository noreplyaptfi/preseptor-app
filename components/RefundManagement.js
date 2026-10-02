'use client';

import { useEffect,useMemo,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import ActionDialog from './ActionDialog';
import writeExcelFile from 'write-excel-file/browser';

const labels={requested:'Diajukan',under_review:'Sedang direview',ready:'Siap',processing:'Processing',refunded:'Selesai',rejected:'Ditolak',cancelled:'Dibatalkan'};
function money(v){return new Intl.NumberFormat('id-ID',{style:'currency',currency:'IDR',maximumFractionDigits:0}).format(Number(v||0))}
function dt(v){return v?new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v)):'—'}
function statusClass(v){return v==='refunded'?'status-ok':['rejected','cancelled'].includes(v)?'status-bad':'status-pending'}

export default function RefundManagement(){
  const [refunds,setRefunds]=useState([]);
  const [batches,setBatches]=useState([]);
  const [filter,setFilter]=useState('active');
  const [selected,setSelected]=useState([]);
  const [busy,setBusy]=useState(false);
  const [error,setError]=useState('');
  const [notice,setNotice]=useState('');
  const [dialog,setDialog]=useState(null);

  async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function api(url,opts={}){const t=await token();const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'Request gagal.');return j}
  async function load(){try{const j=await api('/api/admin/refunds');setRefunds(j.refunds||[]);setBatches(j.batches||[]);setSelected(v=>v.filter(id=>(j.refunds||[]).some(x=>x.id===id&&x.status==='ready')))}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[]);

  const shown=useMemo(()=>refunds.filter(x=>filter==='all'?true:filter==='active'?!['refunded','rejected','cancelled'].includes(x.status):x.status===filter),[refunds,filter]);
  const stats=useMemo(()=>({review:refunds.filter(x=>['requested','under_review'].includes(x.status)).length,ready:refunds.filter(x=>x.status==='ready').length,processing:refunds.filter(x=>x.status==='processing').length,done:refunds.filter(x=>x.status==='refunded').length,readyAmount:refunds.filter(x=>x.status==='ready').reduce((s,x)=>s+Number(x.approved_amount||x.requested_amount||0),0)}),[refunds]);

  async function patchRefund(item,action,payload={}){
    try{
      setBusy(true);setError('');setNotice('');
      await api('/api/admin/refunds',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:item.id,action,...payload})});
      setNotice(action==='ready'?'Refund masuk antrean siap diproses.':action==='reject'?'Refund ditolak.':action==='update'?'Data refund diperbarui.':'Status diperbarui.');
      setDialog(null);
      await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  function openReady(item){setDialog({type:'ready',item,amount:String(Math.round(Number(item.approved_amount||item.requested_amount||0))),note:item.admin_note||''})}
  function openReject(item){setDialog({type:'reject',item,note:''})}
  function openEdit(item){setDialog({type:'edit',item,bank_name:item.bank_name||'',account_number:item.account_number||'',account_holder:item.account_holder||'',amount:String(Math.round(Number(item.approved_amount||item.requested_amount||0))),note:item.admin_note||''})}
  function toggle(id){setSelected(v=>v.includes(id)?v.filter(x=>x!==id):[...v,id])}

  async function createBatch(){
    if(!selected.length)return;
    try{
      setBusy(true);setError('');setNotice('');
      const j=await api('/api/admin/refunds/batch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({ids:selected,notes:dialog?.notes||''})});
      setNotice(`Batch ${j.batch.batch_code} dibuat.`);
      setSelected([]);setDialog(null);await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function completeBatch(){
    const batch=dialog?.batch;if(!batch)return;
    try{
      setBusy(true);setError('');setNotice('');
      await api('/api/admin/refunds/batch',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:batch.id,action:'complete',transfer_reference:dialog?.reference||batch.batch_code})});
      setNotice('Batch refund selesai dan status peserta diperbarui.');
      setDialog(null);await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function cancelBatch(){
    const batch=dialog?.batch;if(!batch)return;
    try{
      setBusy(true);setError('');setNotice('');
      await api('/api/admin/refunds/batch',{method:'PATCH',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:batch.id,action:'cancel'})});
      setNotice('Batch dibatalkan. Refund dikembalikan ke status Siap Diproses.');
      setDialog(null);await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function exportBatch(batch){
    const rows=refunds.filter(x=>x.batch_id===batch.id);
    if(!rows.length){setError('Data refund pada batch belum termuat. Muat ulang dashboard.');return}
    try{
      setError('');
      const header=['No','Batch','No. Registrasi','Nama Peserta','Bank','Nomor Rekening','Nama Pemilik Rekening','Nominal Refund','Email','WhatsApp'].map(value=>({value,fontWeight:'bold'}));
      const sheetData=[
        header,
        ...rows.map((x,i)=>[
          i+1,
          batch.batch_code||'',
          x.registration?.registration_code||'',
          x.registration?.full_name||'',
          x.bank_name||'',
          x.account_number||'',
          x.account_holder||'',
          {value:Number(x.approved_amount||x.requested_amount||0),type:Number,format:'#,##0'},
          x.registration?.email||'',
          x.registration?.whatsapp||''
        ])
      ];
      const columns=[
        {width:6},{width:20},{width:28},{width:32},{width:16},
        {width:22},{width:28},{width:20},{width:32},{width:20}
      ];
      await writeExcelFile(sheetData,{sheet:'Refund',columns}).toFile(`refund-${batch.batch_code}.xlsx`);
    }catch(e){setError(`Export gagal: ${e.message}`)}
  }

  const batchSelection=refunds.filter(x=>selected.includes(x.id));
  const batchAmount=batchSelection.reduce((sum,x)=>sum+Number(x.approved_amount||x.requested_amount||0),0);

  return <div className="refund-admin">
    {error&&<div className="alert alert-error">{error}</div>}
    {notice&&<div className="alert alert-success">{notice}</div>}

    <div className="refund-stats"><article><span>Menunggu review</span><strong>{stats.review}</strong></article><article><span>Siap diproses</span><strong>{stats.ready}</strong><small>{money(stats.readyAmount)}</small></article><article><span>Dalam batch</span><strong>{stats.processing}</strong></article><article><span>Selesai</span><strong>{stats.done}</strong></article></div>

    <section className="panel refund-list-panel">
      <div className="panel-head"><div><h2>Antrean Refund</h2><p>Review, siapkan, lalu proses transfer secara batch.</p></div><div className="refund-toolbar"><select className="ui-select compact-select" value={filter} onChange={e=>setFilter(e.target.value)}><option value="active">Aktif</option><option value="requested">Diajukan</option><option value="under_review">Sedang direview</option><option value="ready">Siap</option><option value="processing">Processing</option><option value="refunded">Selesai</option><option value="all">Semua</option></select><button className="btn btn-brand-primary btn-small" disabled={!selected.length||busy} onClick={()=>setDialog({type:'create-batch',notes:''})}>Buat Batch ({selected.length})</button></div></div>
      <div className="refund-table-wrap"><table className="refund-table"><thead><tr><th></th><th>Peserta</th><th>Status</th><th>Rekening</th><th>Nominal</th><th>Pengajuan</th><th>Aksi</th></tr></thead><tbody>{shown.map(x=><tr key={x.id}><td><input className="ui-checkbox" type="checkbox" checked={selected.includes(x.id)} disabled={x.status!=='ready'} onChange={()=>toggle(x.id)}/></td><td><strong>{x.registration?.full_name||'—'}</strong><small>{x.registration?.registration_code}<br/>{x.registration?.email}</small></td><td><span className={`status ${statusClass(x.status)}`}>{labels[x.status]||x.status}</span></td><td><strong>{x.bank_name}</strong><small>{x.account_number_masked} · {x.account_holder}</small><details><summary>Lihat nomor</summary><code>{x.account_number}</code></details></td><td><strong>{money(x.approved_amount||x.requested_amount)}</strong></td><td><small>{dt(x.requested_at)}</small></td><td><div className="refund-row-actions">{!['processing','refunded'].includes(x.status)&&<button className="btn btn-secondary btn-small" onClick={()=>openEdit(x)} disabled={busy}>Edit</button>}{x.status==='requested'&&<button className="btn btn-secondary btn-small" onClick={()=>patchRefund(x,'under_review')} disabled={busy}>Review</button>}{['requested','under_review'].includes(x.status)&&<><button className="btn btn-brand-primary btn-small" onClick={()=>openReady(x)} disabled={busy}>Siapkan</button><button className="btn btn-danger btn-small" onClick={()=>openReject(x)} disabled={busy}>Tolak</button></>}</div></td></tr>)}</tbody></table></div>
    </section>

    <section className="panel refund-batch-panel">
      <div className="panel-head"><div><h2>Batch Refund</h2><p>Export Excel digunakan sebagai daftar transfer massal dan rekonsiliasi.</p></div></div>
      <div className="refund-batches">{batches.length===0?<div className="empty-state compact"><h3>Belum ada batch</h3></div>:batches.map(b=><article key={b.id}><div><strong>{b.batch_code}</strong><small>{b.total_items} peserta · {money(b.total_amount)} · dibuat {dt(b.created_at)}</small></div><span className={`status ${b.status==='completed'?'status-ok':b.status==='cancelled'?'status-bad':'status-pending'}`}>{b.status}</span><button className="btn btn-secondary btn-small" onClick={()=>exportBatch(b)}>Export Excel</button>{b.status==='processing'&&<><button className="btn btn-brand-primary btn-small" onClick={()=>setDialog({type:'complete-batch',batch:b,reference:b.batch_code})} disabled={busy}>Tandai Selesai</button><button className="btn btn-danger btn-small" onClick={()=>setDialog({type:'cancel-batch',batch:b})} disabled={busy}>Batalkan Batch</button></>}</article>)}</div>
    </section>

    <ActionDialog open={dialog?.type==='ready'} title="Siapkan refund?" description="Tentukan nominal yang disetujui sebelum refund masuk antrean proses batch." tone="success" confirmLabel="Ya, siapkan refund" busy={busy} confirmDisabled={!Number.isFinite(Number(dialog?.amount))||Number(dialog?.amount)<0} onClose={()=>!busy&&setDialog(null)} onConfirm={()=>patchRefund(dialog.item,'ready',{amount:Number(dialog.amount),note:dialog.note||''})}>
      <div className="dialog-refund-form"><div className="field dialog-field"><label>Nominal refund *</label><input type="number" min="0" step="1" value={dialog?.amount||''} onChange={e=>setDialog(v=>({...v,amount:e.target.value}))}/></div><div className="field dialog-field"><label>Catatan panitia (opsional)</label><textarea rows="3" value={dialog?.note||''} onChange={e=>setDialog(v=>({...v,note:e.target.value}))}/></div></div>
    </ActionDialog>

    <ActionDialog open={dialog?.type==='reject'} title="Tolak pengajuan refund?" description="Alasan penolakan wajib diisi dan akan tersimpan pada riwayat refund peserta." tone="danger" confirmLabel="Ya, tolak refund" busy={busy} confirmDisabled={!dialog?.note?.trim()} onClose={()=>!busy&&setDialog(null)} onConfirm={()=>patchRefund(dialog.item,'reject',{note:dialog.note})}>
      <div className="field dialog-field"><label>Alasan penolakan *</label><textarea rows="4" value={dialog?.note||''} onChange={e=>setDialog(v=>({...v,note:e.target.value}))} placeholder="Jelaskan alasan penolakan refund."/></div>
    </ActionDialog>

    <ActionDialog open={dialog?.type==='edit'} title="Edit data refund" description="Periksa kembali data rekening dan nominal sebelum menyimpan perubahan." confirmLabel="Simpan perubahan" busy={busy} confirmDisabled={!dialog?.bank_name?.trim()||String(dialog?.account_number||'').replace(/\s+/g,'').length<5||!dialog?.account_holder?.trim()||!Number.isFinite(Number(dialog?.amount))} onClose={()=>!busy&&setDialog(null)} onConfirm={()=>patchRefund(dialog.item,'update',{bank_name:dialog.bank_name,account_number:dialog.account_number,account_holder:dialog.account_holder,amount:Number(dialog.amount),note:dialog.note||''})}>
      <div className="dialog-refund-grid"><div className="field"><label>Bank *</label><input value={dialog?.bank_name||''} onChange={e=>setDialog(v=>({...v,bank_name:e.target.value}))}/></div><div className="field"><label>Nomor rekening *</label><input value={dialog?.account_number||''} onChange={e=>setDialog(v=>({...v,account_number:e.target.value}))}/></div><div className="field dialog-wide"><label>Pemilik rekening *</label><input value={dialog?.account_holder||''} onChange={e=>setDialog(v=>({...v,account_holder:e.target.value}))}/></div><div className="field"><label>Nominal refund *</label><input type="number" min="0" step="1" value={dialog?.amount||''} onChange={e=>setDialog(v=>({...v,amount:e.target.value}))}/></div><div className="field dialog-wide"><label>Catatan panitia</label><textarea rows="3" value={dialog?.note||''} onChange={e=>setDialog(v=>({...v,note:e.target.value}))}/></div></div>
    </ActionDialog>

    <ActionDialog open={dialog?.type==='create-batch'} title="Buat batch refund?" description="Semua refund terpilih akan berubah menjadi Processing dan dimasukkan ke satu batch transfer." confirmLabel="Ya, buat batch" busy={busy} onClose={()=>!busy&&setDialog(null)} onConfirm={createBatch}>
      <div className="dialog-summary"><div><span>Refund terpilih</span><strong>{selected.length} peserta</strong></div><div><span>Total nominal</span><strong>{money(batchAmount)}</strong></div></div><div className="field dialog-field"><label>Catatan batch (opsional)</label><textarea rows="3" value={dialog?.notes||''} onChange={e=>setDialog(v=>({...v,notes:e.target.value}))}/></div>
    </ActionDialog>

    <ActionDialog open={dialog?.type==='complete-batch'} title="Selesaikan batch refund?" description="Status seluruh refund dalam batch akan menjadi Selesai dan email pemberitahuan akan dikirim ke peserta." tone="success" confirmLabel="Ya, tandai selesai" busy={busy} confirmDisabled={!dialog?.reference?.trim()} onClose={()=>!busy&&setDialog(null)} onConfirm={completeBatch}>
      <div className="dialog-summary"><div><span>Batch</span><strong>{dialog?.batch?.batch_code}</strong></div><div><span>Total</span><strong>{money(dialog?.batch?.total_amount)}</strong></div></div><div className="field dialog-field"><label>Referensi transfer / nomor transaksi *</label><input value={dialog?.reference||''} onChange={e=>setDialog(v=>({...v,reference:e.target.value}))}/></div>
    </ActionDialog>

    <ActionDialog open={dialog?.type==='cancel-batch'} title="Batalkan batch refund?" description="Refund pada batch ini akan kembali ke status Siap Diproses dan dapat dimasukkan ke batch lain." tone="danger" confirmLabel="Ya, batalkan batch" busy={busy} onClose={()=>!busy&&setDialog(null)} onConfirm={cancelBatch}/>
  </div>;
}
