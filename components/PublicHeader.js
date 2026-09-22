export default function PublicHeader({compact=false}){
  return <header className={`public-header ${compact?'compact':''}`}>
    <a className="public-brand" href="/" aria-label="APTFI Preseptor">
      <img src="/aptfi-logo.png" alt="Asosiasi Pendidikan Tinggi Farmasi Indonesia" />
    </a>
    <a className="btn btn-header-login" href="/login">Masuk</a>
  </header>
}
