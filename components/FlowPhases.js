// v0.8.0 — Tampilan alur bertahap untuk panduan panitia & peserta.
export default function FlowPhases({phases,renderAction}){
  return <div className="flow-phases">{phases.map((p,pi)=><section key={p.id} className="flow-phase">
    <header className="flow-phase-head"><span className="flow-phase-index">{pi+1}</span><div><span className="flow-chip">{p.chip}</span><h3>{p.title}</h3>{p.lead&&<p>{p.lead}</p>}</div></header>
    <ol className="flow-steps">{p.steps.map((s,i)=><li key={i} className="flow-step">
      <span className="flow-num">{i+1}</span>
      <div className="flow-body">{s.time&&<span className="flow-time">{s.time}</span>}<h4>{s.title}</h4><p>{s.copy}</p></div>
      {renderAction&&<div className="flow-action">{renderAction(s)}</div>}
    </li>)}</ol>
  </section>)}</div>;
}
