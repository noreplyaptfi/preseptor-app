// v0.7.3 — Lambang APTFI berwarna di lencana putih + teks yang terbaca.
export default function BrandMark({title='APTFI',subtitle='',compact=false,size='md'}){
  return <span className={`brand-lockup ${compact?'compact':''} size-${size}`}>
    <span className="brand-badge"><img src="/aptfi-mark.png" alt="APTFI"/></span>
    {!compact&&<span className="brand-text"><b>{title}</b>{subtitle&&<small>{subtitle}</small>}</span>}
  </span>;
}
