/** @type {import('next').NextConfig} */
const securityHeaders=[
  {key:'X-Content-Type-Options',value:'nosniff'},
  {key:'X-Frame-Options',value:'DENY'},
  {key:'Referrer-Policy',value:'strict-origin-when-cross-origin'},
  {key:'Permissions-Policy',value:'camera=(), microphone=(), geolocation=(), payment=(), usb=()'},
  {key:'Cross-Origin-Opener-Policy',value:'same-origin'},
  {key:'Strict-Transport-Security',value:'max-age=63072000; includeSubDomains; preload'},
  {key:'Content-Security-Policy',value:"default-src 'self'; base-uri 'self'; object-src 'none'; frame-ancestors 'none'; form-action 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob: https://*.supabase.co; font-src 'self' data:; connect-src 'self' https://*.supabase.co wss://*.supabase.co; frame-src 'self' blob: https://*.supabase.co https://www.google.com https://maps.google.com; upgrade-insecure-requests"}
];

const nextConfig={
  poweredByHeader:false,
  reactStrictMode:true,
  experimental:{serverActions:{bodySizeLimit:'8mb'}},
  // v0.8.2: kamera hanya diizinkan di halaman scanner panitia (/admin/checkin).
  // Entri kedua menimpa Permissions-Policy dari entri pertama untuk path tersebut.
  async headers(){return [
    {source:'/(.*)',headers:securityHeaders},
    {source:'/admin/checkin',headers:[{key:'Permissions-Policy',value:'camera=(self), microphone=(), geolocation=(), payment=(), usb=()'}]}
  ]}
};
export default nextConfig;
