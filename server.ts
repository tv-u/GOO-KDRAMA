import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import express from 'express';
import type { Request, Response } from 'express';
import type { AnalyticsEventPayload, AudioLanguageCode, CastMember, CastProfile, Drama } from './src/types/drama.ts';
import { resolveDynamicEmbed, type DynamicEmbedProvider } from './src/services/embedResolver.ts';
import { relayPlayerRequest } from './src/services/playerRelay.ts';
import { resolveHlsStream, proxyHlsRequest, resolveDirectMp4OrStreamUrl } from './src/services/hlsProxy.ts';
import { buildHreflangSitemapLinks, INDEXNOW_KEY, TOP_50_WORLD_LANGUAGES } from './src/services/worldwideSeo.ts';
import { getMp4StreamPath, getWatchPath } from './src/services/seo.ts';
import {
  addManualSource,
  appendSyncLog,
  buildAdminOverview,
  createAdminToken,
  deleteManualSource,
  getManualSourcesForEpisode,
  recordAnalyticsEvent,
  toggleManualSource,
  verifyAdminPassword,
  verifyAdminToken,
} from './src/services/analyticsStore.ts';
import { runAutomatedTmdbSync, runBulkCatalogAutoSync, resolveSlugViaTmdb } from './src/services/tmdbSyncEngine.ts';

const PORT = Number(process.env.PORT) || 3000;
const IS_PROD = process.env.NODE_ENV === 'production';
const TMDB_API_KEY = process.env.TMDB_API_KEY || '174d0214bf933dd59b3d5ec68a0c967f';
const DAILYMOTION_API_KEY = process.env.DAILYMOTION_API_KEY || '';
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
let cachedVideoSitemapXml: { xml: string; origin: string; timestamp: number } | null = null;

function invalidateCaches() {
  isrCache.clear();
  cachedSitemapXml = null;
  cachedVideoSitemapXml = null;
}

let bootBulkSyncPromise: Promise<void> | null = null;
function triggerBulkAutoSync(force = false): Promise<void> {
  if (bootBulkSyncPromise && !force) return bootBulkSyncPromise;
  bootBulkSyncPromise = (async () => {
    try {
      const existing = Array.from(liveDramasMap.values());
      const result = await runBulkCatalogAutoSync({
        existingDramas: existing,
        apiKey: TMDB_API_KEY,
        targetMovies: 520,
        targetDramas: 140,
      });
      liveDramasMap.clear();
      for (const item of result.mergedDramas) {
        liveDramasMap.set(item.slug, item);
      }
      invalidateCaches();
      appendSyncLog({
        trigger: 'scheduled',
        added: result.addedMovies + result.addedDramas,
        updated: 0,
        episodesDiscovered: result.addedMovies + result.addedDramas * 16,
        duplicatesSkipped: 0,
        errors: [],
      });
      console.log(
        `[Auto-Sync] Catalog ready: ${result.totalMovies} movies + ${result.totalDramas} dramas (${liveDramasMap.size} total dedicated pages)`
      );
      if (process.env.APP_URL && !process.env.APP_URL.includes('127.0.0.1') && !process.env.APP_URL.includes('localhost')) {
        const pubOrigin = process.env.APP_URL.replace(/\/$/, '');
        const hotUrls = result.mergedDramas.slice(0, 40).map(d =>
          d.type === 'movie' ? `${pubOrigin}/movie/${d.slug}` : `${pubOrigin}/drama/${d.slug}`
        );
        fetch('https://api.indexnow.org/indexnow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json; charset=utf-8' },
          body: JSON.stringify({
            host: new URL(pubOrigin).hostname,
            key: INDEXNOW_KEY,
            keyLocation: `${pubOrigin}/${INDEXNOW_KEY}.txt`,
            urlList: [`${pubOrigin}/`, `${pubOrigin}/movies`, ...hotUrls],
          }),
          signal: AbortSignal.timeout(4000),
        }).catch(() => {});
      }
    } catch (err) {
      console.error('[Auto-Sync] Bulk sync error:', err);
    }
  })();
  return bootBulkSyncPromise;
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

  const pushUrl = (
    loc: string,
    priority: string,
    changefreq: string,
    image?: { url: string; title: string },
    withWorldwideAlternates = false
  ) => {
    const imgBlock = image
      ? `\n    <image:image>\n      <image:loc>${escapeXml(image.url)}</image:loc>\n      <image:title>${escapeXml(image.title)}</image:title>\n    </image:image>`
      : '';
    const hreflangBlock = withWorldwideAlternates ? `\n${buildHreflangSitemapLinks(loc)}` : '';
    urls.push(
      `  <url>\n    <loc>${escapeXml(loc)}</loc>\n    <lastmod>${today}</lastmod>\n    <changefreq>${changefreq}</changefreq>\n    <priority>${priority}</priority>${hreflangBlock}${imgBlock}\n  </url>`
    );
  };

  // Home, Movies Hub & Category pages
  pushUrl(`${origin}/`, '1.0', 'daily', undefined, true);
  pushUrl(`${origin}/movies`, '0.96', 'daily', undefined, true);
  const allMovies = dramas.filter(d => d.type === 'movie');
  const moviePages = Math.max(1, Math.ceil(allMovies.length / 24));
  for (let p = 2; p <= moviePages; p++) {
    pushUrl(`${origin}/movies/page/${p}`, '0.88', 'daily');
  }
  pushUrl(`${origin}/category/hindi-dubbed`, '0.95', 'daily', undefined, true);
  ['trending', 'korean', 'chinese', 'japanese', 'indian', 'movies', 'anime'].forEach(cat => {
    pushUrl(`${origin}/category/${cat}`, '0.9', 'daily');
  });

  // Genre hub pages
  const genreSet = new Set<string>();
  dramas.forEach(d => (d.genres || []).forEach(g => genreSet.add(slugifyText(g))));
  genreSet.forEach(gSlug => {
    if (gSlug) pushUrl(`${origin}/genre/${gSlug}`, '0.8', 'weekly');
  });

  // Dedicated Movie (/movie/:slug), Drama (/drama/:slug) & Episode (/watch/:slug/episode-:ep) pages
  const castSlugSet = new Set<string>();
  dramas.forEach(d => {
    if (d.type === 'movie') {
      pushUrl(`${origin}/movie/${d.slug}`, '0.9', 'daily', {
        url: d.poster,
        title: `${d.title} (${d.year}) Full Movie Hindi Dubbed`,
      });
      pushUrl(`${origin}/watch/${d.slug}`, '0.85', 'weekly');
    } else {
      pushUrl(`${origin}/drama/${d.slug}`, '0.9', 'daily', {
        url: d.poster,
        title: `${d.title} Hindi Dubbed`,
      });

      const epCount = Math.min(Math.max(1, d.totalEpisodes || 1), 60);
      for (let ep = 1; ep <= epCount; ep++) {
        pushUrl(`${origin}/watch/${d.slug}/episode-${ep}`, '0.85', 'weekly');
      }
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

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml" xmlns:image="http://www.google.com/schemas/sitemap-image/1.1">\n${urls.join('\n')}\n</urlset>`;
  cachedSitemapXml = { xml, origin, timestamp: Date.now() };
  return xml;
}

function generateVideoSitemapXml(origin: string): string {
  if (cachedVideoSitemapXml && cachedVideoSitemapXml.origin === origin && Date.now() - cachedVideoSitemapXml.timestamp < ISR_REVALIDATE_MS) {
    return cachedVideoSitemapXml.xml;
  }

  const dramas = Array.from(liveDramasMap.values());
  const entries: string[] = [];

  for (const d of dramas) {
    if (d.type === 'movie') {
      const watchLoc = `${origin}${getWatchPath(d)}`;
      const contentLoc = `${origin}${getMp4StreamPath(d)}`;
      const durationSec = Math.max(2400, (parseInt(String(d.duration || '115'), 10) || 115) * 60);
      entries.push(
        `  <url>\n    <loc>${escapeXml(`${origin}/movie/${d.slug}`)}</loc>\n    <video:video>\n      <video:thumbnail_loc>${escapeXml(d.backdrop || d.poster)}</video:thumbnail_loc>\n      <video:title>${escapeXml(`${d.title} (${d.year}) Full Movie HD`)}</video:title>\n      <video:description>${escapeXml((d.overview || d.title).slice(0, 300))}</video:description>\n      <video:content_loc>${escapeXml(contentLoc)}</video:content_loc>\n      <video:player_loc allow_embed="yes">${escapeXml(watchLoc)}</video:player_loc>\n      <video:duration>${durationSec}</video:duration>\n      <video:family_friendly>yes</video:family_friendly>\n      <video:live>no</video:live>\n    </video:video>\n  </url>`
      );
    } else {
      const latestEp = Math.max(1, d.latestEpisode || 1);
      const season = d.season || 1;
      const epWatchLoc = `${origin}${getWatchPath(d, latestEp, season)}`;
      const epContentLoc = `${origin}${getMp4StreamPath(d, latestEp, season)}`;
      const durationSec = Math.max(1200, (parseInt(String(d.duration || '55'), 10) || 55) * 60);
      entries.push(
        `  <url>\n    <loc>${escapeXml(epWatchLoc)}</loc>\n    <video:video>\n      <video:thumbnail_loc>${escapeXml(d.backdrop || d.poster)}</video:thumbnail_loc>\n      <video:title>${escapeXml(`${d.title} Episode ${latestEp} HD Stream`)}</video:title>\n      <video:description>${escapeXml((d.overview || d.title).slice(0, 300))}</video:description>\n      <video:content_loc>${escapeXml(epContentLoc)}</video:content_loc>\n      <video:player_loc allow_embed="yes">${escapeXml(epWatchLoc)}</video:player_loc>\n      <video:duration>${durationSec}</video:duration>\n      <video:family_friendly>yes</video:family_friendly>\n      <video:live>no</video:live>\n    </video:video>\n  </url>`
      );
    }
  }

  const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:video="http://www.google.com/schemas/sitemap-video/1.1">\n${entries.join('\n')}\n</urlset>`;
  cachedVideoSitemapXml = { xml, origin, timestamp: Date.now() };
  return xml;
}

const rateBuckets = new Map<string, { count: number; resetAt: number }>();

function checkApiRateLimit(key: string, maxRequests = 180, windowMs = 60_000): boolean {
  const now = Date.now();
  const bucket = rateBuckets.get(key);
  if (!bucket || now > bucket.resetAt) {
    rateBuckets.set(key, { count: 1, resetAt: now + windowMs });
    return true;
  }
  bucket.count += 1;
  return bucket.count <= maxRequests;
}

function requireAdmin(req: Request, res: Response): boolean {
  const auth = req.headers.authorization;
  if (!verifyAdminToken(auth)) {
    res.status(401).json({ ok: false, error: 'Unauthorized: Valid admin token required' });
    return false;
  }
  return true;
}

async function startServer() {
  const app = express();

  // Lightweight Gzip compression for fast HTML, XML, and JSON delivery
  app.use((req, res, next) => {
    const acceptEnc = String(req.headers['accept-encoding'] || '');
    if (!acceptEnc.includes('gzip') || req.path.startsWith('/api/hls-proxy') || req.path.startsWith('/stream/')) {
      next();
      return;
    }
    const origSend = res.send.bind(res);
    res.send = ((body?: any) => {
      if (typeof body === 'string' && body.length > 1024 && !res.headersSent) {
        try {
          const gz = zlib.gzipSync(body, { level: 6 });
          res.setHeader('Content-Encoding', 'gzip');
          res.setHeader('Vary', 'Accept-Encoding');
          res.removeHeader('Content-Length');
          return origSend(gz);
        } catch {
          return origSend(body);
        }
      }
      return origSend(body);
    }) as any;
    next();
  });

  app.use((req, res, next) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    if (req.path.startsWith('/api/')) {
      const ip = req.ip || req.socket.remoteAddress || 'anon';
      const limit = req.path === '/api/admin/login' ? 25 : 240;
      if (!checkApiRateLimit(`${ip}:${req.path === '/api/admin/login' ? 'login' : 'api'}`, limit)) {
        res.status(429).json({ ok: false, error: 'Too many requests, please wait a moment' });
        return;
      }
    }
    next();
  });
  app.use('/api/player-relay', express.text({ type: '*/*', limit: '2mb' }));
  app.use(express.json({ limit: '1mb' }));

  let vite: any = null;
  if (!IS_PROD) {
    const { createServer: createViteServer } = await import('vite');
    vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'custom',
    });
  }

  // Automated global robots.txt
  app.get('/robots.txt', (req: Request, res: Response) => {
    const origin = getRequestOrigin(req);
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
    res.send(
      [
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
        `Sitemap: ${origin}/video-sitemap.xml`,
        '',
      ].join('\n')
    );
  });

  // IndexNow Ownership Verification Key File
  app.get(`/${INDEXNOW_KEY}.txt`, (_req: Request, res: Response) => {
    res.setHeader('Content-Type', 'text/plain; charset=utf-8');
    res.send(INDEXNOW_KEY);
  });

  // Advanced SEO & Index Health Status Endpoint
  app.get('/api/seo/status', (_req: Request, res: Response) => {
    const items = Array.from(liveDramasMap.values());
    const movies = items.filter(d => d.type === 'movie').length;
    const dramas = items.filter(d => d.type !== 'movie').length;
    const episodes = items.reduce((sum, d) => sum + (d.type === 'movie' ? 1 : Math.min(Math.max(1, d.totalEpisodes || 1), 60)), 0);
    res.json({
      ok: true,
      indexedLanguages: TOP_50_WORLD_LANGUAGES.length,
      totalDramas: dramas,
      totalMovies: movies,
      totalEpisodeAndMovieStreamUrls: episodes,
      sitemaps: ['/sitemap.xml', '/video-sitemap.xml'],
      indexNowReady: true,
    });
  });

  // Instant Search Engine Indexing Ping (IndexNow for Bing / Yandex / Naver / Seznam)
  app.post('/api/seo/indexnow', async (req: Request, res: Response) => {
    const origin = getRequestOrigin(req);
    const urls: string[] = Array.isArray(req.body?.urls)
      ? req.body.urls
      : [`${origin}/`, `${origin}/movies`, `${origin}/category/hindi-dubbed`];
    try {
      const host = new URL(origin).hostname;
      const r = await fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json; charset=utf-8' },
        body: JSON.stringify({
          host,
          key: INDEXNOW_KEY,
          keyLocation: `${origin}/${INDEXNOW_KEY}.txt`,
          urlList: urls.slice(0, 100),
        }),
        signal: AbortSignal.timeout(4000),
      });
      res.json({ ok: r.ok, status: r.status, submitted: urls.length });
    } catch {
      res.json({ ok: false, status: 503, submitted: 0 });
    }
  });

  // Dedicated .mp4 Stream URL Generator & Handler for Every K-Drama, Episode, and Movie
  app.all(
    ['/stream/:slug.mp4', '/stream/:slug/episode-:episode.mp4', '/stream/:slug/season-:season/episode-:episode.mp4'],
    async (req: Request, res: Response) => {
      const slug = decodeURIComponent(String(req.params.slug || '')).toLowerCase();
      const season = Math.max(1, parseInt(String(req.params.season || '1'), 10) || 1);
      const episode = Math.max(1, parseInt(String(req.params.episode || '1'), 10) || 1);
      const lang = String(req.query.lang || 'ko').toLowerCase() as AudioLanguageCode;

      if (bootBulkSyncPromise) {
        await Promise.race([bootBulkSyncPromise, new Promise(r => setTimeout(r, 2500))]);
      }

      let target = liveDramasMap.get(slug);
      if (!target) {
        target = await resolveSlugViaTmdb({ slug, apiKey: TMDB_API_KEY }) || undefined;
        if (target) {
          liveDramasMap.set(target.slug, target);
        }
      }
      if (!target) {
        res.status(404).json({ ok: false, error: 'Drama or movie stream not found' });
        return;
      }

      if (req.method === 'HEAD') {
        res.setHeader('Content-Type', 'video/mp4');
        res.setHeader('Accept-Ranges', 'bytes');
        res.setHeader('Cache-Control', 'public, max-age=600');
        res.status(200).end();
        return;
      }

      const resolved = await resolveDirectMp4OrStreamUrl({
        tmdbId: target.tmdbId || 0,
        title: target.title,
        type: target.type === 'movie' ? 'movie' : 'tv',
        season,
        episode,
        lang,
      });

      // Return JSON stream manifest if explicitly requested by API consumer
      if (req.query.format === 'json') {
        res.json({
          ok: resolved.ok,
          title: target.title,
          slug: target.slug,
          season,
          episode,
          mp4Url: `${getRequestOrigin(req)}${getMp4StreamPath(target, episode, season)}`,
          directMp4Url: resolved.directMp4Url,
          hlsProxyUrl: resolved.hlsProxyUrl,
          embedUrl: resolved.embedUrl,
        });
        return;
      }

      if (resolved.hlsProxyUrl) {
        res.redirect(302, resolved.hlsProxyUrl);
        return;
      }
      if (resolved.directMp4Url) {
        res.redirect(302, resolved.directMp4Url);
        return;
      }
      if (resolved.embedUrl) {
        res.redirect(302, resolved.embedUrl);
        return;
      }
      res.status(404).json({ ok: false, error: 'Stream currently offline' });
    }
  );

  // Automated dynamic XML Sitemap & Google Video Sitemap
  app.get('/sitemap.xml', async (req: Request, res: Response) => {
    if (bootBulkSyncPromise) {
      await Promise.race([bootBulkSyncPromise, new Promise(r => setTimeout(r, 4500))]);
    }
    const origin = getRequestOrigin(req);
    const xml = generateSitemapXml(origin);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.send(xml);
  });

  app.get('/video-sitemap.xml', async (req: Request, res: Response) => {
    if (bootBulkSyncPromise) {
      await Promise.race([bootBulkSyncPromise, new Promise(r => setTimeout(r, 4500))]);
    }
    const origin = getRequestOrigin(req);
    const xml = generateVideoSitemapXml(origin);
    res.setHeader('Content-Type', 'application/xml; charset=utf-8');
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=3600');
    res.send(xml);
  });

  // Live catalog API
  app.get('/api/dramas', async (_req: Request, res: Response) => {
    if (bootBulkSyncPromise) {
      await Promise.race([bootBulkSyncPromise, new Promise(r => setTimeout(r, 4000))]);
    }
    res.json({ dramas: Array.from(liveDramasMap.values()) });
  });

  // Paginated Movies Directory API (500+ individual movie pages)
  app.get('/api/movies', async (req: Request, res: Response) => {
    if (bootBulkSyncPromise) {
      await Promise.race([bootBulkSyncPromise, new Promise(r => setTimeout(r, 4000))]);
    }
    const page = Math.max(1, parseInt(String(req.query.page || '1'), 10) || 1);
    const limit = Math.min(100, Math.max(12, parseInt(String(req.query.limit || '24'), 10) || 24));
    const q = String(req.query.q || '').trim().toLowerCase();
    const country = String(req.query.country || '').trim().toLowerCase();
    const genre = String(req.query.genre || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'popular').trim().toLowerCase();

    let movies = Array.from(liveDramasMap.values()).filter(d => d.type === 'movie');
    if (q) {
      movies = movies.filter(
        m =>
          m.title.toLowerCase().includes(q) ||
          m.country.toLowerCase().includes(q) ||
          (m.genres || []).some(g => g.toLowerCase().includes(q))
      );
    }
    if (country && country !== 'all') {
      movies = movies.filter(m => m.country.toLowerCase() === country);
    }
    if (genre && genre !== 'all') {
      movies = movies.filter(m => (m.genres || []).some(g => g.toLowerCase().includes(genre)));
    }
    if (sort === 'rating') movies.sort((a, b) => b.rating - a.rating);
    else if (sort === 'year') movies.sort((a, b) => b.year - a.year);
    else if (sort === 'title') movies.sort((a, b) => a.title.localeCompare(b.title));
    else movies.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));

    const total = movies.length;
    const totalPages = Math.max(1, Math.ceil(total / limit));
    const safePage = Math.min(page, totalPages);
    const items = movies.slice((safePage - 1) * limit, safePage * limit);

    res.json({
      ok: true,
      page: safePage,
      limit,
      total,
      totalPages,
      movies: items,
    });
  });

  // Dynamic On-Demand Slug Resolver (guarantees any /movie/:slug or /drama/:slug works live via TMDB)
  app.get('/api/dramas/resolve', async (req: Request, res: Response) => {
    const slug = String(req.query.slug || '').trim().toLowerCase();
    const rawType = String(req.query.type || '');
    const preferredType: 'movie' | 'tv' | undefined =
      rawType === 'movie' ? 'movie' : rawType === 'tv' ? 'tv' : undefined;

    if (!slug) {
      res.status(400).json({ ok: false, error: 'Missing slug parameter' });
      return;
    }

    const existing = liveDramasMap.get(slug);
    if (existing) {
      res.json({ ok: true, drama: existing });
      return;
    }

    const resolved = await resolveSlugViaTmdb({ slug, preferredType, apiKey: TMDB_API_KEY });
    if (!resolved) {
      res.status(404).json({ ok: false, error: 'Title not found on TMDB' });
      return;
    }
    liveDramasMap.set(resolved.slug, resolved);
    if (resolved.cast && resolved.tmdbId) {
      creditsCache.set(resolved.tmdbId, resolved.cast);
    }
    invalidateCaches();
    res.json({ ok: true, drama: resolved });
  });

  // Dynamic sync endpoint with TMDB ID & slug deduplication + Sitemap + IndexNow
  app.post('/api/dramas/sync', (req: Request, res: Response) => {
    const drama = req.body as Drama;
    if (!drama || !drama.slug || !drama.title) {
      res.status(400).json({ ok: false, error: 'Invalid drama payload' });
      return;
    }

    const existingByTmdb = drama.tmdbId
      ? Array.from(liveDramasMap.values()).find(
          d => d.tmdbId === drama.tmdbId && (d.type || 'tv') === (drama.type || 'tv')
        )
      : undefined;
    const targetSlug = existingByTmdb ? existingByTmdb.slug : drama.slug;
    const merged: Drama = existingByTmdb
      ? {
          ...existingByTmdb,
          ...drama,
          slug: existingByTmdb.slug,
          id: existingByTmdb.id,
          totalEpisodes: Math.max(existingByTmdb.totalEpisodes || 1, drama.totalEpisodes || 1),
          latestEpisode: Math.max(existingByTmdb.latestEpisode || 1, drama.latestEpisode || 1),
        }
      : drama;

    liveDramasMap.set(targetSlug, merged);
    if (merged.cast && merged.tmdbId) {
      creditsCache.set(merged.tmdbId, merged.cast);
    }
    invalidateCaches();

    const origin = getRequestOrigin(req);
    if (!origin.includes('127.0.0.1') && !origin.includes('localhost')) {
      fetch('https://api.indexnow.org/indexnow', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: new URL(origin).hostname,
          key: INDEXNOW_KEY,
          keyLocation: `${origin}/${INDEXNOW_KEY}.txt`,
          urlList: [`${origin}/drama/${merged.slug}`, `${origin}/category/hindi-dubbed`],
        }),
      }).catch(() => {});
    }

    res.json({ ok: true, deduplicated: Boolean(existingByTmdb), totalDramas: liveDramasMap.size });
  });

  // Real Visitor, Click & Source Health Analytics Event Ingestion
  app.post('/api/analytics/event', (req: Request, res: Response) => {
    const payload = req.body as AnalyticsEventPayload;
    const allowedTypes = new Set(['page_view', 'poster_click', 'episode_play', 'source_health', 'playback_error']);
    if (!payload || !allowedTypes.has(payload.type)) {
      res.status(400).json({ ok: false, error: 'Invalid analytics event type' });
      return;
    }
    recordAnalyticsEvent(payload);
    res.json({ ok: true });
  });

  // Manual Authorized Episode Sources Lookup (Public read of active sources for playback)
  app.get('/api/sources/:slug/:episode', (req: Request, res: Response) => {
    const slug = String(req.params.slug || '').trim();
    const episode = Math.max(1, parseInt(String(req.params.episode || '1'), 10) || 1);
    const sources = getManualSourcesForEpisode(slug, episode);
    res.json({ ok: true, sources });
  });

  // Admin Authentication & Dashboard Protected APIs
  app.post('/api/admin/login', (req: Request, res: Response) => {
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!verifyAdminPassword(password)) {
      res.status(401).json({ ok: false, error: 'Invalid administrator credentials' });
      return;
    }
    const token = createAdminToken();
    res.json({ ok: true, token });
  });

  app.get('/api/admin/overview', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const dramas = Array.from(liveDramasMap.values());
    res.json({ ok: true, data: buildAdminOverview(dramas) });
  });

  app.post('/api/admin/sync', async (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const customTmdbId = req.body?.tmdbId ? Number(req.body.tmdbId) : undefined;
    const customType = req.body?.type === 'movie' ? 'movie' : 'tv';
    try {
      const existingDramas = Array.from(liveDramasMap.values());
      const syncResult = await runAutomatedTmdbSync({
        existingDramas,
        apiKey: TMDB_API_KEY,
        customTmdbId,
        customType,
      });

      liveDramasMap.clear();
      for (const item of syncResult.mergedDramas) {
        liveDramasMap.set(item.slug, item);
      }

      try {
        const jsonPath = path.resolve(process.cwd(), 'src/data/dramas.json');
        fs.writeFileSync(jsonPath, JSON.stringify(syncResult.mergedDramas, null, 2) + '\n', 'utf-8');
      } catch {
        // Skip filesystem persist on read-only host
      }

      invalidateCaches();
      const logEntry = appendSyncLog({
        trigger: 'manual',
        added: syncResult.added,
        updated: syncResult.updated,
        episodesDiscovered: syncResult.episodesDiscovered,
        duplicatesSkipped: syncResult.duplicatesSkipped,
        errors: syncResult.errors,
      });

      res.json({
        ok: true,
        log: logEntry,
        totalCatalog: liveDramasMap.size,
      });
    } catch (err) {
      res.status(500).json({
        ok: false,
        error: err instanceof Error ? err.message : 'Automated sync failed',
      });
    }
  });

  app.post('/api/admin/sources', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const { dramaSlug, season, episode, label, url, format, language } = req.body || {};
    if (
      typeof dramaSlug !== 'string' ||
      !dramaSlug.trim() ||
      typeof label !== 'string' ||
      !label.trim() ||
      typeof url !== 'string' ||
      (!url.startsWith('https://') && !url.startsWith('http://'))
    ) {
      res.status(400).json({ ok: false, error: 'Valid dramaSlug, label, and HTTP/HTTPS source URL required' });
      return;
    }
    const allowedFormats = new Set(['hls', 'dash', 'mp4', 'iframe']);
    const safeFormat = allowedFormats.has(format) ? format : 'iframe';
    const created = addManualSource({
      dramaSlug,
      season: Number(season || 1),
      episode: Number(episode ?? 1),
      label,
      url,
      format: safeFormat,
      language,
    });
    res.json({ ok: true, source: created });
  });

  app.post('/api/admin/sources/:id/toggle', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const updated = toggleManualSource(String(req.params.id || ''));
    if (!updated) {
      res.status(404).json({ ok: false, error: 'Source not found' });
      return;
    }
    res.json({ ok: true, source: updated });
  });

  app.delete('/api/admin/sources/:id', (req: Request, res: Response) => {
    if (!requireAdmin(req, res)) return;
    const removed = deleteManualSource(String(req.params.id || ''));
    res.json({ ok: removed });
  });

  // Server Availability Ping for WatchPlayer Primary/Fallback Provider Failover
  app.post('/api/server-ping', async (req: Request, res: Response) => {
    const { url } = req.body || {};
    if (typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://'))) {
      res.status(400).json({ ok: false, error: 'Valid HTTP/HTTPS embed URL required' });
      return;
    }

    const start = Date.now();
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    };
    try {
      let response = await fetch(url, {
        method: 'HEAD',
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(2500),
      });
      if (response.status >= 400) {
        response = await fetch(url, {
          method: 'GET',
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(2500),
        });
      }
      const latencyMs = Date.now() - start;
      const isRedirect = response.status >= 300 && response.status < 400 && Boolean(response.headers.get('location'));
      const isCfBrowserChallenge = response.status === 403 && Boolean(response.headers.get('cf-mitigated'));
      const ok = (response.status >= 200 && response.status < 400) || isRedirect || isCfBrowserChallenge;
      res.json({ ok, status: isRedirect || isCfBrowserChallenge ? 200 : response.status, latencyMs });
    } catch {
      res.json({ ok: false, status: 503, latencyMs: Date.now() - start });
    }
  });

  // Sandbox-Free HTML & Stream API Relay for Embed Players (2Embed / VidSrc.buzz / NontonGo / VidRock)
  app.all('/api/player-relay', async (req: Request, res: Response) => {
    const targetUrlRaw = typeof req.query.url === 'string' ? req.query.url : '';
    const bodyText = typeof req.body === 'string' ? req.body : req.body ? JSON.stringify(req.body) : null;
    const result = await relayPlayerRequest({
      method: req.method.toUpperCase(),
      targetUrlRaw,
      bodyText,
      contentType: req.headers['content-type'] || null,
    });

    Object.entries(result.headers).forEach(([k, v]) => {
      res.setHeader(k, v);
    });
    if (typeof result.body === 'string') {
      res.status(result.status).send(result.body);
    } else {
      res.status(result.status).send(Buffer.from(result.body));
    }
  });

  // Direct HLS/M3U8 Extractor & Subtitle + Media Segment Proxy (Zero Sandbox, Custom hls.js Player)
  app.all('/api/hls-resolve', async (req: Request, res: Response) => {
    const src = req.method === 'POST' ? req.body || {} : req.query || {};
    const tmdbId = String(src.tmdbId || '');
    if (!tmdbId) {
      res.status(400).json({ ok: false, error: 'Missing tmdbId' });
      return;
    }
    const result = await resolveHlsStream({
      tmdbId,
      type: src.type === 'movie' ? 'movie' : 'tv',
      season: Number(src.season || 1),
      episode: Number(src.episode || 1),
      lang: String(src.lang || 'ko'),
      title: typeof src.title === 'string' ? src.title : undefined,
    });
    res.setHeader('Cache-Control', 'no-store');
    res.json(result);
  });

  app.get('/api/hls-proxy', async (req: Request, res: Response) => {
    const result = await proxyHlsRequest({
      targetUrlRaw: typeof req.query.url === 'string' ? req.query.url : null,
      refererRaw: typeof req.query.ref === 'string' ? req.query.ref : null,
      subHost: typeof req.query.subHost === 'string' ? req.query.subHost : null,
      subRef: typeof req.query.subRef === 'string' ? req.query.subRef : null,
    });
    Object.entries(result.headers).forEach(([k, v]) => {
      res.setHeader(k, v);
    });
    if (typeof result.body === 'string') {
      res.status(result.status).send(result.body);
    } else {
      res.status(result.status).send(Buffer.from(result.body));
    }
  });

  // Dynamic Language-Aware Stream & Embed Resolver (Dailymotion, YouTube, Internet Archive, Wikimedia Commons, PeerTube)
  app.post('/api/embed-resolve', async (req: Request, res: Response) => {
    const { provider, title, tmdbId, type, season, episode, lang, strictHindiOnly } = req.body || {};
    const allowedProviders = new Set(['dailymotion', 'youtube', 'archive', 'wikimedia', 'peertube']);
    if (!allowedProviders.has(provider) || typeof title !== 'string') {
      res.status(400).json({ ok: false, error: 'Valid provider and title required' });
      return;
    }

    const result = await resolveDynamicEmbed({
      provider: provider as DynamicEmbedProvider,
      title,
      tmdbId: Number(tmdbId) || 0,
      type: type === 'movie' ? 'movie' : 'tv',
      season: Number(season) || 1,
      episode: Number(episode) || 1,
      lang: (lang as AudioLanguageCode) || 'hi',
      strictHindiOnly: Boolean(strictHindiOnly),
      apiKey: TMDB_API_KEY,
      dailymotionApiKey: DAILYMOTION_API_KEY,
    });
    res.json(result);
  });

  // Mount Vite dev middleware or production static assets AFTER dynamic routes (/sitemap.xml, /robots.txt, /api/*)
  if (!IS_PROD && vite) {
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(process.cwd(), 'dist');
    app.use(express.static(distDir, { index: false, maxAge: '7d' }));
  }

  // Render helper (used for SSR & ISR background revalidation)
  async function renderSsrHtml(url: string, origin: string): Promise<{ html: string; statusCode: number }> {
    const [pathOnly] = url.split('?');

    if (bootBulkSyncPromise) {
      await Promise.race([bootBulkSyncPromise, new Promise(r => setTimeout(r, 3000))]);
    }

    // Resolve unknown /movie/:slug, /drama/:slug, /watch/:slug directly via TMDB if not cached yet
    const movieRouteMatch = pathOnly.match(/^\/movie\/([^/]+)$/i);
    const dramaRouteMatch = pathOnly.match(/^\/drama\/([^/]+)$/i);
    const watchRouteMatch = pathOnly.match(/^\/watch\/([^/]+)/i);

    const requestedSlug = decodeURIComponent(
      (movieRouteMatch?.[1] || dramaRouteMatch?.[1] || watchRouteMatch?.[1] || '').trim()
    ).toLowerCase();

    if (requestedSlug) {
      let target = Array.from(liveDramasMap.values()).find(
        d => d.slug.toLowerCase() === requestedSlug
      );
      if (!target) {
        const resolved = await resolveSlugViaTmdb({
          slug: requestedSlug,
          preferredType: movieRouteMatch ? 'movie' : undefined,
          apiKey: TMDB_API_KEY,
        });
        if (resolved) {
          liveDramasMap.set(resolved.slug, resolved);
          invalidateCaches();
          target = resolved;
        }
      }
      if (target && (!target.cast || target.cast.length === 0) && target.tmdbId) {
        const cast = await fetchTmdbCreditsServer(target.tmdbId, target.type || 'tv');
        if (cast.length > 0) {
          target.cast = cast;
          liveDramasMap.set(target.slug, target);
        }
      }
    }

    const dramas = Array.from(liveDramasMap.values());

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
    }) => { appHtml: string; headTags: string; htmlLang: string; statusCode: number };

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

    const { appHtml, headTags, htmlLang, statusCode } = renderFn({
      url,
      origin,
      dramas,
      castProfile,
    });

    const safeStateJson = JSON.stringify({ dramas, castProfile, origin }).replace(/<\/script/gi, '<\\/script');
    const stateScript = `<script>window.__INITIAL_STATE__=${safeStateJson};</script>`;

    const finalHtml = templateHtml
      .replace(/<html\s+lang=["'][^"']*["']/i, `<html lang="${htmlLang || 'en'}"`)
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
    res.setHeader(
      'X-Robots-Tag',
      url.includes('?q=') || url.startsWith('/admin') || url.startsWith('/library')
        ? 'noindex, follow'
        : 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1'
    );
    res.setHeader('X-SSR-Engine', 'HindiDrama-SSR-ISR');

    // ISR HIT or STALE-WHILE-REVALIDATE (bypass cache for search & admin/library routes)
    if (cached && !url.includes('?q=') && !url.startsWith('/admin') && !url.startsWith('/library')) {
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
    // Immediately start 500+ Movie & Drama background auto-sync
    triggerBulkAutoSync(false);
    // Refresh catalog every 30 minutes automatically
    setInterval(() => {
      triggerBulkAutoSync(true);
    }, 1_800_000);
  });
}

startServer();
