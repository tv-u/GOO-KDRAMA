import type { AudioLanguageCode } from '../types/drama.ts';
import { resolveDynamicEmbed } from './embedResolver.ts';

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export interface ResolvedHlsSubtitle {
  label: string;
  lang: string;
  url: string;
}

export interface HlsAudioTrackMeta {
  lang: string;
  name: string;
}

export interface HlsResolveResult {
  ok: boolean;
  streamUrl?: string;
  rawStreamUrl?: string;
  referer?: string;
  title?: string;
  art?: string;
  serverName?: string;
  subs?: ResolvedHlsSubtitle[];
  availableAudioTracks?: HlsAudioTrackMeta[];
  matchedRequestedAudio?: boolean;
  actualAudioLang?: string;
  actualAudioLabel?: string;
  dubbedEmbedUrl?: string | null;
  dubbedTitle?: string | null;
  fallbackEmbedUrl?: string;
  reason?: string;
}

function isPrivateOrBlockedHost(hostname: string): boolean {
  const h = hostname.toLowerCase().trim();
  if (!h) return true;
  if (
    h === 'localhost' ||
    h.endsWith('.local') ||
    h.endsWith('.internal') ||
    h === '0.0.0.0' ||
    h === '::1' ||
    h.startsWith('127.') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    h.startsWith('169.254.')
  ) {
    return true;
  }
  const m172 = h.match(/^172\.(\d+)\./);
  if (m172) {
    const oct = parseInt(m172[1], 10);
    if (oct >= 16 && oct <= 31) return true;
  }
  return false;
}

export function isValidProxyTarget(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (isPrivateOrBlockedHost(parsed.hostname)) return null;
    return parsed;
  } catch {
    return null;
  }
}

function rewritePlaylistUrls(m3u8Text: string, baseUrl: string, referer: string): string {
  const lines = m3u8Text.split(/\r?\n/);
  const encodeProxy = (rawTarget: string): string => {
    try {
      const abs = new URL(rawTarget, baseUrl).toString();
      return `/api/hls-proxy?url=${encodeURIComponent(abs)}&ref=${encodeURIComponent(referer)}`;
    } catch {
      return rawTarget;
    }
  };

  return lines
    .map(line => {
      const trimmed = line.trim();
      if (!trimmed) return line;
      if (trimmed.startsWith('#')) {
        // Rewrite URI="..." inside #EXT-X-KEY, #EXT-X-MEDIA, #EXT-X-MAP
        return line.replace(/URI=(["'])([^"']+)\1/gi, (_m, q, innerUri) => {
          return `URI=${q}${encodeProxy(innerUri)}${q}`;
        });
      }
      return encodeProxy(trimmed);
    })
    .join('\n');
}

function findFirstMediaLine(m3u8Text: string): string | null {
  for (const raw of m3u8Text.split(/\r?\n/)) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    return line;
  }
  return null;
}

function parseM3u8AudioTracks(m3u8Text: string): HlsAudioTrackMeta[] {
  const tracks: HlsAudioTrackMeta[] = [];
  for (const rawLine of m3u8Text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line.startsWith('#EXT-X-MEDIA:') || !/TYPE=AUDIO/i.test(line)) continue;
    const langMatch = line.match(/LANGUAGE=["']([^"']+)["']/i);
    const nameMatch = line.match(/NAME=["']([^"']+)["']/i);
    tracks.push({
      lang: (langMatch?.[1] || '').trim().toLowerCase(),
      name: (nameMatch?.[1] || langMatch?.[1] || 'Audio').trim(),
    });
  }
  return tracks;
}

function getLangMatcher(lang: string): RegExp {
  const l = lang.toLowerCase();
  if (l === 'hi') return /\b(hi|hin|hindi)\b/i;
  if (l === 'en') return /\b(en|eng|english)\b/i;
  if (l === 'ko') return /\b(ko|kor|korean|orig|original)\b/i;
  if (l === 'ur') return /\b(ur|urd|urdu)\b/i;
  if (l === 'ta') return /\b(ta|tam|tamil)\b/i;
  if (l === 'te') return /\b(te|tel|telugu)\b/i;
  return new RegExp(`\\b${l}\\b`, 'i');
}

function getLangDisplayName(code: string): string {
  const c = code.toLowerCase();
  if (c === 'hi') return 'Hindi';
  if (c === 'en') return 'English';
  if (c === 'ko') return 'Korean (Original)';
  if (c === 'ur') return 'Urdu';
  if (c === 'ta') return 'Tamil';
  if (c === 'te') return 'Telugu';
  return 'Original Audio';
}

function scoreServerForLang(serverName: string, requestedLang: string): number {
  const name = (serverName || '').toLowerCase();
  const l = requestedLang.toLowerCase();
  if (l === 'en') {
    if (name.includes('english') || /\beng\b/.test(name)) return 100;
    if (name.includes('multi')) return 60;
    return 10;
  }
  if (l === 'hi') {
    if (name.includes('hindi') || /\bhin\b/.test(name)) return 100;
    if (name.includes('multi')) return 60;
    if (name.includes('english')) return 5;
    return 15;
  }
  if (l === 'ur') {
    if (name.includes('urdu')) return 100;
    if (name.includes('hindi')) return 70;
    return 10;
  }
  if (l === 'ta') return name.includes('tamil') ? 100 : 10;
  if (l === 'te') return name.includes('telugu') ? 100 : 10;
  // Korean (Original)
  if (name.includes('korean') || name.includes('orig') || name.includes('vnh') || name.includes('vny') || name.includes('swm')) {
    return 90;
  }
  if (name.includes('english') || name.includes('hindi')) return 5;
  return 40;
}

async function verifyStreamReachable(
  playlistUrl: string,
  referer: string,
  depth = 0,
  collectedAudio: HlsAudioTrackMeta[] = []
): Promise<{ reachable: boolean; audioTracks: HlsAudioTrackMeta[] }> {
  if (depth > 2) return { reachable: false, audioTracks: collectedAudio };
  try {
    const res = await fetch(playlistUrl, {
      headers: {
        'User-Agent': BROWSER_UA,
        Referer: referer,
        Origin: new URL(referer).origin,
      },
      signal: AbortSignal.timeout(4500),
    });
    if (!res.ok) return { reachable: false, audioTracks: collectedAudio };
    const text = await res.text();
    if (!text.includes('#EXTM3U')) return { reachable: false, audioTracks: collectedAudio };

    const audioHere = parseM3u8AudioTracks(text);
    const mergedAudio = [...collectedAudio, ...audioHere];

    const firstLine = findFirstMediaLine(text);
    if (!firstLine) return { reachable: false, audioTracks: mergedAudio };

    const firstAbs = new URL(firstLine, playlistUrl).toString();
    if (text.includes('#EXT-X-STREAM-INF') || firstAbs.includes('.m3u8') || firstAbs.includes('_stream?')) {
      return verifyStreamReachable(firstAbs, referer, depth + 1, mergedAudio);
    }

    const segRes = await fetch(firstAbs, {
      headers: {
        'User-Agent': BROWSER_UA,
        Referer: referer,
        Range: 'bytes=0-16383',
      },
      signal: AbortSignal.timeout(4500),
    });
    return {
      reachable: segRes.status === 200 || segRes.status === 206,
      audioTracks: mergedAudio,
    };
  } catch {
    return { reachable: false, audioTracks: collectedAudio };
  }
}

const HLS_CACHE_TTL_MS = 8 * 60 * 1000;
const hlsResolveCache = new Map<string, { data: HlsResolveResult; expiresAt: number }>();
const hlsInflightMap = new Map<string, Promise<HlsResolveResult>>();

async function quickDubCheck(opts: {
  title: string;
  tmdbId: number;
  mediaType: 'tv' | 'movie';
  season: number;
  episode: number;
  rawLang: AudioLanguageCode;
}): Promise<{ dubbedEmbedUrl: string | null; dubbedTitle: string | null }> {
  try {
    const dubCheck = await Promise.race([
      resolveDynamicEmbed({
        provider: 'dailymotion',
        title: opts.title,
        tmdbId: opts.tmdbId,
        type: opts.mediaType,
        season: opts.season,
        episode: opts.episode,
        lang: opts.rawLang,
        strictHindiOnly: opts.rawLang === 'hi',
      }),
      new Promise<null>(res => setTimeout(() => res(null), 2200)),
    ]);
    if (dubCheck?.ok && dubCheck.embedUrl) {
      return {
        dubbedEmbedUrl: dubCheck.embedUrl,
        dubbedTitle: dubCheck.matchedTitle || null,
      };
    }
  } catch {
    // Keep non-blocking
  }
  return { dubbedEmbedUrl: null, dubbedTitle: null };
}

export async function resolveHlsStream(params: {
  tmdbId: number | string;
  type?: 'tv' | 'movie';
  season?: number;
  episode?: number;
  lang?: string;
  title?: string;
}): Promise<HlsResolveResult> {
  const mediaType = params.type === 'movie' ? 'movie' : 'tv';
  const season = params.season || 1;
  const episode = params.episode || 1;
  const rawLang = (params.lang || 'ko').toLowerCase() as AudioLanguageCode;
  const tmdbId = String(params.tmdbId);

  const cacheKey = `${mediaType}:${tmdbId}:${season}:${episode}:${rawLang}`;
  const cached = hlsResolveCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return cached.data;
  }

  const inflight = hlsInflightMap.get(cacheKey);
  if (inflight) {
    return inflight;
  }

  const job = resolveHlsStreamUncached({
    tmdbId,
    mediaType,
    season,
    episode,
    rawLang,
    title: params.title,
  }).then(result => {
    hlsInflightMap.delete(cacheKey);
    if (result.ok) {
      if (hlsResolveCache.size >= 500) {
        const oldestKey = hlsResolveCache.keys().next().value;
        if (oldestKey) hlsResolveCache.delete(oldestKey);
      }
      hlsResolveCache.set(cacheKey, {
        data: result,
        expiresAt: Date.now() + HLS_CACHE_TTL_MS,
      });
    }
    return result;
  }).catch(() => {
    hlsInflightMap.delete(cacheKey);
    return {
      ok: false,
      reason: 'Stream resolver timeout',
    };
  });

  hlsInflightMap.set(cacheKey, job);
  return job;
}

async function resolveHlsStreamUncached(params: {
  tmdbId: string;
  mediaType: 'tv' | 'movie';
  season: number;
  episode: number;
  rawLang: AudioLanguageCode;
  title?: string;
}): Promise<HlsResolveResult> {
  const { mediaType, season, episode, rawLang, tmdbId } = params;
  const lang = encodeURIComponent(rawLang);

  const hosts = ['vidsrc.buzz'];
  let fallbackEmbedUrl =
    mediaType === 'movie'
      ? `https://vidsrc.buzz/embed/movie/${tmdbId}?lang=${lang}`
      : `https://vidsrc.buzz/embed/tv/${tmdbId}/${season}/${episode}?lang=${lang}`;

  for (const host of hosts) {
    const embedPageUrl =
      mediaType === 'movie'
        ? `https://${host}/embed/movie/${tmdbId}?lang=${lang}`
        : `https://${host}/embed/tv/${tmdbId}/${season}/${episode}?lang=${lang}`;

    try {
      const pageRes = await fetch(embedPageUrl, {
        headers: {
          'User-Agent': BROWSER_UA,
          Referer: 'https://www.2embed.cc/',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (!pageRes.ok) continue;
      const html = await pageRes.text();

      const qMatch = html.match(/var\s+Q\s*=\s*(\{[\s\S]*?\});\s*\n?\s*var\s+\$/);
      if (!qMatch) continue;

      let qObj: any;
      try {
        qObj = JSON.parse(qMatch[1]);
      } catch {
        continue;
      }

      if (host === 'vidsrc.buzz') {
        fallbackEmbedUrl = embedPageUrl;
      }

      const apiBase = `https://${host}/pl/`;
      const subsQs = `type=${mediaType}&id=${encodeURIComponent(qObj.id || tmdbId)}&s=${season}&e=${episode}&t=${encodeURIComponent(qObj.t || '')}`;

      const [sourcesRes, subsRes] = await Promise.all([
        fetch(`${apiBase}api.php?a=sources&${subsQs}`, {
          headers: { 'User-Agent': BROWSER_UA, Referer: embedPageUrl },
          signal: AbortSignal.timeout(3500),
        }).catch(() => null),
        fetch(`${apiBase}api.php?a=subs&${subsQs}`, {
          headers: { 'User-Agent': BROWSER_UA, Referer: embedPageUrl },
          signal: AbortSignal.timeout(3500),
        }).catch(() => null),
      ]);

      const sourcesJson = sourcesRes && sourcesRes.ok ? await sourcesRes.json().catch(() => null) : null;
      const subsJson = subsRes && subsRes.ok ? await subsRes.json().catch(() => null) : null;

      const serverList: any[] =
        (Array.isArray(sourcesJson?.servers) && sourcesJson.servers.length > 0
          ? sourcesJson.servers
          : qObj?.ssr?.servers) || [];

      if (serverList.length === 0) continue;

      // Strictly sort servers so requested language server (e.g. Server English or Server Hindi) runs first
      const activeServers = [...serverList]
        .filter(s => s?.ref)
        .sort((a, b) => scoreServerForLang(b.name, rawLang) - scoreServerForLang(a.name, rawLang))
        .slice(0, 6);
      if (activeServers.length === 0) continue;

      const subs: ResolvedHlsSubtitle[] = Array.isArray(subsJson?.subs)
        ? subsJson.subs.slice(0, 12).map((sub: any) => ({
            label: String(sub.label || sub.lang || 'Subtitles'),
            lang: String(sub.cc || sub.lang || 'en').slice(0, 5).toLowerCase(),
            url: `/api/hls-proxy?subHost=${encodeURIComponent(host)}&subRef=${encodeURIComponent(String(sub.ref || ''))}`,
          }))
        : [];

      const langMatcher = getLangMatcher(rawLang);

      const raceServers = async (srvs: any[]): Promise<any[]> => {
        if (srvs.length === 0) return [];
        try {
          const refsParam = srvs.map(s => s.ref).join(',');
          const rr = await fetch(
            `${apiBase}api.php?a=race&refs=${encodeURIComponent(refsParam)}&t=${encodeURIComponent(qObj.t || '')}`,
            {
              headers: { 'User-Agent': BROWSER_UA, Referer: embedPageUrl },
              signal: AbortSignal.timeout(4500),
            }
          );
          if (!rr.ok) return [];
          const rj = await rr.json().catch(() => null);
          return Array.isArray(rj?.cands) ? rj.cands : [];
        } catch {
          return [];
        }
      };

      const checkCandList = async (cands: any[]): Promise<HlsResolveResult | null> => {
        for (const cand of cands) {
          if (!cand?.url) continue;
          const absStream = new URL(cand.url, apiBase).toString();
          const check = await verifyStreamReachable(absStream, embedPageUrl);
          if (check.reachable) {
            const srvMeta = serverList.find(s => s.ref === cand.ref);
            const srvName = cand.serverName || srvMeta?.name || 'HLS.proxy';
            const srvLower = srvName.toLowerCase();

            const manifestHasRequestedAudio = check.audioTracks.some(
              t => langMatcher.test(t.lang) || langMatcher.test(t.name)
            );
            const serverExplicitlyMatches =
              (rawLang === 'en' && (srvLower.includes('english') || /\beng\b/.test(srvLower))) ||
              (rawLang === 'hi' && (srvLower.includes('hindi') || /\bhin\b/.test(srvLower))) ||
              (rawLang === 'ur' && srvLower.includes('urdu')) ||
              (rawLang === 'ta' && srvLower.includes('tamil')) ||
              (rawLang === 'te' && srvLower.includes('telugu')) ||
              (rawLang === 'ko' && !srvLower.includes('english') && !srvLower.includes('hindi'));

            const matchedRequestedAudio = manifestHasRequestedAudio || serverExplicitlyMatches;
            let actualAudioLang: string = rawLang;
            let actualAudioLabel = getLangDisplayName(rawLang);

            if (!matchedRequestedAudio) {
              if (srvLower.includes('english') || /\beng\b/.test(srvLower)) {
                actualAudioLang = 'en';
                actualAudioLabel = 'English';
              } else if (check.audioTracks.length > 0) {
                actualAudioLang = check.audioTracks[0].lang || 'ko';
                actualAudioLabel = check.audioTracks[0].name || 'Original Audio';
              } else {
                actualAudioLang = 'ko';
                actualAudioLabel = 'Original Audio (Subtitled)';
              }
            }

            let dubbedEmbedUrl: string | null = null;
            let dubbedTitle: string | null = null;
            if (!matchedRequestedAudio && rawLang !== 'ko' && (params.title || qObj.title)) {
              const dubHit = await quickDubCheck({
                title: params.title || String(qObj.title || ''),
                tmdbId: Number(tmdbId) || 0,
                mediaType,
                season,
                episode,
                rawLang,
              });
              dubbedEmbedUrl = dubHit.dubbedEmbedUrl;
              dubbedTitle = dubHit.dubbedTitle;
            }

            return {
              ok: true,
              streamUrl: `/api/hls-proxy?url=${encodeURIComponent(absStream)}&ref=${encodeURIComponent(embedPageUrl)}`,
              rawStreamUrl: absStream,
              referer: embedPageUrl,
              title: qObj.title || undefined,
              art: qObj.art || undefined,
              serverName: srvName,
              subs,
              availableAudioTracks: check.audioTracks,
              matchedRequestedAudio,
              actualAudioLang,
              actualAudioLabel,
              dubbedEmbedUrl,
              dubbedTitle,
              fallbackEmbedUrl,
            };
          }
        }
        return null;
      };

      // Step 1: Try exact language-matched server alone first so fastest mirror doesn't override requested language
      const topScore = scoreServerForLang(activeServers[0].name, rawLang);
      if (topScore >= 80) {
        const preferredCands = await raceServers([activeServers[0]]);
        const preferredHit = await checkCandList(
          preferredCands.map(c => ({ ...c, serverName: activeServers[0].name }))
        );
        if (preferredHit) return preferredHit;
      }

      // Step 2: Single batched race over remaining servers (avoids parallel 502 rate-limit)
      const remainingServers = topScore >= 80 ? activeServers.slice(1) : activeServers;
      if (remainingServers.length > 0) {
        const fallbackCands = await raceServers(remainingServers);
        const fallbackHit = await checkCandList(fallbackCands);
        if (fallbackHit) return fallbackHit;
      }
    } catch {
      // Continue trying next host
    }
  }

  let dubbedEmbedUrl: string | null = null;
  let dubbedTitle: string | null = null;
  if (rawLang !== 'ko' && params.title) {
    const dubHit = await quickDubCheck({
      title: params.title,
      tmdbId: Number(tmdbId) || 0,
      mediaType,
      season,
      episode,
      rawLang,
    });
    dubbedEmbedUrl = dubHit.dubbedEmbedUrl;
    dubbedTitle = dubHit.dubbedTitle;
  }

  return {
    ok: false,
    dubbedEmbedUrl,
    dubbedTitle,
    fallbackEmbedUrl,
    reason: 'Upstream HLS segments unreachable via proxy; handing off cleanly to direct embed player',
  };
}

export async function resolveDirectMp4OrStreamUrl(params: {
  tmdbId: number | string;
  title: string;
  type?: 'tv' | 'movie';
  season?: number;
  episode?: number;
  lang?: AudioLanguageCode;
}): Promise<{
  ok: boolean;
  directMp4Url: string | null;
  hlsProxyUrl: string | null;
  embedUrl: string | null;
}> {
  const mediaType = params.type === 'movie' ? 'movie' : 'tv';
  const season = params.season || 1;
  const episode = params.episode || 1;
  const lang = params.lang || 'ko';

  const [archiveRes, hlsRes] = await Promise.all([
    Promise.race([
      resolveDynamicEmbed({
        provider: 'archive',
        title: params.title,
        tmdbId: Number(params.tmdbId) || 0,
        type: mediaType,
        season,
        episode,
        lang,
      }),
      new Promise<null>(r => setTimeout(() => r(null), 2500)),
    ]).catch(() => null),
    resolveHlsStream({
      tmdbId: params.tmdbId,
      type: mediaType,
      season,
      episode,
      lang,
      title: params.title,
    }),
  ]);

  return {
    ok: Boolean(archiveRes?.streamUrl || hlsRes.streamUrl || hlsRes.fallbackEmbedUrl),
    directMp4Url: archiveRes?.streamUrl || null,
    hlsProxyUrl: hlsRes.streamUrl || null,
    embedUrl: hlsRes.dubbedEmbedUrl || hlsRes.fallbackEmbedUrl || null,
  };
}

export async function proxyHlsRequest(params: {
  targetUrlRaw?: string | null;
  refererRaw?: string | null;
  subHost?: string | null;
  subRef?: string | null;
}): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string | ArrayBuffer;
}> {
  // Subtitle VTT conversion/proxy mode
  if (params.subRef) {
    const safeHost = params.subHost === 'videm.buzz' ? 'videm.buzz' : 'vidsrc.buzz';
    const subUrl = `https://${safeHost}/pl/api.php?a=sub&ref=${encodeURIComponent(params.subRef)}`;
    try {
      const subRes = await fetch(subUrl, {
        headers: { 'User-Agent': BROWSER_UA, Referer: `https://${safeHost}/` },
        signal: AbortSignal.timeout(6000),
      });
      let text = await subRes.text();
      if (!text.startsWith('WEBVTT')) {
        text = `WEBVTT\n\n${text.replace(/(\d{2}:\d{2}:\d{2}),(\d{3})/g, '$1.$2')}`;
      }
      return {
        status: subRes.status,
        headers: {
          'Content-Type': 'text/vtt; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=3600',
        },
        body: text,
      };
    } catch {
      return {
        status: 502,
        headers: { 'Content-Type': 'text/vtt; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
        body: 'WEBVTT\n\n',
      };
    }
  }

  const target = params.targetUrlRaw ? isValidProxyTarget(params.targetUrlRaw) : null;
  if (!target) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({ ok: false, error: 'Invalid HLS proxy target URL' }),
    };
  }

  const refUrl =
    params.refererRaw && isValidProxyTarget(params.refererRaw)
      ? params.refererRaw
      : `${target.origin}/`;

  try {
    const upstream = await fetch(target.toString(), {
      headers: {
        'User-Agent': BROWSER_UA,
        Referer: refUrl,
        Origin: new URL(refUrl).origin,
      },
      redirect: 'follow',
      signal: AbortSignal.timeout(10000),
    });

    const ct = (upstream.headers.get('content-type') || '').toLowerCase();
    const isPlaylist =
      ct.includes('mpegurl') ||
      target.pathname.endsWith('.m3u8') ||
      target.pathname.includes('_stream');

    if (isPlaylist && upstream.ok) {
      const rawText = await upstream.text();
      if (rawText.includes('#EXTM3U')) {
        const rewritten = rewritePlaylistUrls(rawText, upstream.url || target.toString(), refUrl);
        return {
          status: 200,
          headers: {
            'Content-Type': 'application/vnd.apple.mpegurl; charset=utf-8',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'no-store',
          },
          body: rewritten,
        };
      }
      return {
        status: upstream.status,
        headers: { 'Content-Type': ct || 'text/plain', 'Access-Control-Allow-Origin': '*' },
        body: rawText,
      };
    }

    const buf = await upstream.arrayBuffer();
    // Masqueraded MPEG-TS/fMP4 video segments often use image/png content-type on upstream CDNs
    const safeMediaCt =
      ct.includes('image/png') || ct.includes('image/jpeg') || ct === 'application/octet-stream' || !ct
        ? 'video/mp2t'
        : ct;

    return {
      status: upstream.status,
      headers: {
        'Content-Type': safeMediaCt,
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=3600',
      },
      body: buf,
    };
  } catch (err) {
    return {
      status: 502,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Access-Control-Allow-Origin': '*' },
      body: JSON.stringify({
        ok: false,
        error: err instanceof Error ? err.message : 'Upstream stream error',
      }),
    };
  }
}
