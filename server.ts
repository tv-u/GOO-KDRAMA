import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import type { Request, Response } from 'express';
import type { CastMember, CastProfile, Drama } from './src/types/drama.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const TMDB_API_KEY = process.env.TMDB_API_KEY || '174d0214bf933dd59b3d5ec68a0c967f';
const ISR_REVALIDATE_MS = 300_000; // 5 minutes

function slugifyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function getRequestOrigin(req: Request): string {
  if (process.env.APP_URL) return process.env.APP_URL.replace(/\/$/, '');
  const protoHeader = req.headers['x-forwarded-proto'];
  const proto = Array.isArray(protoHeader) ? protoHeader[0] : protoHeader || req.protocol || 'https';
  const host = req.headers['x-forwarded-host'] || req.get('host') || 'hindidrama.net';
  return `${proto}://${host}`;
}

function loadBaseDramas(): Drama[] {
  try {
    const jsonPath = path.resolve(process.cwd(), 'src/data/dramas.json');
    const raw = fs.readFileSync(jsonPath, 'utf-8');
    return JSON.parse(raw) as Drama[];
  } catch (err) {
    console.error('Failed to load base dramas.json:', err);
    return [];
  }
}

// Live server catalog store (auto-updates when TMDB sync happens)
const liveDramasMap = new Map<string, Drama>();
loadBaseDramas().forEach(d => liveDramasMap.set(d.slug, d));

// Cached TMDB cast credits & profiles for SSR + Sitemap
const creditsCache = new Map<number, CastMember[]>();
const castProfileCache = new Map<string, { data: CastProfile; timestamp: number }>();

// ISR page cache (path -> rendered HTML)
interface IsrEntry {
  html: string;
  timestamp: number;
  revalidating: boolean;
}
const isrCache = new Map<string, IsrEntry>();
let cachedSitemapXml: { xml: string; origin: string; timestamp: number } | null = null;

function invalidateCaches() {
  isrCache.clear();
  cachedSitemapXml = null;
}

async function fetchTmdbCreditsServer(tmdbId: number, type: 'tv' | 'movie' = 'tv'): Promise<CastMember[]> {
  if (creditsCache.has(tmdbId)) return creditsCache.get(tmdbId)!;
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}/credits?api_key=${TMDB_API_KEY}`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return [];
    const data = await res.json();
    const cast: CastMember[] = ((data.cast || []) as any[]).slice(0, 12).map(actor => ({
      id: actor.id,
      slug: `${actor.id}-${slugifyText(actor.name || 'actor')}`,
      name: actor.name || 'Unknown Cast',
      character: actor.character || 'Main Role',
      profilePath: actor.profile_path
        ? `https://image.tmdb.org/t/p/w342${actor.profile_path}`
        : 'https://image.tmdb.org/t/p/w342/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      popularity: actor.popularity || 0,
    }));
    creditsCache.set(tmdbId, cast);
    return cast;
  } catch {
    return [];
  }
}

async function fetchCastProfileServer(castSlug: string): Promise<CastProfile | null> {
  const existing = castProfileCache.get(castSlug);
  if (existing && Date.now() - existing.timestamp < 3_600_000) {
    return existing.data;
  }

  try {
    let personId: number | null = null;
    const idMatch = castSlug.match(/^(\d+)(?:-|$)/);
    if (idMatch) {
      personId = parseInt(idMatch[1], 10);
    } else {
      const q = castSlug.replace(/-/g, ' ');
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        personId = searchData.results?.[0]?.id || null;
      }
    }

    if (!personId) return null;

    const res = await fetch(
      `https://api.themoviedb.org/3/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=combined_credits`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = await res.json();

    const rawCredits: any[] = data.combined_credits?.cast || [];
    const seen = new Set<number>();
    const credits = rawCredits
      .filter(c => (c.media_type === 'tv' || c.media_type === 'movie') && c.poster_path && !seen.has(c.id) && seen.add(c.id))
      .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
      .slice(0, 18)
      .map(item => {
        const title = item.name || item.title || 'Asian Drama';
        const dateStr = item.first_air_date || item.release_date || '2024';
        return {
          tmdbId: item.id,
          title,
          slug: slugifyText(title),
          character: item.character || 'Starring',
          year: parseInt(dateStr.slice(0, 4), 10) || 2024,
          poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
          rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : 8.0,
          mediaType: (item.media_type === 'movie' ? 'movie' : 'tv') as 'tv' | 'movie',
        };
      });

    const profile: CastProfile = {
      id: data.id,
      slug: `${data.id}-${slugifyText(data.name || 'actor')}`,
      name: data.name || 'Asian Drama Star',
      biography:
        data.biography ||
        `${data.name} is an acclaimed Asian television and film actor featured across top Hindi dubbed Korean and Chinese dramas on HindiDrama.net.`,
      birthday: data.birthday || undefined,
      placeOfBirth: data.place_of_birth || undefined,
      knownForDepartment: data.known_for_department || 'Acting',
      profileImage: data.profile_path
        ? `https://image.tmdb.org/t/p/w500${data.profile_path}`
        : 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      credits,
    };

    castProfileCache.set(castSlug, { data: profile, timestamp: Date.now() });
    return profile;
  } catch {
    return null;
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function generateSitemapXml(origin: string): string {
  if (cachedSitemapXml && cachedSitemapXml.origin === origin && Date.now() - cachedSitemapXml.timestamp < ISR_REVALIDATE_MS) {
    return cachedSitemapXml.xml;
  }

  const dramas = Array.from(liveDramasMap.values());
  const today = new Date().toISOString().split('T')[0];
  const urls: string[] = [];

  const pushUrl = (loc: string, priority: string, changefreq: string, image?: { url: string; title: string }) => {
    const imgBlock = image
      ? `\n    <image:image>\n      <image:loc>${escapeXml(image.url)}</image:loc>\n      <image:title>${escapeXml(image.title)}</image:title>\n    </image:image>`
      : '';
    urls.push(`  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${imgBlock}\n  </url>`);
  };

  // Home & Category pages
  pushUrl(`${origin}/`, '1.0', 'daily');
  ['trending', 'korean', 'chinese', 'japanese', 'indian'].forEach(cat => {
    pushUrl(`${origin}/category/${cat}`, '0.9', 'daily');
  });

  // Genre hub pages
  const genreSet = new Set<string>();
  dramas.forEach(d => (d.genres || []).forEach(g => genreSet.add(slugifyText(g))));
  genreSet.forEach(gSlug => {
    if (gSlug) pushUrl(`${origin}/genre/${gSlug}`, '0.8', 'weekly');
  });

  // Drama detail & Episode watch pages
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

  // Cached Cast profile pages
  creditsCache.forEach(list => list.forEach(actor => castSlugSet.add(actor.slug)));
  castSlugSet.forEach(cSlug => {
    pushUrl(`${origin}/cast/${cSlug}`, '0.7', 'weekly');
  });

  // Static pages
  ['/dmca', '/disclaimer', '/privacy-policy', '/terms', '/contact'].forEach(p => {
    pushUrl(`${origin}${p}`, '0.4', 'monthly');
  });

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;
  cachedSitemapXml = { xml, origin, timestamp: Date.now() };
  return xml;
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  let vite: any = null;
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false, maxAge: '7d' }));
  }

  // Automated robots.txt
  app.get('/robots.txt', (req: Request, res: Response) => {
    const origin = getRequestOrigin(req);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.send(
      `User-agent: *\nAllow: /\nDisallow: /api/\n\nUser-agent: Googlebot\nAllow: /\n\nUser-agent: Googlebot-Image\nAllow: /\n\nSitemap: ${origin}/sitemap.xml\n`
    );
  });

  // Automated dynamic XML Sitemap
  app.get('/sitemap.xml', (req: Request, res: Response) => {
    const origin = getRequestOrigin(req);
    const xml = generateSitemapXml(origin);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.send(xml);
  });

  // Live catalog API
  app.get('/api/dramas', (_req: Request, res: Response) => {
    res.json({ dramas: Array.from(liveDramasMap.values()) });
  });

  // Dynamic sync endpoint so newly fetched TMDB dramas update SSR & Sitemap
  app.post('/api/dramas/sync', (req: Request, res: Response) => {
    const drama = req.body as Drama;
    if (!drama || !drama.slug || !drama.title) {
      res.status(400).json({ ok: false, error: 'Invalid drama payload' });
      return;
    }
    liveDramasMap.set(drama.slug, drama);
    if (drama.cast && drama.tmdbId) {
      creditsCache.set(drama.tmdbId, drama.cast);
    }
    invalidateCaches();
    res.json({ ok: true, totalDramas: liveDramasMap.size });
  });

  // Server Availability Ping for WatchPlayer Primary/Fallback Provider Failover
  app.post('/api/server-ping', async (req: Request, res: Response) => {
    const { url } = req.body || {};
    if (typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://'))) {
      res.status(400).json({ ok: false, error: 'Valid HTTP/HTTPS embed URL required' });
      return;
    }

    const start = Date.now();
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(2500),
      });
      const latencyMs = Date.now() - start;
      const ok = response.status < 500;
      res.json({ ok, status: response.status, latencyMs });
    } catch {
      res.json({ ok: false, status: 503, latencyMs: Date.now() - start });
    }
  });

  // Render helper (used for SSR & ISR background revalidation)
  async function renderSsrHtml(url: string, origin: string): Promise<{ html: string; statusCode: number }> {
    const [pathOnly] = url.split('?');
    const dramas = Array.from(liveDramasMap.values());

    // Pre-fetch cast credits on drama detail SSR routes
    const dramaMatch = pathOnly.match(/^\/drama\/([^/]+)$/i);
    if (dramaMatch) {
      const slug = decodeURIComponent(dramaMatch[1]).toLowerCase();
      const target = dramas.find(d => d.slug.toLowerCase() === slug);
      if (target && (!target.cast || target.cast.length === 0) && target.tmdbId) {
        const cast = await fetchTmdbCreditsServer(target.tmdbId, target.type || 'tv');
        if (cast.length > 0) {
          target.cast = cast;
          liveDramasMap.set(target.slug, target);
        }
      }
    }

    // Pre-fetch cast profile on /cast/:slug SSR routes
    let castProfile: CastProfile | null = null;
    const castMatch = pathOnly.match(/^\/cast\/([^/]+)$/i);
    if (castMatch) {
      castProfile = await fetchCastProfileServer(decodeURIComponent(castMatch[1]));
    }

    let templateHtml: string;
    let renderFn: (opts: {
      url: string;
      origin: string;
      dramas: Drama[];
      castProfile?: CastProfile | null;
    }) => { appHtml: string; headTags: string; statusCode: number };

    if (!IS_PROD && vite) {
      const rawTemplate = fs.readFileSync(path.resolve(process.cwd(), 'index.html'), 'utf-8');
      templateHtml = await vite.transformIndexHtml(url, rawTemplate);
      const serverModule = await vite.ssrLoadModule('/src/entry-server.tsx');
      renderFn = serverModule.renderPage;
    } else {
      templateHtml = fs.readFileSync(path.resolve(process.cwd(), 'dist/index.html'), 'utf-8');
      const prodServerEntry = path.resolve(process.cwd(), 'dist-server/entry-server.js');
      const serverModule = await import(prodServerEntry);
      renderFn = serverModule.renderPage;
    }

    const { appHtml, headTags, statusCode } = renderFn({
      url,
      origin,
      dramas,
      castProfile,
    });

    const safeStateJson = JSON.stringify({ dramas, castProfile, origin }).replace(/<\/script/gi, '<\\/script');
    const stateScript = `<script>window.__INITIAL_STATE__=${safeStateJson};</script>`;

    const finalHtml = templateHtml
      .replace(/<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/, headTags)
      .replace('<!--SSR_OUTLET-->', appHtml)
      .replace('<!--INITIAL_STATE-->', stateScript);

    return { html: finalHtml, statusCode };
  }

  // Catch-all SSR + ISR route handler for all Drama, Episode, Cast, Genre, Category, & Static pages
  app.use('*', async (req: Request, res: Response, next) => {
    const url = req.originalUrl;
    if (url.startsWith('/api/') || url.includes('.')) {
      next();
      return;
    }

    const origin = getRequestOrigin(req);
    const cacheKey = `${origin}${url}`;
    const cached = isrCache.get(cacheKey);
    const now = Date.now();

    res.setHeader('Content-Type', 'text/html; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=86400');
    res.setHeader('X-SSR-Engine', 'HindiDrama-SSR-ISR');

    // ISR HIT or STALE-WHILE-REVALIDATE
    if (cached && !url.includes('?q=')) {
      const isFresh = now - cached.timestamp < ISR_REVALIDATE_MS;
      res.setHeader('X-Cache', isFresh ? 'HIT' : 'STALE');

      if (!isFresh && !cached.revalidating) {
        cached.revalidating = true;
        renderSsrHtml(url, origin)
          .then(fresh => {
            isrCache.set(cacheKey, { html: fresh.html, timestamp: Date.now(), revalidating: false });
          })
          .catch(() => {
            cached.revalidating = false;
          });
      }

      res.status(200).send(cached.html);
      return;
    }

    // ISR MISS -> Render SSR HTML
    try {
      const rendered = await renderSsrHtml(url, origin);
      if (!url.includes('?q=')) {
        isrCache.set(cacheKey, { html: rendered.html, timestamp: Date.now(), revalidating: false });
      }
      res.setHeader('X-Cache', 'MISS');
      res.status(rendered.statusCode).send(rendered.html);
    } catch (err) {
      if (vite) {
        vite.ssrFixStacktrace(err as Error);
      }
      console.error('SSR Render Error:', err);
      res.status(500).send('Internal Server Error');
    }
  });

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`HindiDrama Enterprise SSR/ISR Server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer();
