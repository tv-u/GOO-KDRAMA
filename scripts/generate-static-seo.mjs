import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRAMAS_PATH = path.resolve(ROOT, 'src/data/dramas.json');
const PUBLIC_DIR = path.resolve(ROOT, 'public');

const rawOrigin = process.env.SITE_URL || 'https://kdrama-hindi.pages.dev';
const origin = rawOrigin.replace(/\/$/, '');
const INDEXNOW_KEY = 'hindidrama2026seoindexnowkey';

const TOP_50_CODES = [
  'en', 'hi', 'ko', 'zh', 'zh-TW', 'ja', 'es', 'fr', 'de', 'pt',
  'pt-BR', 'ar', 'ru', 'id', 'ms', 'th', 'vi', 'tl', 'ta', 'te',
  'bn', 'ur', 'pa', 'mr', 'gu', 'kn', 'ml', 'tr', 'it', 'nl',
  'pl', 'uk', 'ro', 'cs', 'el', 'hu', 'sv', 'da', 'fi', 'no',
  'he', 'fa', 'sw', 'af', 'ne', 'si', 'my', 'km', 'lo', 'uz',
];

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function escapeXml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildHreflangBlock(loc) {
  const esc = escapeXml(loc);
  const lines = TOP_50_CODES.map(code => `    <xhtml:link rel="alternate" hreflang="${code}" href="${esc}" />`);
  lines.push(`    <xhtml:link rel="alternate" hreflang="x-default" href="${esc}" />`);
  return lines.join('\n');
}

function run() {
  if (!fs.existsSync(PUBLIC_DIR)) {
    fs.mkdirSync(PUBLIC_DIR, { recursive: true });
  }

  let dramas = [];
  try {
    dramas = JSON.parse(fs.readFileSync(DRAMAS_PATH, 'utf-8'));
  } catch (err) {
    console.error('Could not read src/data/dramas.json:', err);
  }

  // Generate global multi-crawler robots.txt
  const robotsTxt = [
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
    'User-agent: Googlebot-Video',
    'Allow: /',
    '',
    'User-agent: Bingbot',
    'Allow: /',
    '',
    'User-agent: DuckDuckBot',
    'Allow: /',
    '',
    'User-agent: YandexBot',
    'Allow: /',
    '',
    'User-agent: Baiduspider',
    'Allow: /',
    '',
    'User-agent: Yeti',
    'Allow: /',
    '',
    'User-agent: Applebot',
    'Allow: /',
    '',
    `Sitemap: ${origin}/sitemap.xml`,
    '',
  ].join('\n');

  fs.writeFileSync(path.resolve(PUBLIC_DIR, 'robots.txt'), robotsTxt, 'utf-8');
  fs.writeFileSync(path.resolve(PUBLIC_DIR, `${INDEXNOW_KEY}.txt`), INDEXNOW_KEY, 'utf-8');

  // Generate static fallback sitemap.xml (overridden dynamically by Cloudflare Function & Express)
  const today = new Date().toISOString().split('T')[0];
  const urls = [];

  const pushUrl = (loc, priority, changefreq, image, withHreflang = false) => {
    const imgBlock = image
      ? `\n    <image:image>\n      <image:loc>${escapeXml(image.url)}</image:loc>\n      <image:title>${escapeXml(image.title)}</image:title>\n    </image:image>`
      : '';
    const altBlock = withHreflang ? `\n${buildHreflangBlock(loc)}` : '';
    urls.push(
      `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${altBlock}${imgBlock}\n  </url>`
    );
  };

  pushUrl(`${origin}/`, '1.0', 'daily', undefined, true);
  pushUrl(`${origin}/category/hindi-dubbed`, '0.95', 'daily', undefined, true);
  ['trending', 'korean', 'chinese', 'japanese', 'indian'].forEach(cat => {
    pushUrl(`${origin}/category/${cat}`, '0.9', 'daily');
  });

  const genreSet = new Set();
  dramas.forEach(d => (d.genres || []).forEach(g => genreSet.add(slugify(g))));
  genreSet.forEach(gSlug => {
    if (gSlug) pushUrl(`${origin}/genre/${gSlug}`, '0.8', 'weekly');
  });

  dramas.forEach(d => {
    pushUrl(`${origin}/drama/${d.slug}`, '0.9', 'daily', {
      url: d.poster,
      title: `${d.title} Hindi Dubbed`,
    });

    const epCount = Math.min(Math.max(1, Number(d.totalEpisodes) || 1), 100);
    for (let ep = 1; ep <= epCount; ep++) {
      pushUrl(`${origin}/watch/${d.slug}/episode-${ep}`, '0.85', 'weekly');
    }
  });

  ['/dmca', '/disclaimer', '/privacy-policy', '/terms', '/contact'].forEach(p => {
    pushUrl(`${origin}${p}`, '0.4', 'monthly');
  });

  const sitemapXml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>\n`;
  fs.writeFileSync(path.resolve(PUBLIC_DIR, 'sitemap.xml'), sitemapXml, 'utf-8');

  console.log(`Generated public/robots.txt, IndexNow key, and public/sitemap.xml (${urls.length} URLs for ${origin})`);
}

run();
