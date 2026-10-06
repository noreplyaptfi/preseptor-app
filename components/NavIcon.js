// v0.7.3 — Ikon garis seragam untuk navigasi admin & peserta (SVG bawaan, tanpa library).

const P={
  home:<><path d="M3 11l9-8 9 8"/><path d="M5 10v10h14V10"/></>,
  users:<><circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c.8-3.6 3.4-5.5 6.5-5.5s5.7 1.9 6.5 5.5"/><path d="M16 4.6a3.5 3.5 0 0 1 0 6.8"/><path d="M18 14.6c1.8.7 3 2.5 3.5 5.4"/></>,
  user:<><circle cx="12" cy="8" r="4"/><path d="M4 21c1-4 4-6 8-6s7 2 8 6"/></>,
  inbox:<><path d="M4 5h16v11H8l-4 4z"/><path d="M8 9.5h8M8 12.5h5"/></>,
  star:<path d="M12 3l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.4 6.8 19.1l1-5.8L3.5 9.2l5.9-.9z"/>,
  wallet:<><rect x="3" y="6" width="18" height="13" rx="3"/><path d="M3 10h18"/><path d="M16 14.5h2"/></>,
  form:<><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 8h6M9 12h6M9 16h3"/></>,
  megaphone:<><path d="M4 10v4h3l8 4V6L7 10z"/><path d="M18 9.5a3.5 3.5 0 0 1 0 5"/></>,
  calendar:<><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4"/></>,
  'calendar-check':<><rect x="3" y="4.5" width="18" height="16.5" rx="3"/><path d="M3 9.5h18M8 2.5v4M16 2.5v4M8.5 14.5l2.5 2.5 4.5-4.5"/></>,
  qr:<><rect x="4" y="4" width="6" height="6" rx="1"/><rect x="14" y="4" width="6" height="6" rx="1"/><rect x="4" y="14" width="6" height="6" rx="1"/><path d="M14 14h2v2h-2zM18 18h2v2h-2zM18 14h2M14 18v2"/></>,
  play:<><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M10 9.5v5l4.5-2.5z"/></>,
  edit:<><path d="M4 20h4L19 9l-4-4L4 16z"/><path d="M13.5 6.5l4 4"/></>,
  check:<><path d="M9 11l3 3 8-8"/><path d="M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h9"/></>,
  database:<><ellipse cx="12" cy="6" rx="7" ry="3"/><path d="M5 6v6c0 1.7 3.1 3 7 3s7-1.3 7-3V6"/><path d="M5 12v6c0 1.7 3.1 3 7 3s7-1.3 7-3v-6"/></>,
  building:<><path d="M4 21V7l8-4 8 4v14"/><path d="M9 21v-5h6v5M9 10h.01M15 10h.01M9 13h.01M15 13h.01"/></>,
  flask:<><path d="M9 3h6M10 3v6l-5.5 9.5A2 2 0 0 0 6.2 21h11.6a2 2 0 0 0 1.7-2.5L14 9V3"/><path d="M7.5 15h9"/></>,
  shield:<><path d="M12 3l7 3v6c0 4.4-3 7.6-7 9-4-1.4-7-4.6-7-9V6z"/><path d="M9 12l2 2 4-4"/></>,
  book:<><path d="M5 4.5A1.5 1.5 0 0 1 6.5 3H19v16H6.5A1.5 1.5 0 0 0 5 20.5z"/><path d="M5 20.5A1.5 1.5 0 0 0 6.5 22H19"/></>,
  bell:<><path d="M6 9a6 6 0 0 1 12 0c0 6 2 7 2 7H4s2-1 2-7"/><path d="M10 20a2 2 0 0 0 4 0"/></>,
  logout:<><path d="M15 4h3a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-3"/><path d="M10 8l-4 4 4 4M6 12h10"/></>,
  menu:<path d="M4 7h16M4 12h16M4 17h16"/>,
  close:<path d="M6 6l12 12M18 6L6 18"/>,
  'chevron-down':<path d="M6 9l6 6 6-6"/>,
  'chevron-left':<path d="M15 6l-6 6 6 6"/>,
  'chevron-right':<path d="M9 6l6 6-6 6"/>,
  external:<><path d="M14 4h6v6M20 4l-9 9"/><path d="M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5"/></>,
  tests:<><rect x="5" y="3" width="14" height="18" rx="2.5"/><path d="M9 3.5v2h6v-2M8.5 11l1.5 1.5 3-3M8.5 16.5h7"/></>
};

export default function NavIcon({name,size=18,className=''}){
  return <svg className={`nav-svg ${className}`} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">{P[name]||P.home}</svg>;
}
