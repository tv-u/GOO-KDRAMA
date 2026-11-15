import type { AudioLanguageCode } from '../types/drama.ts';

export type DynamicEmbedProvider =
  | 'dailymotion'
  | 'youtube'
  | 'archive'
  | 'wikimedia'
  | 'peertube';

export interface ResolveEmbedRequest {
  provider: DynamicEmbedProvider;
  title: string;
  tmdbId: number;
  type?: 'tv' | 'movie';
  season?: number;
  episode?: number;
  lang: AudioLanguageCode;
  strictHindiOnly?: boolean;
  apiKey?: string;
  dailymotionApiKey?: string;
}

export interface ResolveEmbedResult {
  ok: boolean;
  embedUrl: string | null;
  streamUrl?: string | null;
  streamType?: 'hls' | 'mp4' | 'webm' | 'ogg';
  matchedTitle?: string;
  langApplied: AudioLanguageCode;
  tracks?: { label: string; lang: string; url: string }[];
}

const LANG_CONFIG: Record<
  AudioLanguageCode,
  { keyword: string; fallbackKeyword: string; tmdbTag: string; excludeIfEnglish?: RegExp }
> = {
  hi: { keyword: 'Hindi Dubbed', fallbackKeyword: 'Hindi', tmdbTag: 'hi-IN' },
  en: { keyword: 'English Dubbed', fallbackKeyword: 'English Sub', tmdbTag: 'en-US', excludeIfEnglish: /\bhindi\b/i },
  ko: { keyword: 'Korean', fallbackKeyword: 'Korean Audio', tmdbTag: 'ko-KR' },
  ur: { keyword: 'Urdu Dubbed', fallbackKeyword: 'Urdu', tmdbTag: 'ur-PK' },
  ta: { keyword: 'Tamil Dubbed', fallbackKeyword: 'Tamil', tmdbTag: 'ta-IN' },
  te: { keyword: 'Telugu Dubbed', fallbackKeyword: 'Telugu', tmdbTag: 'te-IN' },
};

function cleanTitleWords(title: string): string {
  return title
    .replace(/[:\-–—()[\]]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

async function resolveDailymotion(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  const cfg = LANG_CONFIG[req.lang] || LANG_CONFIG.hi;
  const season = req.season || 1;
  const episode = req.episode || 1;
  const shortTitle = cleanTitleWords(req.title);
  const queries =
    req.type === 'movie'
      ? [
          `${shortTitle} Full Movie ${cfg.keyword}`,
          `${shortTitle} ${cfg.keyword}`,
          `${shortTitle} Full Movie ${cfg.fallbackKeyword}`,
        ]
      : [
          `${shortTitle} Season ${season} Episode ${episode} ${cfg.keyword}`,
          `${shortTitle} Episode ${episode} ${cfg.keyword}`,
          `${shortTitle} EP ${episode} ${cfg.fallbackKeyword}`,
        ];

  const headers: Record<string, string> = {
    'User-Agent':
      'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
    Accept: 'application/json',
  };
  if (req.dailymotionApiKey) {
    headers['X-Dailymotion-Api-Key'] = req.dailymotionApiKey;
  }

  const langRegexMap: Record<AudioLanguageCode, RegExp> = {
    hi: /\b(hindi|hin)\b/i,
    ur: /\b(urdu|urd)\b/i,
    ta: /\b(tamil|tam)\b/i,
    te: /\b(telugu|tel)\b/i,
    en: /\b(english\s*dub|english\s*audio|eng\s*dub)\b/i,
    ko: /\b(korean|kor|raw|original)\b/i,
  };
  const targetLangRegex = langRegexMap[req.lang];

  for (const query of queries) {
    try {
      const apiParams = new URLSearchParams({
        search: query,
        fields: 'id,title,language,duration,embed_url',
        limit: '12',
        sort: 'relevance',
      });
      const apiUrl = `https://api.dailymotion.com/videos?${apiParams.toString()}`;
      const res = await fetch(apiUrl, { headers, signal: AbortSignal.timeout(4500) });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        list?: { id: string; title: string; language?: string; duration?: number; embed_url?: string }[];
      };
      const items = (data.list || []).filter(v => Boolean(v?.id) && (v.duration || 0) >= 120);
      if (items.length === 0) continue;

      const titleWords = shortTitle
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2);

      const scored = items
        .map(v => {
          const lowerTitle = (v.title || '').toLowerCase();
          const vLang = (v.language || '').toLowerCase();
          const matchedWords = titleWords.filter(w => lowerTitle.includes(w)).length;
          const minWords = titleWords.length >= 2 ? 2 : 1;

          // Strict language verification: must match BOTH title words AND target language
          const hasTitleMatch = matchedWords >= minWords;
          const hasExplicitLang =
            targetLangRegex.test(lowerTitle) ||
            (vLang === req.lang && req.lang !== 'en');

          if (!hasTitleMatch || !hasExplicitLang) {
            return { item: v, score: -100 };
          }
          if (req.lang === 'en' && cfg.excludeIfEnglish?.test(lowerTitle)) {
            return { item: v, score: -100 };
          }

          let epBoost = 0;
          if (req.type !== 'movie') {
            // Reject conflicting season numbers if explicitly present
            const sMatch = lowerTitle.match(/\b(?:season|s)\s*0*(\d+)\b/i);
            if (sMatch && parseInt(sMatch[1], 10) !== season) {
              return { item: v, score: -100 };
            }
            // Reject conflicting episode numbers and require explicit match on this episode
            const epMatch = lowerTitle.match(/\b(?:episode|ep|e)\s*[\.\-:]*\s*0*(\d+)\b/i);
            if (!epMatch || parseInt(epMatch[1], 10) !== episode) {
              return { item: v, score: -100 };
            }
            epBoost = 10;
            if (sMatch && parseInt(sMatch[1], 10) === season) epBoost += 5;
          }

          let score = matchedWords * 5 + epBoost;
          if (/dubbed|full\s*episode|full\s*movie|audio/i.test(lowerTitle)) score += 6;
          if ((v.duration || 0) >= 900) score += 8;
          return { item: v, score };
        })
        .filter(x => x.score > 0)
        .sort((a, b) => b.score - a.score);

      const chosen = scored[0]?.item;
      if (chosen?.id) {
        return {
          ok: true,
          embedUrl: `https://geo.dailymotion.com/player.html?video=${encodeURIComponent(chosen.id)}&autoplay=1`,
          matchedTitle: chosen.title,
          langApplied: req.lang,
        };
      }
    } catch {
      // Try next query
    }
  }

  return { ok: false, embedUrl: null, langApplied: req.lang };
}

async function resolveYouTube(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  const cfg = LANG_CONFIG[req.lang] || LANG_CONFIG.hi;
  const apiKey = req.apiKey || '174d0214bf933dd59b3d5ec68a0c967f';
  const mediaType = req.type === 'movie' ? 'movie' : 'tv';
  const mediaLabel = mediaType === 'movie' ? 'full movie' : `episode ${req.episode || 1}`;
  const shortTitle = cleanTitleWords(req.title);
  const queries = [
    `${shortTitle} ${mediaLabel} ${cfg.keyword}`,
    `${shortTitle} ${cfg.keyword}`,
  ];

  for (const query of queries) {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=${req.lang}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept-Language': `${cfg.tmdbTag},${req.lang};q=0.9,en;q=0.8`,
        },
        signal: AbortSignal.timeout(4000),
      });
      if (!res.ok) continue;
      const html = await res.text();
      const matches = Array.from(html.matchAll(/"videoId":"([A-Za-z0-9_-]{11})"/g)).map(m => m[1]);
      const uniqueIds = Array.from(new Set(matches));
      if (uniqueIds.length > 0) {
        return {
          ok: true,
          embedUrl: `https://www.youtube.com/embed/${uniqueIds[0]}?autoplay=1&hl=${req.lang}&cc_lang_pref=${req.lang}&rel=0`,
          matchedTitle: `${req.title} (${cfg.fallbackKeyword})`,
          langApplied: req.lang,
        };
      }
    } catch {
      // Fallback to TMDB videos API
    }
  }

  for (const langParam of [cfg.tmdbTag, 'en-US', '']) {
    try {
      const qs = langParam ? `&language=${langParam}` : '';
      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${req.tmdbId}/videos?api_key=${apiKey}${qs}`,
        { signal: AbortSignal.timeout(3500) }
      );
      if (!tmdbRes.ok) continue;
      const data = (await tmdbRes.json()) as {
        results?: { site: string; key: string; name?: string }[];
      };
      const yt = (data.results || []).find(v => v.site === 'YouTube' && v.key);
      if (yt) {
        return {
          ok: true,
          embedUrl: `https://www.youtube.com/embed/${yt.key}?autoplay=1&hl=${req.lang}&cc_lang_pref=${req.lang}&rel=0`,
          matchedTitle: yt.name || req.title,
          langApplied: req.lang,
        };
      }
    } catch {
      // Continue
    }
  }

  return { ok: false, embedUrl: null, langApplied: req.lang };
}

async function resolveInternetArchive(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  const shortTitle = cleanTitleWords(req.title);
  const titleWords = shortTitle
    .toLowerCase()
    .split(/\s+/)
    .filter(w => w.length > 2);
  const minWords = titleWords.length >= 2 ? 2 : 1;
  const queries = [`mediatype:(movies) AND title:(${shortTitle})`];

  for (const q of queries) {
    try {
      const searchUrl = `https://archive.org/advancedsearch.php?q=${encodeURIComponent(
        q
      )}&fl[]=identifier,title&rows=6&output=json`;
      const res = await fetch(searchUrl, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        response?: { docs?: { identifier?: string; title?: string }[] };
      };
      const docs = (data.response?.docs || []).filter(d => {
        if (!d?.identifier || !d?.title) return false;
        const lower = d.title.toLowerCase();
        const hits = titleWords.filter(w => lower.includes(w)).length;
        return hits >= minWords;
      });
      if (docs.length === 0) continue;

      for (const doc of docs.slice(0, 3)) {
        const id = doc.identifier!;
        try {
          const filesRes = await fetch(`https://archive.org/metadata/${encodeURIComponent(id)}/files`, {
            signal: AbortSignal.timeout(4000),
          });
          if (!filesRes.ok) continue;
          const filesData = (await filesRes.json()) as {
            result?: { name?: string; format?: string; size?: string }[];
          };
          const files = filesData.result || [];

          const epPattern = new RegExp(`(?:ep|episode|e|_)0*${req.episode || 1}\\b`, 'i');
          const mp4Candidates = files.filter(f => /\.(mp4|m3u8)$/i.test(f.name || ''));
          if (mp4Candidates.length === 0) continue;

          const matchedFile =
            mp4Candidates.find(f => epPattern.test(f.name || '')) ||
            mp4Candidates.find(f => /\.mp4$/i.test(f.name || '')) ||
            mp4Candidates[0];

          const streamUrl = `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(
            matchedFile.name!
          ).replace(/%2F/g, '/')}`;
          const tracks = files
            .filter(f => /\.vtt$/i.test(f.name || ''))
            .slice(0, 3)
            .map((t, i) => ({
              label: t.name || `Subtitle ${i + 1}`,
              lang: i === 0 ? 'en' : req.lang,
              url: `https://archive.org/download/${encodeURIComponent(id)}/${encodeURIComponent(t.name!).replace(
                /%2F/g,
                '/'
              )}`,
            }));

          return {
            ok: true,
            streamUrl,
            streamType: matchedFile.name!.endsWith('.m3u8') ? 'hls' : 'mp4',
            embedUrl: `https://archive.org/embed/${encodeURIComponent(id)}?autoplay=1`,
            matchedTitle: doc.title || id,
            langApplied: req.lang,
            tracks,
          };
        } catch {
          // Try next item
        }
      }

      // If metadata files skipped, return embed iframe of top matched Archive item
      const topId = docs[0].identifier!;
      return {
        ok: true,
        embedUrl: `https://archive.org/embed/${encodeURIComponent(topId)}?autoplay=1`,
        matchedTitle: docs[0].title || topId,
        langApplied: req.lang,
      };
    } catch {
      // Try next query
    }
  }

  return { ok: false, embedUrl: null, langApplied: req.lang };
}

async function resolveWikimediaCommons(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  const shortTitle = cleanTitleWords(req.title);
  const firstWord = shortTitle.split(/\s+/)[0] || 'Korea';
  const queries = [
    `filetype:video ${shortTitle}`,
    `filetype:video ${firstWord}`,
    `filetype:video korean drama cinema`,
    `filetype:video korea film`,
  ];

  for (const gsrsearch of queries) {
    try {
      const apiUrl = `https://commons.wikimedia.org/w/api.php?action=query&generator=search&gsrnamespace=6&gsrsearch=${encodeURIComponent(
        gsrsearch
      )}&prop=videoinfo&viprop=url|mime&gsrlimit=10&format=json`;
      const res = await fetch(apiUrl, {
        headers: {
          'User-Agent': 'HindiDramaNet/1.0 (https://hindidrama.net; media-resolver)',
          Accept: 'application/json',
        },
        signal: AbortSignal.timeout(4500),
      });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        query?: {
          pages?: Record<
            string,
            {
              title?: string;
              videoinfo?: { url?: string; mime?: string; descriptionurl?: string }[];
            }
          >;
        };
      };
      const pages = Object.values(data.query?.pages || {});
      const candidates: { cleanUrl: string; streamType: 'mp4' | 'webm' | 'ogg'; matchedTitle: string; priority: number }[] = [];
      for (const page of pages) {
        const info = page.videoinfo?.[0];
        if (!info?.url) continue;
        const mime = (info.mime || '').toLowerCase();
        if (!mime.includes('video') && !/\.(webm|mp4|ogv)(\?|$)/i.test(info.url)) continue;

        const cleanUrl = info.url.split('?')[0];
        const streamType: 'mp4' | 'webm' | 'ogg' = cleanUrl.endsWith('.mp4')
          ? 'mp4'
          : cleanUrl.endsWith('.ogv')
            ? 'ogg'
            : 'webm';
        const priority = streamType === 'mp4' ? 3 : streamType === 'webm' ? 2 : 1;

        candidates.push({
          cleanUrl,
          streamType,
          matchedTitle: (page.title || '').replace(/^File:/i, '').replace(/\.[^.]+$/, ''),
          priority,
        });
      }

      candidates.sort((a, b) => b.priority - a.priority);
      if (candidates.length > 0) {
        const best = candidates[0];
        return {
          ok: true,
          streamUrl: best.cleanUrl,
          streamType: best.streamType,
          embedUrl: null,
          matchedTitle: best.matchedTitle,
          langApplied: req.lang,
        };
      }
    } catch {
      // Try next Wikimedia query
    }
  }

  return { ok: false, embedUrl: null, langApplied: req.lang };
}

async function resolvePeerTube(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  const shortTitle = cleanTitleWords(req.title);
  const mediaLabel = req.type === 'movie' ? '' : `episode ${req.episode || 1}`;
  const queries = [
    `${shortTitle} ${mediaLabel}`.trim(),
    shortTitle,
    'korean drama',
    'asian drama',
  ];

  for (const query of queries) {
    try {
      const apiUrl = `https://sepiasearch.org/api/v1/search/videos?search=${encodeURIComponent(
        query
      )}&count=6&nsfw=false`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(4500) });
      if (!res.ok) continue;

      const data = (await res.json()) as {
        data?: {
          uuid?: string;
          name?: string;
          url?: string;
          embedUrl?: string;
        }[];
      };
      const items = (data.data || []).filter(v => Boolean(v?.embedUrl || v?.url));
      if (items.length === 0) continue;

      for (const item of items.slice(0, 3)) {
        if (item.url && item.uuid) {
          try {
            const origin = new URL(item.url).origin;
            const detailRes = await fetch(`${origin}/api/v1/videos/${encodeURIComponent(item.uuid)}`, {
              signal: AbortSignal.timeout(3500),
            });
            if (detailRes.ok) {
              const detail = (await detailRes.json()) as {
                streamingPlaylists?: { playlistUrl?: string; files?: { fileUrl?: string }[] }[];
                files?: { fileUrl?: string }[];
              };
              const hlsUrl = detail.streamingPlaylists?.[0]?.playlistUrl;
              const mp4Url =
                detail.streamingPlaylists?.[0]?.files?.[0]?.fileUrl || detail.files?.[0]?.fileUrl;
              if (hlsUrl || mp4Url) {
                return {
                  ok: true,
                  streamUrl: hlsUrl || mp4Url,
                  streamType: hlsUrl ? 'hls' : 'mp4',
                  embedUrl: item.embedUrl ? `${item.embedUrl}?autoplay=1` : null,
                  matchedTitle: item.name || shortTitle,
                  langApplied: req.lang,
                };
              }
            }
          } catch {
            // Fall through to official PeerTube embedUrl
          }
        }

        if (item.embedUrl) {
          return {
            ok: true,
            embedUrl: `${item.embedUrl}${item.embedUrl.includes('?') ? '&' : '?'}autoplay=1`,
            matchedTitle: item.name || shortTitle,
            langApplied: req.lang,
          };
        }
      }
    } catch {
      // Try next PeerTube query
    }
  }

  return { ok: false, embedUrl: null, langApplied: req.lang };
}

export async function resolveDynamicEmbed(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  if (req.provider === 'dailymotion') return resolveDailymotion(req);
  if (req.provider === 'archive') return resolveInternetArchive(req);
  if (req.provider === 'wikimedia') return resolveWikimediaCommons(req);
  if (req.provider === 'peertube') return resolvePeerTube(req);
  return resolveYouTube(req);
}
