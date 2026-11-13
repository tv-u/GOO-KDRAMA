import baseDramas from '../src/data/dramas.json';
import { slugifyText } from '../src/services/seo.ts';
import type { Drama } from '../src/types/drama.ts';
import type { CFContext } from './types.ts';

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function onRequestGet(context: CFContext): Promise<Response> {
  const url = new URL(context.request.url);
  const origin = (context.env.SITE_URL || url.origin).replace(/\/$/, '');
  const dramas = baseDramas as Drama[];
  const today = new Date().toISOString().split('T')[0];
  const urls: string[] = [];

  const pushUrl = (
    loc: string,
    priority: string,
    changefreq: string,
    image?: { url: string; title: string }
  ) => {
    const imgBlock = image
      ? `\n    <image:image>\n      <image:loc>${escapeXml(image.url)}</image:loc>\n      <image:title>${escapeXml(image.title)}</image:title>\n    </image:image>`
      : '';
    urls.push(
      `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${imgBlock}\n  </url>`
    );
  };

  pushUrl(`${origin}/`, '1.0', 'daily');
  ['trending', 'korean', 'chinese', 'japanese', 'indian'].forEach(cat => {
    pushUrl(`${origin}/category/${cat}`, '0.9', 'daily');
  });

  const genreSet = new Set<string>();
  dramas.forEach(d => (d.genres || []).forEach(g => genreSet.add(slugifyText(g))));
  genreSet.forEach(gSlug => {
    if (gSlug) pushUrl(`${origin}/genre/${gSlug}`, '0.8', 'weekly');
  });

  const castSlugSet = new Set<string>();
  dramas.forEach(d => {
    pushUrl(`${origin}/drama/${d.slug}`, '0.9', 'daily', {
      url: d.poster,
      title: `${d.title} Hindi Dubbed`,
    });

    const epCount = Math.min(Math.max(1, d.totalEpisodes || 1), 100);
    for (let ep = 1; ep <= epCount; ep++) {
      pushUrl(`${origin}/watch/${d.slug}/episode-${ep}`, '0.85', 'weekly');
    }

    (d.cast || []).forEach(actor => castSlugSet.add(actor.slug));
  });

  castSlugSet.forEach(cSlug => {
    pushUrl(`${origin}/cast/${cSlug}`, '0.7', 'weekly');
  });

  ['/dmca', '/disclaimer', '/privacy-policy', '/terms', '/contact'].forEach(p => {
    pushUrl(`${origin}${p}`, '0.4', 'monthly');
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
    },
  });
}
