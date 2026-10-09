// v0.8.5 — Aturan NIK & peserta SKP (tanpa akses database; aman dipakai di server maupun browser).

// Hapus spasi, titik, dan tanda hubung yang sering ikut tersalin.
export function normalizeNik(value){
  return String(value??'').replace(/[\s.\-]/g,'');
}

// Pemeriksaan format NIK (16 digit sesuai KTP). Mengembalikan pesan kesalahan, atau '' bila valid.
// Struktur NIK: 2 digit provinsi · 2 kab/kota · 2 kecamatan · 6 tanggal lahir (DDMMYY, DD + 40 untuk perempuan) · 4 nomor urut.
export function nikError(value){
  const n=normalizeNik(value);
  if(!n)return 'NIK wajib diisi.';
  if(!/^\d+$/.test(n))return 'NIK hanya boleh berisi angka.';
  if(n.length!==16)return `NIK harus 16 digit (yang diisi ${n.length} digit).`;
  if(/^(\d)\1{15}$/.test(n))return 'NIK tidak valid. Periksa kembali KTP Anda.';
  if(Number(n.slice(0,2))<11)return 'NIK tidak valid: 2 digit pertama (kode provinsi) tidak sesuai. Periksa kembali KTP Anda.';
  const dd=Number(n.slice(6,8)),mm=Number(n.slice(8,10));
  const day=dd>40?dd-40:dd;
  if(mm<1||mm>12||day<1||day>31)return 'NIK tidak valid: digit ke-7 s.d. 12 (tanggal lahir) tidak sesuai. Periksa kembali KTP Anda.';
  if(n.slice(12)==='0000')return 'NIK tidak valid: 4 digit terakhir tidak boleh 0000.';
  return '';
}

// 3374014501900001 -> 3374 0145 0190 0001
export function formatNik(value){
  const n=normalizeNik(value);
  return n.replace(/(\d{4})(?=\d)/g,'$1 ');
}

// 3374014501900001 -> •••• •••• •••• 0001
export function maskNik(value){
  const n=normalizeNik(value);
  if(!n)return '';
  return `•••• •••• •••• ${n.slice(-4)}`;
}

const INACTIVE=['withdrawn','rejected'];

// Peserta SKP aktif yang belum mengisi NIK → perlu diingatkan.
// reg.nik_filled (admin) atau reg.nik?.filled (peserta) menandakan NIK sudah ada.
export function nikFilled(reg){
  return !!(reg?.nik_filled||reg?.nik?.filled);
}

export function needsNik(reg){
  if(!reg?.skp_eligible)return false;
  if(INACTIVE.includes(String(reg?.lifecycle_status||'active')))return false;
  return !nikFilled(reg);
}

export const SKP_FILTERS=[
  {value:'all',label:'Semua (SKP & non-SKP)'},
  {value:'skp',label:'Peserta SKP'},
  {value:'skp_missing',label:'SKP · NIK belum diisi'},
  {value:'skp_filled',label:'SKP · NIK sudah diisi'},
  {value:'non_skp',label:'Non-SKP'}
];

export function skpFilterMatch(reg,filter){
  if(!filter||filter==='all')return true;
  const skp=!!reg?.skp_eligible;
  if(filter==='skp')return skp;
  if(filter==='non_skp')return !skp;
  if(filter==='skp_missing')return skp&&!nikFilled(reg);
  if(filter==='skp_filled')return skp&&nikFilled(reg);
  return true;
}

// Ambil Nomor Pendaftaran dari teks tempelan (boleh satu per baris, dipisah koma, atau baris Excel utuh).
export function extractRegistrationCodes(text){
  const found=String(text||'').toUpperCase().match(/APT-PRS-\d{8}-[A-Z0-9]+/g)||[];
  return [...new Set(found)];
}
