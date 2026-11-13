import type { AudioLanguageCode } from '../types/drama.ts';

export interface ResolveEmbedRequest {
  provider: 'dailymotion' | 'youtube';
  title: string;
  tmdbId: number;
  type?: 'tv' | 'movie';
  season?: number;
  episode?: number;
  lang: AudioLanguageCode;
  strictHindiOnly?: boolean;
  apiKey?: string;
}

export interface ResolveEmbedResult {
  ok: boolean;
  embedUrl: string | null;
  matchedTitle?: string;
  langApplied: AudioLanguageCode;
}

const LANG_CONFIG: Record<
  AudioLanguageCode,
  { keyword: string; fallbackKeyword: string; tmdbTag: string; excludeIfEnglish?: RegExp }
> = {
  hi: { keyword: 'Hindi Dubbed', fallbackKeyword: 'Hindi', tmdbTag: 'hi-IN' },
  en: { keyword: 'English Dubbed', fallbackKeyword: 'English Sub', tmdbTag: 'en-US', excludeIfEnglish: /\bhindi\b/i },
  ko: { keyword: 'Korean', fallbackKeyword: 'Korean Audio', tmdbTag: 'ko-KR' },
  ta: { keyword: 'Tamil Dubbed', fallbackKeyword: 'Tamil', tmdbTag: 'ta-IN' },
  te: { keyword: 'Telugu Dubbed', fallbackKeyword: 'Telugu', tmdbTag: 'te-IN' },
};

async function resolveDailymotion(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  const cfg = LANG_CONFIG[req.lang] || LANG_CONFIG.hi;
  const mediaLabel = req.type === 'movie' ? 'Full Movie' : `Episode ${req.episode || 1}`;
  const queries = [
    `${req.title} ${mediaLabel} ${cfg.keyword}`,
    `${req.title} ${mediaLabel} ${cfg.fallbackKeyword}`,
    `${req.title} ${cfg.fallbackKeyword}`,
  ];

  for (const query of queries) {
    try {
      const apiUrl = `https://api.dailymotion.com/videos?search=${encodeURIComponent(
        query
      )}&fields=id,title,language,duration&limit=8&sort=relevance`;
      const res = await fetch(apiUrl, { signal: AbortSignal.timeout(3500) });
      if (!res.ok) continue;
      const data = (await res.json()) as {
        list?: { id: string; title: string; language?: string; duration?: number }[];
      };
      const items = data.list || [];
      if (items.length === 0) continue;

      // Strictly score by both drama title match and selected audio language (Hindi vs English)
      const langWord = cfg.fallbackKeyword.toLowerCase();
      const titleWords = req.title
        .toLowerCase()
        .split(/\s+/)
        .filter(w => w.length > 2);

      const scored = items
        .map(v => {
          const lowerTitle = (v.title || '').toLowerCase();
          let score = 0;
          if (req.lang === 'en' && cfg.excludeIfEnglish?.test(lowerTitle)) score -= 10;
          if (req.lang === 'hi' || req.strictHindiOnly) {
            if (/hindi\s*(dubbed|audio|mein|explain)?/i.test(lowerTitle)) score += 10;
            if ((v.language || '').toLowerCase() === 'hi') score += 6;
            if (/eng(lish)?\s*sub|raw|korean\s*audio/i.test(lowerTitle) && !/hindi/i.test(lowerTitle)) score -= 8;
          } else if (lowerTitle.includes(langWord) || (v.language || '').toLowerCase() === req.lang) {
            score += 4;
          }
          const matchedWords = titleWords.filter(w => lowerTitle.includes(w)).length;
          score += matchedWords * 2;
          return { item: v, score };
        })
        .sort((a, b) => b.score - a.score);

      const chosen = scored[0]?.item || items[0];
      if (chosen?.id) {
        return {
          ok: true,
          embedUrl: `https://www.dailymotion.com/embed/video/${chosen.id}?autoplay=1&ui-highlight=2563eb`,
          matchedTitle: chosen.title,
          langApplied: req.lang,
        };
      }
    } catch {
      // Try next fallback query
    }
  }

  return { ok: false, embedUrl: null, langApplied: req.lang };
}

async function resolveYouTube(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  const cfg = LANG_CONFIG[req.lang] || LANG_CONFIG.hi;
  const apiKey = req.apiKey || '174d0214bf933dd59b3d5ec68a0c967f';
  const mediaType = req.type === 'movie' ? 'movie' : 'tv';
  const mediaLabel = mediaType === 'movie' ? 'full movie' : `episode ${req.episode || 1}`;
  const queries = [
    `${req.title} ${mediaLabel} ${cfg.keyword}`,
    `${req.title} ${mediaLabel} ${cfg.fallbackKeyword}`,
  ];

  // 1. Live YouTube search resolution matching drama + episode/movie + selected language
  for (const query of queries) {
    try {
      const searchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}&hl=${req.lang}`;
      const res = await fetch(searchUrl, {
        headers: {
          'User-Agent':
            'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
          'Accept-Language': `${cfg.tmdbTag},${req.lang};q=0.9,en;q=0.8`,
        },
        signal: AbortSignal.timeout(3500),
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

  // 2. TMDB Videos API fallback using active TMDB API key & requested language
  for (const langParam of [cfg.tmdbTag, 'en-US', '']) {
    try {
      const qs = langParam ? `&language=${langParam}` : '';
      const tmdbRes = await fetch(
        `https://api.themoviedb.org/3/${mediaType}/${req.tmdbId}/videos?api_key=${apiKey}${qs}`,
        { signal: AbortSignal.timeout(3000) }
      );
      if (!tmdbRes.ok) continue;
      const data = (await tmdbRes.json()) as {
        results?: { site: string; key: string; name?: string; iso_639_1?: string }[];
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

export async function resolveDynamicEmbed(req: ResolveEmbedRequest): Promise<ResolveEmbedResult> {
  if (req.provider === 'dailymotion') {
    return resolveDailymotion(req);
  }
  return resolveYouTube(req);
}
