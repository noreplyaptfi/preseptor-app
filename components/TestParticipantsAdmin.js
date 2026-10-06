'use client';
import FeedbackBridge from './FeedbackBridge';
import { useEffect,useState } from 'react';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import ActionDialog from './ActionDialog';

export default function TestParticipantsAdmin(){
  const [rows,setRows]=useState([]),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false),[remove,setRemove]=useState(null);
  async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function api(url,opts={}){const t=await token();const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`}});const j=await r.json().catch(()=>({}));if(!r.ok)throw new Error(j.message||'Request gagal');return j}
  async function load(){try{setRows((await api('/api/admin/test-participants')).participants||[])}catch(e){setError(e.message)}}
  useEffect(()=>{load()},[]);

  async function create(e){
    e.preventDefault();
    const form=e.currentTarget;
    const b=Object.fromEntries(new FormData(form));
    try{
      setBusy(true);setError('');setNotice('');
      const j=await api('/api/admin/test-participants',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(b)});
      setNotice(`Akun uji ${j.registration_code} dibuat. Gunakan Lupa Password untuk aktivasi.`);
      form.reset();
      await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  async function del(){
    try{
      setBusy(true);setError('');
      await api('/api/admin/test-participants',{method:'DELETE',headers:{'Content-Type':'application/json'},body:JSON.stringify({id:remove.id})});
      setRemove(null);
      await load();
    }catch(e){setError(e.message)}finally{setBusy(false)}
  }

  return <section className="admin-grid-team">
    <form className="panel" onSubmit={create}>
      <div className="panel-head"><div><h2>Buat akun uji peserta</h2><p>Tidak memakai kuota, statistik, atau export resmi.</p></div></div>
      <FeedbackBridge notice={notice} error={error} onNotice={()=>setNotice('')}/>
      <div className="field"><label>Nama</label><input name="full_name" required placeholder="Dummy Peserta"/></div>
      <div className="field"><label>Email</label><input name="email" type="email" required/></div>
      <div className="field"><label>Mode simulasi</label><select name="attendance_mode" defaultValue="Online"><option>Online</option><option>Offline</option></select></div>
      <button className="btn btn-brand-primary" disabled={busy}>{busy?'Membuat...':'Buat akun uji'}</button>
    </form>
    <div className="panel">
      <div className="panel-head"><div><h2>Daftar akun uji</h2><p>{rows.length} akun</p></div></div>
      <div className="team-list">{rows.map(r=><div className="team-row" key={r.id}><div className="avatar">T</div><div className="team-info"><strong>{r.full_name}</strong><small>{r.email} · {r.attendance_mode} · {r.registration_code}</small></div><span className="status status-info">TEST</span><button type="button" className="btn btn-danger btn-small" onClick={()=>setRemove(r)}>Hapus</button></div>)}</div>
    </div>
    <ActionDialog open={!!remove} title="Hapus akun uji?" description="Registration dan akun Auth dummy akan dihapus permanen." tone="danger" confirmLabel="Ya, hapus" busy={busy} onClose={()=>setRemove(null)} onConfirm={del}/>
  </section>
}
