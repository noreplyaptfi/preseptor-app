'use client';
import { useEffect,useMemo,useState } from 'react';
import writeExcelFile from 'write-excel-file/browser';
import { getSupabaseBrowser } from '../lib/supabase-browser';
import { confirmDialog } from '../lib/ui-feedback';
import FeedbackBridge from './FeedbackBridge';

// v0.7.1 — Admin Pretest / Posttest / Evaluasi (Super Admin), tampilan bertab.

const META={
  pretest:{label:'Pretest',intro:'Satu kali pengerjaan per peserta. Nilai dihitung otomatis dari soal Benar/Salah; esai dan survei tidak dinilai.'},
  posttest:{label:'Posttest',intro:'Boleh diulang selama jadwal terbuka. Semua attempt disimpan, nilai terbaik yang dipakai.'},
  evaluation:{label:'Evaluasi',intro:'Kuesioner kepuasan untuk setiap pemateri. Satu kali pengiriman per peserta.'}
};
const TYPE_LABEL={single_choice:'Pilihan',likert:'Skala',text:'Isian'};

function fmt(v){if(!v)return '—';try{return new Intl.DateTimeFormat('id-ID',{dateStyle:'medium',timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
function fmtTime(v){if(!v)return '';try{return new Intl.DateTimeFormat('id-ID',{timeStyle:'short',timeZone:'Asia/Jakarta'}).format(new Date(v))}catch{return v}}
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

function scheduleText(m){
  if(!m?.open_at)return 'Belum diatur';
  const sameDay=new Date(m.open_at).toDateString()===new Date(m.close_at).toDateString();
  return sameDay?`${fmt(m.open_at)} – ${fmtTime(m.close_at)} WIB`:`${fmt(m.open_at)} – ${fmt(m.close_at)} WIB`;
}

export default function AssessmentAdmin({kind='pretest'}){
  const meta=META[kind]||META.pretest;
  const base=`/api/admin/${kind}`;
  const [data,setData]=useState(null),[loading,setLoading]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[busy,setBusy]=useState(false);
  const [q,setQ]=useState(''),[editing,setEditing]=useState(null),[showAdd,setShowAdd]=useState(false),[tab,setTab]=useState('results');

  async function token(){const {data}=await getSupabaseBrowser().auth.getSession();return data.session?.access_token||''}
  async function api(url,opts={}){
    const t=await token();
    const r=await fetch(url,{...opts,headers:{...(opts.headers||{}),Authorization:`Bearer ${t}`,...(opts.body?{'Content-Type':'application/json'}:{})},cache:'no-store'});
    const j=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(j.message||'Request gagal');
    return j;
  }
  async function load(first=false){
    try{
      setLoading(true);setError('');
      const j=await api(base);
      setData(j);
      if(first&&!(j.questions||[]).length)setTab('questions');
    }catch(e){setError(e.message)}
    finally{setLoading(false)}
  }
  useEffect(()=>{setData(null);setEditing(null);setShowAdd(false);setNotice('');setTab('results');load(true)},[kind]);

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
    const body={title:fd.get('title'),description:fd.get('description'),active:fd.get('active')==='on',open_at:fd.get('open_at'),close_at:fd.get('close_at'),show_score:kind==='evaluation'?false:fd.get('show_score')==='on',requires_day_number:fd.get('requires_day_number')};
    if(kind==='posttest'){body.max_attempts=fd.get('max_attempts');body.pass_percent=fd.get('pass_percent')}
    run(()=>api(base,{method:'PATCH',body:JSON.stringify(body)}),`Pengaturan ${meta.label} disimpan.`);
  }
  async function loadBank(){
    const extra=kind==='evaluation'?' dan daftar pemateri':'';
    if(!await confirmDialog({title:'Muat bank soal standar?',description:`Semua soal${extra} ${meta.label} yang ada sekarang akan diganti dengan bank soal standar APTFI.`,confirmLabel:'Ya, muat bank soal'}))return;
    run(()=>post({action:'load_standard_bank'}),'Bank soal standar dimuat.');
  }
  async function resetTests(){if(!await confirmDialog({title:'Reset hasil akun TEST?',description:`Semua hasil ${meta.label} dari akun TEST akan dihapus. Hasil peserta resmi tidak terpengaruh.`,confirmLabel:'Ya, reset',tone:'danger'}))return;run(()=>post({action:'reset_test_attempts'}),'Hasil akun TEST direset.')}
  async function resetAttempt(row){
    const what=kind==='posttest'?'semua attempt':'hasil';
    if(!await confirmDialog({title:`Reset ${meta.label} peserta?`,description:`${row.full_name}: ${what} ${meta.label} akan dihapus dan peserta dapat mengerjakan ulang.`,confirmLabel:'Ya, reset',tone:'danger'}))return;
    run(()=>post({action:'reset_attempt',registrationId:row.id}),`Hasil ${meta.label} direset.`);
  }
  function createQuestion(v){run(async()=>{await post({action:'create_question',...toPayload(v)});setShowAdd(false)},'Soal ditambahkan.')}
  function updateQuestion(question,v){run(async()=>{await post({action:'update_question',questionId:question.id,...toPayload(v)});setEditing(null)},'Soal diperbarui.')}
  async function deleteQuestion(question,index){if(!await confirmDialog({title:`Hapus soal nomor ${index+1}?`,description:question.question_text,confirmLabel:'Hapus soal',tone:'danger'}))return;run(()=>api(base,{method:'DELETE',body:JSON.stringify({questionId:question.id})}),'Soal dihapus.')}
  function saveTarget(target,v){run(()=>post({action:target?'update_target':'create_target',targetId:target?.id,...v}),target?'Pemateri diperbarui.':'Pemateri ditambahkan.')}
  async function deleteTarget(target){if(!await confirmDialog({title:'Hapus pemateri?',description:target.name,confirmLabel:'Hapus pemateri',tone:'danger'}))return;run(()=>post({action:'delete_target',targetId:target.id}),'Pemateri dihapus.')}

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
  const activeTargets=(data.targets||[]).filter(t=>t.active).length;
  const tabs=[['results',isEval?'Rekap & Hasil':'Hasil'],['questions',isEval?'Soal & Pemateri':'Soal'],['settings','Pengaturan']];

  return <div className="asm">
    <FeedbackBridge notice={notice} error={error} onNotice={()=>setNotice('')}/>

    <section className={`panel asm-status ${m.active?'on':''}`}>
      <div className="asm-status-main">
        <span className="asm-dot" aria-hidden="true"/>
        <div><strong>{m.active?`${meta.label} aktif untuk peserta resmi`:`${meta.label} belum aktif`}</strong><p>{meta.intro}</p></div>
        <button type="button" className="btn btn-secondary btn-small" onClick={()=>setTab('settings')}>Ubah</button>
      </div>
      <dl className="asm-facts">
        <div><dt>Jadwal</dt><dd>{scheduleText(m)}</dd></div>
        <div><dt>Prasyarat</dt><dd>{m.requires_day_number?`Hadir Hari ${m.requires_day_number}`:'Tanpa prasyarat'}</dd></div>
        <div><dt>{isEval?'Kuesioner':'Soal'}</dt><dd>{data.questions.length} pertanyaan{isEval?` × ${activeTargets} pemateri`:''}</dd></div>
        {isPost&&<div><dt>Attempt</dt><dd>{m.max_attempts?`Maks ${m.max_attempts}`:'Tanpa batas'}</dd></div>}
        {isPost&&<div><dt>Lulus</dt><dd>{m.pass_percent!==null&&m.pass_percent!==undefined?`≥ ${Number(m.pass_percent)}`:'—'}</dd></div>}
      </dl>
    </section>

    <section className="asm-stats">
      <div><span>Eligible</span><strong>{s.eligible||0}</strong></div>
      <div><span>Selesai</span><strong>{s.submitted||0}</strong></div>
      <div><span>Belum</span><strong>{s.pending||0}</strong></div>
      {data.scored&&<div><span>{isPost?'Rata-rata terbaik':'Rata-rata'}</span><strong>{s.averagePercent??0}</strong></div>}
      {s.passed!==null&&s.passed!==undefined&&<div><span>Lulus</span><strong>{s.passed}</strong></div>}
      {isPost&&<div><span>Total attempt</span><strong>{s.totalAttempts||0}</strong></div>}
      <div className="muted-stat"><span>Akun TEST</span><strong>{s.testSubmitted||0}/{s.testAccounts||0}</strong></div>
    </section>

    <nav className="asm-tabs" role="tablist">{tabs.map(([id,text])=><button key={id} type="button" role="tab" aria-selected={tab===id} className={tab===id?'active':''} onClick={()=>setTab(id)}>{text}</button>)}</nav>

    {tab==='results'&&<>
      {isEval&&<section className="panel">
        <div className="asm-toolbar"><div><h2>Rekap per pemateri</h2><p>Rata-rata skala 1–5 dari peserta resmi (akun TEST tidak dihitung).</p></div><div className="asm-toolbar-actions"><button className="btn btn-secondary btn-small" onClick={exportSummary} disabled={busy}>Export rekap</button></div></div>
        <div className="asm-table-wrap"><table className="asm-table">
          <thead><tr><th>Pemateri</th>{likertQs.map((x,i)=><th key={x.id} title={x.question_text} className="num">P{i+1}</th>)}<th className="num">Rata-rata</th><th className="num">Responden</th><th className="num">Saran</th></tr></thead>
          <tbody>{(data.evaluationSummary||[]).map(row=><tr key={row.target_id}><td><strong>{row.name}</strong><small>{row.affiliation||''}</small></td>{row.perQuestion.map(p=><td key={p.question_id} className="num">{p.average??'—'}</td>)}<td className="num"><span className="asm-avg">{row.overall??'—'}</span></td><td className="num">{row.respondents}</td><td className="num">{row.comments}</td></tr>)}</tbody>
        </table></div>
        {likertQs.length>0&&<ol className="asm-legend">{likertQs.map((x,i)=><li key={x.id}><b>P{i+1}</b> {x.question_text}</li>)}</ol>}
      </section>}

      <section className="panel">
        <div className="asm-toolbar">
          <div><h2>Hasil peserta</h2><p>Akun TEST ditandai dan tidak ikut statistik maupun export.{isPost?' Nilai yang ditampilkan adalah nilai terbaik.':''}</p></div>
          <div className="asm-toolbar-actions">
            {s.testSubmitted>0&&<button className="btn btn-secondary btn-small" onClick={resetTests} disabled={busy}>Reset hasil TEST</button>}
            <button className="btn btn-secondary btn-small" onClick={()=>exportFile('results')} disabled={busy}>{isEval?'Export jawaban':'Export Excel'}</button>
            {isPost&&<button className="btn btn-secondary btn-small" onClick={()=>exportFile('attempts')} disabled={busy}>Export semua attempt</button>}
          </div>
        </div>
        <div className="search-box asm-search-box"><span>⌕</span><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Cari nama, nomor pendaftaran, atau email..."/></div>
        <div className="asm-table-wrap"><table className="asm-table">
          <thead><tr><th>Peserta</th><th>Mode</th><th>Status</th>{data.scored&&<th className="num">{isPost?'Terbaik':'Nilai'}</th>}{isPost&&<th className="num">Attempt</th>}<th>{isPost?'Terakhir':'Dikirim'}</th><th/></tr></thead>
          <tbody>
            {!results.length&&<tr><td colSpan={7} className="asm-empty">Belum ada peserta eligible{q?' yang cocok dengan pencarian':''}.</td></tr>}
            {results.map(r=><tr key={r.id}>
              <td><strong>{r.full_name} {r.test&&<span className="status status-info">TEST</span>}</strong><small>{r.registration_code}</small></td>
              <td>{r.attendance_mode}</td>
              <td>{r.attemptsCount?(r.passed===true?<span className="status status-ok">Lulus</span>:r.passed===false?<span className="status status-bad">Belum lulus</span>:<span className="status status-ok">Selesai</span>):<span className="status status-pending">Belum</span>}</td>
              {data.scored&&<td className="num">{r.best?<><strong>{r.best.percent??0}</strong><small>{r.best.score}/{r.best.max_score}</small></>:'—'}</td>}
              {isPost&&<td className="num">{r.attemptsCount||0}</td>}
              <td>{r.latest?fmt(r.latest.submitted_at):'—'}</td>
              <td className="asm-row-action">{r.attemptsCount?<button className="link-button danger-link" onClick={()=>resetAttempt(r)} disabled={busy}>Reset</button>:null}</td>
            </tr>)}
          </tbody>
        </table></div>
      </section>
    </>}

    {tab==='questions'&&<>
      <section className="panel">
        <div className="asm-toolbar">
          <div><h2>Bank soal</h2><p>{data.questions.length} pertanyaan. Kunci jawaban hanya terlihat oleh Super Admin.</p></div>
          <div className="asm-toolbar-actions">
            {data.hasStandardBank&&<button type="button" className="btn btn-brand-primary btn-small" disabled={busy||locked} onClick={loadBank}>Muat bank soal standar APTFI</button>}
            <button type="button" className="btn btn-secondary btn-small" disabled={busy||locked} onClick={()=>{setEditing(null);setShowAdd(v=>!v)}}>{showAdd?'Tutup form':'+ Tambah pertanyaan'}</button>
          </div>
        </div>
        {locked&&<div className="alert alert-warning asm-lock">🔒 Bank soal{isEval?' dan daftar pemateri':''} terkunci karena sudah ada hasil (termasuk akun TEST). Reset hasil di tab <b>Hasil</b> untuk mengubah struktur.{isEval?' Nama/instansi pemateri tetap bisa dikoreksi.':''}</div>}
        {showAdd&&<QuestionForm initial={blankQuestion()} busy={busy} title="Pertanyaan baru" submitLabel="Tambah pertanyaan" onSubmit={createQuestion} onCancel={()=>setShowAdd(false)}/>}
        <div className="asm-qlist">
          {!data.questions.length&&<div className="asm-empty-box"><strong>Belum ada pertanyaan</strong><p>Klik <b>Muat bank soal standar APTFI</b> untuk mengisi soal dari dokumen resmi, atau tambah manual.</p></div>}
          {data.questions.map((question,i)=>{
            const showSection=question.section&&question.section!==data.questions[i-1]?.section;
            return <div key={question.id}>
              {showSection&&<h3 className="asm-section">{question.section}</h3>}
              {editing===question.id?<QuestionForm initial={fromQuestion(question)} busy={busy} title={`Edit pertanyaan ${i+1}`} submitLabel="Simpan perubahan" onSubmit={v=>updateQuestion(question,v)} onCancel={()=>setEditing(null)}/>:
              <QuestionRow question={question} index={i} locked={locked} busy={busy} onEdit={()=>{setShowAdd(false);setEditing(question.id)}} onDelete={()=>deleteQuestion(question,i)}/>}
            </div>;
          })}
        </div>
      </section>
      {isEval&&<TargetsPanel targets={data.targets||[]} locked={locked} busy={busy} onSave={saveTarget} onDelete={deleteTarget}/>}
    </>}

    {tab==='settings'&&<form className="panel asm-settings" onSubmit={saveConfig} key={`${m.updated_at||''}-${m.active}`}>
      <div className="asm-toolbar"><div><h2>Pengaturan {meta.label}</h2><p>Waktu dalam WIB. Akun TEST melewati jadwal dan status aktif, tetapi tetap wajib memenuhi prasyarat presensi.</p></div></div>
      <div className="asm-settings-grid">
        <div className="asm-settings-col">
          <div className="field"><label>Judul</label><input name="title" defaultValue={m.title} required/></div>
          <div className="field"><label>Deskripsi untuk peserta</label><textarea name="description" rows="4" defaultValue={m.description||''}/></div>
        </div>
        <div className="asm-settings-col">
          <div className="asm-two">
            <div className="field"><label>Dibuka</label><input name="open_at" type="datetime-local" defaultValue={localValue(m.open_at)}/></div>
            <div className="field"><label>Ditutup</label><input name="close_at" type="datetime-local" defaultValue={localValue(m.close_at)}/></div>
          </div>
          <div className="field"><label>Prasyarat presensi</label><select name="requires_day_number" defaultValue={m.requires_day_number||''}><option value="">Tanpa prasyarat</option><option value="1">Harus hadir Hari 1</option><option value="2">Harus hadir Hari 2</option></select></div>
          {isPost&&<div className="asm-two">
            <div className="field"><label>Batas attempt</label><input name="max_attempts" type="number" min="1" step="1" defaultValue={m.max_attempts??''} placeholder="Kosong = tanpa batas"/></div>
            <div className="field"><label>Nilai lulus</label><input name="pass_percent" type="number" min="0" max="100" step="1" defaultValue={m.pass_percent!==null&&m.pass_percent!==undefined?Number(m.pass_percent):''} placeholder="Contoh 80"/></div>
          </div>}
        </div>
      </div>
      <div className="asm-switches">
        {!isEval&&<label className="switch-line"><input type="checkbox" name="show_score" defaultChecked={m.show_score}/><span>Tampilkan nilai ke peserta setelah mengirim</span></label>}
        <label className="switch-line asm-activate"><input type="checkbox" name="active" defaultChecked={m.active}/><span>Aktifkan {meta.label} untuk peserta resmi</span></label>
      </div>
      <div className="asm-form-actions"><button className="btn btn-brand-primary" disabled={busy}>{busy?'Menyimpan...':'Simpan pengaturan'}</button></div>
    </form>}
  </div>;
}

function QuestionRow({question,index,locked,busy,onEdit,onDelete}){
  const key=(question.options||[]).find(o=>o.is_correct);
  const scored=question.question_type==='single_choice'&&key&&Number(question.points||0)>0;
  return <article className="asm-q">
    <span className="asm-q-num">{index+1}</span>
    <div className="asm-q-body">
      <p>{question.question_text}</p>
      <div className="asm-q-meta">
        <span className={`asm-chip type-${question.question_type}`}>{TYPE_LABEL[question.question_type]||question.question_type}</span>
        {question.question_type==='single_choice'&&question.options.map(o=><span key={o.id} className={`asm-chip opt ${o.is_correct?'correct':''}`}>{o.is_correct?'✓ ':''}{o.option_text}</span>)}
        {question.question_type==='single_choice'&&!key&&<span className="asm-chip soft">survei · tidak dinilai</span>}
        {scored&&Number(question.points)!==1&&<span className="asm-chip soft">bobot {Number(question.points)}</span>}
        {question.question_type==='likert'&&<span className="asm-chip soft">{question.scale_min}–{question.scale_max}: {question.scale_min_label||'—'} … {question.scale_max_label||'—'}</span>}
        {!question.required&&<span className="asm-chip soft">opsional</span>}
      </div>
    </div>
    {!locked&&<div className="asm-q-actions"><button className="link-button" type="button" disabled={busy} onClick={onEdit}>Edit</button><button className="link-button danger-link" type="button" disabled={busy} onClick={onDelete}>Hapus</button></div>}
  </article>;
}

function QuestionForm({initial,busy,title,submitLabel,onSubmit,onCancel}){
  const [v,setV]=useState(initial);
  const set=patch=>setV(x=>({...x,...patch}));
  function submit(e){e.preventDefault();onSubmit(v)}
  return <form className="asm-qform" onSubmit={submit}>
    {title&&<h3>{title}</h3>}
    <div className="asm-two">
      <div className="field"><label>Tipe</label><select value={v.question_type} onChange={e=>set({question_type:e.target.value})}><option value="single_choice">Pilihan (Benar/Salah, ganda, survei)</option><option value="likert">Skala (misal 1–5)</option><option value="text">Isian / esai</option></select></div>
      <div className="field"><label>Kelompok (opsional)</label><input value={v.section} onChange={e=>set({section:e.target.value})} placeholder="Contoh: Benar atau Salah"/></div>
    </div>
    <div className="field"><label>Pertanyaan</label><textarea rows="3" value={v.question_text} onChange={e=>set({question_text:e.target.value})} required/></div>
    {v.question_type==='single_choice'&&<div className="field">
      <label>Pilihan jawaban <small>(pilih lingkaran untuk menandai kunci)</small></label>
      <div className="asm-options">
        {v.options.map((o,i)=><div key={i} className={`asm-option ${Number(v.correct_index)===i?'correct':''}`}>
          <input type="radio" name="asm-correct" checked={Number(v.correct_index)===i} onChange={()=>set({correct_index:i})} aria-label="Jawaban benar"/>
          <input value={o} onChange={e=>setV(x=>{const options=[...x.options];options[i]=e.target.value;return {...x,options}})} placeholder={`Pilihan ${i+1}`} required={i<2}/>
          {v.options.length>2&&<button type="button" className="link-button danger-link" onClick={()=>setV(x=>({...x,options:x.options.filter((_,j)=>j!==i),correct_index:Number(x.correct_index)===i?-1:Number(x.correct_index)>i?Number(x.correct_index)-1:x.correct_index}))}>Hapus</button>}
        </div>)}
        <label className={`asm-option survey ${Number(v.correct_index)<0?'correct':''}`}><input type="radio" name="asm-correct" checked={Number(v.correct_index)<0} onChange={()=>set({correct_index:-1})}/><span>Tanpa kunci — survei, tidak dinilai</span></label>
      </div>
      <div className="asm-inline">
        {v.options.length<6&&<button type="button" className="btn btn-secondary btn-small" onClick={()=>set({options:[...v.options,'']})}>+ Pilihan</button>}
        {Number(v.correct_index)>=0&&<label className="asm-points">Bobot <input type="number" min="0" step="0.5" value={v.points} onChange={e=>set({points:e.target.value})}/></label>}
      </div>
    </div>}
    {v.question_type==='likert'&&<div className="asm-two">
      <div className="field"><label>Skala</label><div className="asm-inline"><input type="number" min="0" max="9" value={v.scale_min} onChange={e=>set({scale_min:e.target.value})}/><span>sampai</span><input type="number" min="1" max="10" value={v.scale_max} onChange={e=>set({scale_max:e.target.value})}/></div></div>
      <div className="field"><label>Label ujung</label><div className="asm-inline"><input value={v.scale_min_label} onChange={e=>set({scale_min_label:e.target.value})} placeholder="Sangat kurang"/><input value={v.scale_max_label} onChange={e=>set({scale_max_label:e.target.value})} placeholder="Sangat baik"/></div></div>
    </div>}
    <div className="asm-form-actions">
      <label className="asm-required"><input type="checkbox" checked={v.required} onChange={e=>set({required:e.target.checked})}/> Wajib dijawab</label>
      <span className="asm-spacer"/>
      {onCancel&&<button type="button" className="btn btn-secondary" onClick={onCancel} disabled={busy}>Batal</button>}
      <button className="btn btn-brand-primary" disabled={busy}>{submitLabel}</button>
    </div>
  </form>;
}

function TargetsPanel({targets,locked,busy,onSave,onDelete}){
  const [draft,setDraft]=useState({name:'',affiliation:'',topic:''}),[adding,setAdding]=useState(false);
  return <section className="panel">
    <div className="asm-toolbar"><div><h2>Pemateri</h2><p>Peserta mengisi kuesioner untuk setiap pemateri aktif, sesuai urutan.</p></div>
      {!locked&&<div className="asm-toolbar-actions"><button type="button" className="btn btn-secondary btn-small" onClick={()=>setAdding(v=>!v)} disabled={busy}>{adding?'Tutup form':'+ Tambah pemateri'}</button></div>}
    </div>
    {adding&&!locked&&<form className="asm-qform" onSubmit={e=>{e.preventDefault();onSave(null,draft);setDraft({name:'',affiliation:'',topic:''});setAdding(false)}}>
      <h3>Pemateri baru</h3>
      <div className="asm-two">
        <div className="field"><label>Nama & gelar</label><input value={draft.name} onChange={e=>setDraft(v=>({...v,name:e.target.value}))} required/></div>
        <div className="field"><label>Instansi</label><input value={draft.affiliation} onChange={e=>setDraft(v=>({...v,affiliation:e.target.value}))}/></div>
      </div>
      <div className="field"><label>Topik</label><input value={draft.topic} onChange={e=>setDraft(v=>({...v,topic:e.target.value}))}/></div>
      <div className="asm-form-actions"><span className="asm-spacer"/><button type="button" className="btn btn-secondary" onClick={()=>setAdding(false)}>Batal</button><button className="btn btn-brand-primary" disabled={busy}>Tambah pemateri</button></div>
    </form>}
    <div className="asm-targets">
      {!targets.length&&<div className="asm-empty-box"><strong>Belum ada pemateri</strong><p>Gunakan <b>Muat bank soal standar APTFI</b> atau tambah manual.</p></div>}
      {targets.map((t,i)=><TargetRow key={t.id} target={t} index={i} locked={locked} busy={busy} onSave={onSave} onDelete={onDelete}/>)}
    </div>
  </section>;
}

function TargetRow({target,index,locked,busy,onSave,onDelete}){
  const [edit,setEdit]=useState(false);
  const [v,setV]=useState({name:target.name,affiliation:target.affiliation||'',topic:target.topic||'',active:target.active});
  useEffect(()=>{setV({name:target.name,affiliation:target.affiliation||'',topic:target.topic||'',active:target.active})},[target]);
  if(!edit)return <article className={`asm-q asm-target ${target.active?'':'inactive'}`}>
    <span className="asm-q-num">{index+1}</span>
    <div className="asm-q-body"><p>{target.name} {!target.active&&<span className="status status-pending">Nonaktif</span>}</p><small>{target.affiliation||''}</small>{target.topic&&<small className="asm-topic">{target.topic}</small>}</div>
    <div className="asm-q-actions"><button className="link-button" disabled={busy} onClick={()=>setEdit(true)}>Edit</button>{!locked&&<button className="link-button danger-link" disabled={busy} onClick={()=>onDelete(target)}>Hapus</button>}</div>
  </article>;
  return <form className="asm-qform" onSubmit={e=>{e.preventDefault();onSave(target,v);setEdit(false)}}>
    <h3>Edit pemateri {index+1}</h3>
    <div className="asm-two">
      <div className="field"><label>Nama & gelar</label><input value={v.name} onChange={e=>setV(x=>({...x,name:e.target.value}))} required/></div>
      <div className="field"><label>Instansi</label><input value={v.affiliation} onChange={e=>setV(x=>({...x,affiliation:e.target.value}))}/></div>
    </div>
    <div className="field"><label>Topik</label><input value={v.topic} onChange={e=>setV(x=>({...x,topic:e.target.value}))}/></div>
    <div className="asm-form-actions">
      <label className="asm-required"><input type="checkbox" checked={v.active} onChange={e=>setV(x=>({...x,active:e.target.checked}))}/> Aktif (ditampilkan ke peserta)</label>
      <span className="asm-spacer"/>
      <button type="button" className="btn btn-secondary" onClick={()=>setEdit(false)}>Batal</button>
      <button className="btn btn-brand-primary" disabled={busy}>Simpan</button>
    </div>
  </form>;
}
