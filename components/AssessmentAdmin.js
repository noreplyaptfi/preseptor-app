'use client';
import { useEffect,useMemo,useState } from 'react';
import writeExcelFile from 'write-excel-file/browser';
import { getSupabaseBrowser } from '../lib/supabase-browser';

// v0.7.0 — Admin Pretest / Posttest / Evaluasi (Super Admin).

const META={
  pretest:{label:'Pretest',intro:'Satu kali pengerjaan per peserta. Skor dihitung otomatis dari soal Benar/Salah; esai dan pertanyaan survei tidak dinilai.'},
  posttest:{label:'Posttest',intro:'Boleh diulang selama jadwal terbuka (atau sampai batas attempt). Semua attempt disimpan, nilai terbaik yang dipakai.'},
  evaluation:{label:'Evaluasi',intro:'Kuesioner kepuasan diisi untuk setiap pemateri. Satu kali pengiriman per peserta.'}
};
const TYPE_LABEL={single_choice:'Pilihan',likert:'Skala',text:'Isian'};

function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
function localValue(v){
  if(!v)return '';
  try{
    const p=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jakarta',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(new Date(v));
    const g=t=>p.find(x=>x.type===t)?.value||'';
    return `${g('year')}-${g('month')}-${g('day')}T${g('hour')}:${g('minute')}`;
  }catch{return ''}
}

const blankQuestion=()=>({question_type:'single_choice',section:'',question_text:'',required:true,points:1,correct_index:0,options:['Benar','Salah'],scale_min:1,scale_max:5,scale_min_label:'',scale_max_label:''});

function fromQuestion(q){
  return {
    question_type:q.question_type,section:q.section||'',question_text:q.question_text,required:q.required!==false,
    points:Number(q.points||0)||1,
    correct_index:(q.options||[]).findIndex(o=>o.is_correct),
    options:(q.options||[]).map(o=>o.option_text),
    scale_min:q.scale_min??1,scale_max:q.scale_max??5,scale_min_label:q.scale_min_label||'',scale_max_label:q.scale_max_label||''
  };
}

function toPayload(v){
  const base={question_type:v.question_type,section:v.section,question_text:v.question_text,required:!!v.required};
  if(v.question_type==='single_choice')return {...base,points:Number(v.correct_index)>=0?Number(v.points||1):0,options:v.options.map((text,i)=>({text,is_correct:i===Number(v.correct_index)}))};
  if(v.question_type==='likert')return {...base,scale_min:Number(v.scale_min),scale_max:Number(v.scale_max),scale_min_label:v.scale_min_label,scale_max_label:v.scale_max_label};
  return base;
}

export default function AssessmentAdmin({kind='pretest'}){
  const meta=META[kind]||META.pretest;
  const base=`/api/admin/${kind}`;
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [q,setQ]=useState(''),[editing,setEditing]=useState(null),[showAdd,setShowAdd]=useState(false);

  async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function api(url,opts={}){
    const t=await token();
    const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`,...(opts.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.message||'Request gagal');
    return j;
  }
  async function load(){try{setLoading(true);setError('');setData(await api(base))}catch(e){setError(e.message)}finally{setLoading(false)}}
  useEffect(()=>{setData(null);setEditing(null);setShowAdd(false);setNotice('');load()},[kind]);

  async function run(fn,success){
    try{setBusy(true);setError('');setNotice('');await fn();if(success)setNotice(success);await load()}
    catch(e){setError(e.message)}
    finally{setBusy(false)}
  }
  const post=body=>api(base,{method:'POST',body:JSON.stringify(body)});

  const results=useMemo(()=>{
    const s=q.trim().toLowerCase();
    return (data?.results||[]).filter(x=>!s||[x.full_name,x.registration_code,x.email].some(v=>String(v||'').toLowerCase().includes(s)));
  },[data,q]);

  function saveConfig(e){
    e.preventDefault();
    const fd=new FormData(e.currentTarget);
    const body={title:fd.get('title'),description:fd.get('description'),active:fd.get('active')==='on',open_at:fd.get('open_at'),close_at:fd.get('close_at'),show_score:fd.get('show_score')==='on',requires_day_number:fd.get('requires_day_number')};
    if(kind==='posttest'){body.max_attempts=fd.get('max_attempts');body.pass_percent=fd.get('pass_percent')}
    run(()=>api(base,{method:'PATCH',body:JSON.stringify(body)}),`Pengaturan ${meta.label} disimpan.`);
  }
  function loadBank(){
    const extra=kind==='evaluation'?' dan daftar pemateri':'';
    if(!confirm(`Muat bank soal standar APTFI untuk ${meta.label}? Semua soal${extra} yang ada sekarang akan diganti.`))return;
    run(()=>post({action:'load_standard_bank'}),'Bank soal standar dimuat.');
  }
  function resetTests(){if(!confirm(`Reset semua hasil ${meta.label} akun TEST?`))return;run(()=>post({action:'reset_test_attempts'}),'Hasil akun TEST direset.')}
  function resetAttempt(row){
    const what=kind==='posttest'?'semua attempt':'hasil';
    if(!confirm(`Reset ${what} ${meta.label} ${row.full_name}? Peserta dapat mengerjakan ulang.`))return;
    run(()=>post({action:'reset_attempt',registrationId:row.id}),`Hasil ${meta.label} direset.`);
  }
  function createQuestion(v){run(async()=>{await post({action:'create_question',...toPayload(v)});setShowAdd(false)},'Soal ditambahkan.')}
  function updateQuestion(question,v){run(async()=>{await post({action:'update_question',questionId:question.id,...toPayload(v)});setEditing(null)},'Soal diperbarui.')}
  function deleteQuestion(question,index){if(!confirm(`Hapus soal nomor ${index+1}?`))return;run(()=>api(base,{method:'DELETE',body:JSON.stringify({questionId:question.id})}),'Soal dihapus.')}
  function saveTarget(target,v){run(()=>post({action:target?'update_target':'create_target',targetId:target?.id,...v}),target?'Pemateri diperbarui.':'Pemateri ditambahkan.')}
  function deleteTarget(target){if(!confirm(`Hapus pemateri ${target.name}?`))return;run(()=>post({action:'delete_target',targetId:target.id}),'Pemateri dihapus.')}

  async function exportFile(mode){
    try{
      setBusy(true);setError('');
      const x=await api(`${base}?export=${mode}`);
      const header=x.columns.map(c=>({value:c.header,fontWeight:'bold'}));
      const rows=x.rows.map(r=>r.map(v=>v===null||v===undefined?'':v));
      await writeExcelFile([header,...rows],{sheet:x.sheet,columns:x.columns.map(c=>({width:c.width||14}))}).toFile(x.filename);
    }catch(e){setError(`Export gagal: ${e.message}`)}
    finally{setBusy(false)}
  }
  async function exportSummary(){
    try{
      const likert=(data.questions||[]).filter(x=>x.question_type==='likert');
      const header=['Pemateri','Instansi',...likert.map((x,i)=>`P${i+1}. ${x.question_text}`),'Rata-rata','Responden'].map(value=>({value,fontWeight:'bold'}));
      const rows=(data.evaluationSummary||[]).map(s=>[s.name||'',s.affiliation||'',...s.perQuestion.map(p=>p.average??''),s.overall??'',s.respondents]);
      await writeExcelFile([header,...rows],{sheet:'Rekap',columns:[{width:36},{width:30},...likert.map(()=>({width:16})),{width:12},{width:12}]}).toFile('rekap-evaluasi-pemateri-preseptor-2026.xlsx');
    }catch(e){setError(`Export gagal: ${e.message}`)}
  }

  if(loading&&!data)return <section className="panel"><div className="participant-loading compact"><div className="spinner"/><p>Memuat {meta.label}...</p></div></section>;
  if(!data)return <div className="alert alert-error">{error||`Data ${meta.label} belum tersedia.`}</div>;

  const m=data.module,s=data.stats||{},locked=!!data.locked,isEval=kind==='evaluation',isPost=kind==='posttest';
  const likertQs=(data.questions||[]).filter(x=>x.question_type==='likert');

  return <div className="pretest-admin assessment-admin">
    {error&&<div className="alert alert-error">{error}</div>}
    {notice&&<div className="alert alert-success">{notice}</div>}

    <section className="panel pretest-hero">
      <div><div className="eyebrow brand-blue">Assessment Hari-H</div><h2>{meta.label}</h2><p>{meta.intro}</p>
        <p className="assessment-schedule">Jadwal: {m.open_at?`${fmt(m.open_at)} – ${fmt(m.close_at)} WIB`:'belum diatur'}{m.requires_day_number?` · wajib hadir Hari ${m.requires_day_number}`:''}{isPost?` · ${m.max_attempts?`maks ${m.max_attempts} attempt`:'attempt tanpa batas'}${m.pass_percent!==null&&m.pass_percent!==undefined?` · lulus ≥ ${Number(m.pass_percent)}`:''}`:''}</p>
      </div>
      <span className={`status ${m.active?'status-ok':'status-pending'}`}>{m.active?'Aktif':'Belum aktif'}</span>
    </section>

    <section className="stats dayh-stats">
      <div className="stat"><span>Eligible</span><strong>{s.eligible||0}</strong></div>
      <div className="stat"><span>Selesai</span><strong>{s.submitted||0}</strong></div>
      <div className="stat"><span>Belum</span><strong>{s.pending||0}</strong></div>
      {data.scored&&<div className="stat"><span>{isPost?'Rata-rata terbaik':'Rata-rata'}</span><strong>{s.averagePercent??0}%</strong></div>}
      {s.passed!==null&&s.passed!==undefined&&<div className="stat"><span>Lulus</span><strong>{s.passed}</strong></div>}
      {isPost&&<div className="stat"><span>Total attempt</span><strong>{s.totalAttempts||0}</strong></div>}
      <div className="stat"><span>Akun TEST</span><strong>{s.testSubmitted||0}/{s.testAccounts||0}</strong></div>
    </section>

    <section className="pretest-admin-grid">
      <form className="panel" onSubmit={saveConfig} key={`${m.updated_at||''}-${m.active}`}>
        <div className="panel-head"><div><h2>Pengaturan {meta.label}</h2><p>Waktu dalam WIB. Akun TEST bypass jadwal dan status aktif, tetapi tetap wajib memenuhi prasyarat presensi.</p></div></div>
        <div className="field"><label>Judul</label><input name="title" defaultValue={m.title} required/></div>
        <div className="field"><label>Deskripsi untuk peserta</label><textarea name="description" rows="3" defaultValue={m.description||''}/></div>
        <div className="grid grid-2">
          <div className="field"><label>Dibuka</label><input name="open_at" type="datetime-local" defaultValue={localValue(m.open_at)}/></div>
          <div className="field"><label>Ditutup</label><input name="close_at" type="datetime-local" defaultValue={localValue(m.close_at)}/></div>
        </div>
        <div className="field"><label>Prasyarat presensi</label><select name="requires_day_number" defaultValue={m.requires_day_number||''}><option value="">Tanpa prasyarat</option><option value="1">Harus hadir Hari 1</option><option value="2">Harus hadir Hari 2</option></select></div>
        {isPost&&<div className="grid grid-2">
          <div className="field"><label>Batas attempt</label><input name="max_attempts" type="number" min="1" step="1" defaultValue={m.max_attempts??''} placeholder="Kosong = tanpa batas"/></div>
          <div className="field"><label>Nilai lulus (%)</label><input name="pass_percent" type="number" min="0" max="100" step="1" defaultValue={m.pass_percent??''} placeholder="Contoh 80"/></div>
        </div>}
        {!isEval&&<label className="switch-line"><input type="checkbox" name="show_score" defaultChecked={m.show_score}/><span>Tampilkan skor ke peserta setelah submit</span></label>}
        <label className="switch-line"><input type="checkbox" name="active" defaultChecked={m.active}/><span>Aktifkan {meta.label} untuk peserta resmi</span></label>
        <button className="btn btn-brand-primary" disabled={busy}>Simpan pengaturan</button>
      </form>

      <div className="panel assessment-bank-panel">
        <div className="panel-head"><div><h2>Bank soal</h2><p>{data.questions.length} pertanyaan{isEval?` × ${(data.targets||[]).filter(t=>t.active).length} pemateri aktif`:''}.{locked?' Terkunci karena sudah ada hasil.':''}</p></div></div>
        {locked&&<div className="alert alert-warning">Bank soal{isEval?' dan daftar pemateri':''} terkunci karena sudah ada hasil (termasuk akun TEST). Reset hasil terlebih dahulu untuk mengubah struktur.{isEval?' Nama/instansi pemateri tetap bisa diperbarui.':''}</div>}
        <div className="assessment-bank-actions">
          {data.hasStandardBank&&<button type="button" className="btn btn-brand-primary" disabled={busy||locked} onClick={loadBank}>Muat bank soal standar APTFI</button>}
          {s.testSubmitted>0&&<button type="button" className="btn btn-secondary" disabled={busy} onClick={resetTests}>Reset hasil TEST</button>}
          <button type="button" className="btn btn-secondary" disabled={busy||locked} onClick={()=>setShowAdd(v=>!v)}>{showAdd?'Tutup form':'Tambah pertanyaan'}</button>
        </div>
        {showAdd&&<QuestionForm initial={blankQuestion()} busy={busy} submitLabel="Tambah pertanyaan" onSubmit={createQuestion} onCancel={()=>setShowAdd(false)}/>}
      </div>
    </section>

    <section className="panel">
      <div className="panel-head"><div><h2>Daftar pertanyaan</h2><p>Kunci jawaban hanya terlihat oleh Super Admin dan tidak dikirim ke peserta.</p></div></div>
      <div className="pretest-question-list">
        {!data.questions.length?<div className="empty-state compact"><h3>Belum ada pertanyaan</h3><p>Gunakan "Muat bank soal standar APTFI" atau tambah pertanyaan manual.</p></div>:
        data.questions.map((question,i)=>editing===question.id?
          <article key={question.id} className="pretest-question-editor"><div className="pretest-question-number">{i+1}</div><div className="pretest-question-body"><QuestionForm initial={fromQuestion(question)} busy={busy} submitLabel="Simpan" onSubmit={v=>updateQuestion(question,v)} onCancel={()=>setEditing(null)}/></div></article>:
          <QuestionRow key={question.id} question={question} index={i} locked={locked} busy={busy} onEdit={()=>setEditing(question.id)} onDelete={()=>deleteQuestion(question,i)}/>)}
      </div>
    </section>

    {isEval&&<TargetsPanel targets={data.targets||[]} locked={locked} busy={busy} onSave={saveTarget} onDelete={deleteTarget}/>}

    {isEval&&<section className="panel">
      <div className="panel-head"><div><h2>Rekap per pemateri</h2><p>Rata-rata skala 1–5 dari peserta resmi (akun TEST tidak dihitung).</p></div><button className="btn btn-secondary btn-small" onClick={exportSummary} disabled={busy}>Export rekap</button></div>
      <div className="dayh-table-wrap"><table className="dayh-table"><thead><tr><th>Pemateri</th>{likertQs.map((x,i)=><th key={x.id} title={x.question_text}>P{i+1}</th>)}<th>Rata-rata</th><th>Responden</th><th>Saran</th></tr></thead>
        <tbody>{(data.evaluationSummary||[]).map(row=><tr key={row.target_id}><td><strong>{row.name}</strong><small>{row.affiliation||''}</small></td>{row.perQuestion.map(p=><td key={p.question_id}>{p.average??'—'}</td>)}<td><strong>{row.overall??'—'}</strong></td><td>{row.respondents}</td><td>{row.comments}</td></tr>)}</tbody></table></div>
      {likertQs.length>0&&<ol className="assessment-legend">{likertQs.map((x,i)=><li key={x.id}><b>P{i+1}</b> {x.question_text}</li>)}</ol>}
    </section>}

    <section className="panel">
      <div className="panel-head"><div><h2>Hasil peserta</h2><p>Akun TEST ditandai dan tidak ikut export maupun statistik resmi.{isPost?' Nilai yang ditampilkan adalah nilai terbaik.':''}</p></div>
        <div className="assessment-export-actions">
          <button className="btn btn-secondary btn-small" onClick={()=>exportFile('results')} disabled={busy}>{isEval?'Export jawaban':'Export Excel'}</button>
          {isPost&&<button className="btn btn-secondary btn-small" onClick={()=>exportFile('attempts')} disabled={busy}>Export semua attempt</button>}
        </div>
      </div>
      <div className="search-box dayh-search"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari peserta..."/></div>
      <div className="dayh-table-wrap"><table className="dayh-table">
        <thead><tr><th>Peserta</th><th>Mode</th><th>Status</th>{data.scored&&<th>{isPost?'Nilai terbaik':'Nilai'}</th>}{isPost&&<th>Attempt</th>}<th>{isPost?'Terakhir':'Dikirim'}</th><th>Aksi</th></tr></thead>
        <tbody>{results.map(r=><tr key={r.id}>
          <td><strong>{r.full_name} {r.test&&<span className="status status-info">TEST</span>}</strong><small>{r.registration_code}</small></td>
          <td>{r.attendance_mode}</td>
          <td>{r.attemptsCount?(r.passed===true?<span className="status status-ok">Lulus</span>:r.passed===false?<span className="status status-bad">Belum lulus</span>:<span className="status status-ok">Selesai</span>):<span className="status status-pending">Belum</span>}</td>
          {data.scored&&<td>{r.best?`${r.best.score} / ${r.best.max_score} · ${r.best.percent??0}%`:'—'}</td>}
          {isPost&&<td>{r.attemptsCount||0}</td>}
          <td>{r.latest?fmt(r.latest.submitted_at):'—'}</td>
          <td>{r.attemptsCount?<button className="link-button danger-link" onClick={()=>resetAttempt(r)} disabled={busy}>Reset</button>:'—'}</td>
        </tr>)}</tbody>
      </table></div>
    </section>
  </div>;
}

function QuestionRow({question,index,locked,busy,onEdit,onDelete}){
  const key=(question.options||[]).find(o=>o.is_correct);
  const scored=question.question_type==='single_choice'&&key&&Number(question.points||0)>0;
  return <article className="pretest-question-editor assessment-question-row">
    <div className="pretest-question-number">{index+1}</div>
    <div className="pretest-question-body">
      <div className="assessment-question-meta">
        <span className="status status-info">{TYPE_LABEL[question.question_type]||question.question_type}</span>
        {question.section&&<span className="assessment-section-chip">{question.section}</span>}
        {!question.required&&<span className="assessment-section-chip">Opsional</span>}
        {question.question_type==='single_choice'&&!key&&<span className="assessment-section-chip">Survei · tidak dinilai</span>}
        {scored&&<span className="assessment-section-chip">Bobot {Number(question.points)}</span>}
      </div>
      <p className="assessment-question-text">{question.question_text}</p>
      {question.question_type==='single_choice'&&<div className="assessment-option-chips">{question.options.map(o=><span key={o.id} className={o.is_correct?'correct':''}>{o.is_correct?'✓ ':''}{o.option_text}</span>)}</div>}
      {question.question_type==='likert'&&<small className="muted">Skala {question.scale_min}–{question.scale_max}: {question.scale_min_label||'—'} … {question.scale_max_label||'—'}</small>}
      {!locked&&<div className="pretest-question-actions"><button className="btn btn-secondary btn-small" type="button" disabled={busy} onClick={onEdit}>Edit</button><button className="btn btn-danger btn-small" type="button" disabled={busy} onClick={onDelete}>Hapus</button></div>}
    </div>
  </article>;
}

function QuestionForm({initial,busy,submitLabel,onSubmit,onCancel}){
  const [v,setV]=useState(initial);
  const set=patch=>setV(x=>({...x,...patch}));
  function submit(e){e.preventDefault();onSubmit(v)}
  return <form className="assessment-question-form" onSubmit={submit}>
    <div className="grid grid-2">
      <div className="field"><label>Tipe</label><select value={v.question_type} onChange={e=>set({question_type:e.target.value})}><option value="single_choice">Pilihan (Benar/Salah, pilihan ganda, survei)</option><option value="likert">Skala (misal 1–5)</option><option value="text">Isian / esai</option></select></div>
      <div className="field"><label>Kelompok (opsional)</label><input value={v.section} onChange={e=>set({section:e.target.value})} placeholder="Contoh: Benar atau Salah"/></div>
    </div>
    <div className="field"><label>Pertanyaan</label><textarea rows="3" value={v.question_text} onChange={e=>set({question_text:e.target.value})} required/></div>
    <label className="switch-line"><input type="checkbox" checked={v.required} onChange={e=>set({required:e.target.checked})}/><span>Wajib dijawab</span></label>
    {v.question_type==='single_choice'&&<>
      <div className="pretest-option-editor">
        {v.options.map((o,i)=><label key={i}>
          <input type="radio" name="assessment-correct" checked={Number(v.correct_index)===i} onChange={()=>set({correct_index:i})} title="Tandai sebagai jawaban benar"/>
          <span className="assessment-option-input"><input value={o} onChange={e=>setV(x=>{const options=[...x.options];options[i]=e.target.value;return {...x,options}})} placeholder={`Pilihan ${i+1}`} required={i<2}/>{v.options.length>2&&<button type="button" className="link-button danger-link" onClick={()=>setV(x=>({...x,options:x.options.filter((_,j)=>j!==i),correct_index:Number(x.correct_index)===i?-1:Number(x.correct_index)>i?Number(x.correct_index)-1:x.correct_index}))}>Hapus</button>}</span>
        </label>)}
        <label><input type="radio" name="assessment-correct" checked={Number(v.correct_index)<0} onChange={()=>set({correct_index:-1})}/><span>Tanpa kunci — pertanyaan survei, tidak dinilai</span></label>
      </div>
      <div className="assessment-form-row">
        {v.options.length<6&&<button type="button" className="btn btn-secondary btn-small" onClick={()=>set({options:[...v.options,'']})}>+ Pilihan</button>}
        {Number(v.correct_index)>=0&&<div className="field compact-field"><label>Bobot</label><input type="number" min="0" step="0.5" value={v.points} onChange={e=>set({points:e.target.value})}/></div>}
      </div>
    </>}
    {v.question_type==='likert'&&<div className="grid grid-2">
      <div className="field"><label>Nilai terendah</label><input type="number" min="0" max="9" value={v.scale_min} onChange={e=>set({scale_min:e.target.value})}/></div>
      <div className="field"><label>Nilai tertinggi</label><input type="number" min="1" max="10" value={v.scale_max} onChange={e=>set({scale_max:e.target.value})}/></div>
      <div className="field"><label>Label terendah</label><input value={v.scale_min_label} onChange={e=>set({scale_min_label:e.target.value})} placeholder="Sangat kurang"/></div>
      <div className="field"><label>Label tertinggi</label><input value={v.scale_max_label} onChange={e=>set({scale_max_label:e.target.value})} placeholder="Sangat baik"/></div>
    </div>}
    <div className="assessment-form-row"><button className="btn btn-brand-primary" disabled={busy}>{submitLabel}</button>{onCancel&&<button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Batal</button>}</div>
  </form>;
}

function TargetsPanel({targets,locked,busy,onSave,onDelete}){
  const [draft,setDraft]=useState({name:'',affiliation:'',topic:''});
  return <section className="panel">
    <div className="panel-head"><div><h2>Pemateri</h2><p>Peserta mengisi kuesioner untuk setiap pemateri aktif, sesuai urutan di bawah.</p></div></div>
    <div className="assessment-target-list">
      {!targets.length&&<div className="empty-state compact"><h3>Belum ada pemateri</h3><p>Gunakan "Muat bank soal standar APTFI" atau tambah manual.</p></div>}
      {targets.map((t,i)=><TargetRow key={t.id} target={t} index={i} locked={locked} busy={busy} onSave={onSave} onDelete={onDelete}/>)}
    </div>
    {!locked&&<form className="assessment-target-form" onSubmit={e=>{e.preventDefault();onSave(null,draft);setDraft({name:'',affiliation:'',topic:''})}}>
      <h3>Tambah pemateri</h3>
      <div className="grid grid-2">
        <div className="field"><label>Nama & gelar</label><input value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} required/></div>
        <div className="field"><label>Instansi</label><input value={draft.affiliation} onChange={e=>setDraft(v=>({...v,affiliation:e.target.value}))}/></div>
      </div>
      <div className="field"><label>Topik</label><input value={draft.topic} onChange={e=>setDraft(v=>({...v,topic:e.target.value}))}/></div>
      <button className="btn btn-secondary" disabled={busy}>Tambah pemateri</button>
    </form>}
  </section>;
}

function TargetRow({target,index,locked,busy,onSave,onDelete}){
  const [edit,setEdit]=useState(false);
  const [v,setV]=useState({name:target.name,affiliation:target.affiliation||'',topic:target.topic||'',active:target.active});
  useEffect(()=>{setV({name:target.name,affiliation:target.affiliation||'',topic:target.topic||'',active:target.active})},[target]);
  if(!edit)return <article className={`assessment-target ${target.active?'':'inactive'}`}>
    <div className="pretest-question-number">{index+1}</div>
    <div><strong>{target.name}</strong>{!target.active&&<span className="status status-pending">Nonaktif</span>}<small>{target.affiliation||''}</small>{target.topic&&<p>{target.topic}</p>}</div>
    <div className="pretest-question-actions"><button className="btn btn-secondary btn-small" disabled={busy} onClick={()=>setEdit(true)}>Edit</button>{!locked&&<button className="btn btn-danger btn-small" disabled={busy} onClick={()=>onDelete(target)}>Hapus</button>}</div>
  </article>;
  return <form className="assessment-target-form" onSubmit={e=>{e.preventDefault();onSave(target,v);setEdit(false)}}>
    <div className="grid grid-2">
      <div className="field"><label>Nama & gelar</label><input value={v.name} onChange={e=>setV(x=>({...x,name:e.target.value}))} required/></div>
      <div className="field"><label>Instansi</label><input value={v.affiliation} onChange={e=>setV(x=>({...x,affiliation:e.target.value}))}/></div>
    </div>
    <div className="field"><label>Topik</label><input value={v.topic} onChange={e=>setV(x=>({...x,topic:e.target.value}))}/></div>
    <label className="switch-line"><input type="checkbox" checked={v.active} onChange={e=>setV(x=>({...x,active:e.target.checked}))}/><span>Aktif (ditampilkan ke peserta)</span></label>
    <div className="assessment-form-row"><button className="btn btn-brand-primary" disabled={busy}>Simpan</button><button type="button" className="btn btn-secondary" onClick={()=>setEdit(false)}>Batal</button></div>
  </form>;
}
