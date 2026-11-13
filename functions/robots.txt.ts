import type { CFContext } from './types.ts';

export async function onRequestGet(context: CFContext): Promise<Response> {
  const url = new URL(context.request.url);
  const origin = (context.env.SITE_URL || url.origin).replace(/\/$/, '');

  const robots = [
    'User-agent: *',
    'Allow: /',
    'Disallow: /api/',
    '',
    'User-agent: Googlebot',
    'Allow: /',
    '',
    'User-agent: Googlebot-Image',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  return new Response(robots, {
    status: 200,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
    },
  });
}
