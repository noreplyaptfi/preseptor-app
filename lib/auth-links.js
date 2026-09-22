export function siteUrl(fallback = '') {
  return (process.env.NEXT_PUBLIC_SITE_URL || fallback || 'http://localhost:3000').replace(/\/$/, '');
}
