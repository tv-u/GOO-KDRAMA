import type { CastMember, Drama, SeasonSummary } from '../types/drama.ts';
import { slugifyText } from './seo.ts';

const TMDB_BASE = 'https://api.themoviedb.org/3';

function mapOriginCountry(origins: string[] = []): string {
  const code = origins[0] || 'KR';
  if (code === 'CN' || code === 'TW' || code === 'HK') return 'Chinese';
  if (code === 'JP') return 'Japanese';
  if (code === 'IN') return 'Indian';
  if (code === 'TH') return 'Thai';
  if (code === 'KR') return 'Korean';
  return 'Korean';
}

async function fetchJsonWithRetry(url: string, retries = 2): Promise<any> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(7000) });
    if (res.status === 429 && attempt < retries) {
      const wait = Math.min(3500, Math.max(500, Number(res.headers.get('retry-after') || '1') * 1000));
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`TMDB HTTP ${res.status}`);
    return res.json();
  }
  throw new Error('TMDB rate limit retries exceeded');
}

async function fetchAndBuildRecord(
  tmdbId: number,
  mediaType: 'tv' | 'movie',
  apiKey: string
): Promise<Drama | null> {
  const data = await fetchJsonWithRetry(
    `${TMDB_BASE}/${mediaType}/${tmdbId}?api_key=${apiKey}&append_to_response=credits,external_ids,videos`
  );
  const title = data.name || data.title || data.original_name || data.original_title;
  if (!title || !data.poster_path) return null;

  const slug = slugifyText(title);
  if (!slug) return null;

  const country = mapOriginCountry(
    data.origin_country || (data.production_countries || []).map((c: any) => c.iso_3166_1)
  );
  const dateStr = data.first_air_date || data.release_date || '2025';
  const year = parseInt(dateStr.slice(0, 4), 10) || 2025;
  const totalEpisodes = mediaType === 'movie' ? 1 : Math.max(1, Number(data.number_of_episodes) || 16);
  const genres: string[] =
    Array.isArray(data.genres) && data.genres.length > 0
      ? data.genres.map((g: any) => g.name).slice(0, 5)
      : ['Drama'];

  const seasons: SeasonSummary[] | undefined =
    mediaType === 'tv' && Array.isArray(data.seasons)
      ? data.seasons
          .filter((s: any) => Number(s.season_number) > 0 && (s.episode_count || 0) > 0)
          .map((s: any) => ({
            seasonNumber: Number(s.season_number),
            name: s.name || `Season ${s.season_number}`,
            episodeCount: Number(s.episode_count) || 1,
            airDate: s.air_date || undefined,
            poster: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : undefined,
          }))
      : undefined;

  const cast: CastMember[] = ((data.credits?.cast || []) as any[]).slice(0, 10).map(actor => ({
    id: actor.id,
    slug: `${actor.id}-${slugifyText(actor.name || 'actor')}`,
    name: actor.name || 'Cast Member',
    character: actor.character || 'Main Role',
    profilePath: actor.profile_path
      ? `https://image.tmdb.org/t/p/w342${actor.profile_path}`
      : 'https://image.tmdb.org/t/p/w342/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
    popularity: actor.popularity || 0,
  }));

  const rating = data.vote_average ? Number(data.vote_average.toFixed(1)) : 8.0;
  const runtime =
    mediaType === 'movie'
      ? `${data.runtime || 115} min`
      : `${data.episode_run_time?.[0] || 50} min`;

  const ytTrailer = ((data.videos?.results || []) as any[]).find(v => v.site === 'YouTube' && v.key);

  return {
    id: slug,
    slug,
    tmdbId: data.id,
    imdbId: data.external_ids?.imdb_id || data.imdb_id || undefined,
    tvdbId: data.external_ids?.tvdb_id ? Number(data.external_ids.tvdb_id) : undefined,
    youtubeKey: ytTrailer?.key || undefined,
    title,
    hindiTitle: `${title} (Hindi Dubbed)`,
    country,
    year,
    rating: rating > 0 ? rating : 7.8,
    views: `${Math.max(12, Math.round((data.popularity || 35) * 1.4))}K`,
    duration: runtime,
    totalEpisodes,
    genres,
    overview:
      data.overview ||
      `Watch ${title} (${year}) Hindi Dubbed full ${mediaType === 'movie' ? 'movie' : 'episodes'} online in HD on HindiDrama.net.`,
    poster: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    backdrop: data.backdrop_path
      ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
      : `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    status: data.status === 'Returning Series' || data.status === 'In Production' ? 'Ongoing' : 'Completed',
    type: mediaType,
    language: 'Hindi Dubbed',
    latestEpisode: totalEpisodes,
    season: seasons && seasons.length > 0 ? seasons[seasons.length - 1].seasonNumber : 1,
    seasons,
    cast,
    updatedAt: new Date().toISOString(),
    popularityScore: Number(data.popularity) || 50,
  };
}

export async function runAutomatedTmdbSync(params: {
  existingDramas: Drama[];
  apiKey: string;
  customTmdbId?: number;
  customType?: 'tv' | 'movie';
}): Promise<{
  mergedDramas: Drama[];
  added: number;
  updated: number;
  episodesDiscovered: number;
  duplicatesSkipped: number;
  errors: string[];
}> {
  const { existingDramas, apiKey, customTmdbId, customType } = params;
  const bySlug = new Map<string, Drama>(existingDramas.map(d => [d.slug, d]));
  const byTmdb = new Map<string, Drama>();
  for (const d of existingDramas) {
    if (d.tmdbId) byTmdb.set(`${d.type || 'tv'}:${d.tmdbId}`, d);
  }

  let added = 0;
  let updated = 0;
  let episodesDiscovered = 0;
  let duplicatesSkipped = 0;
  const errors: string[] = [];

  const targets: { id: number; type: 'tv' | 'movie' }[] = [];

  if (customTmdbId) {
    targets.push({ id: customTmdbId, type: customType || 'tv' });
  } else {
    const discoverEndpoints: { url: string; type: 'tv' | 'movie' }[] = [
      { url: `${TMDB_BASE}/trending/tv/week?api_key=${apiKey}`, type: 'tv' },
      { url: `${TMDB_BASE}/discover/tv?api_key=${apiKey}&with_origin_country=KR&sort_by=popularity.desc&page=1`, type: 'tv' },
      { url: `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_origin_country=KR&sort_by=popularity.desc&page=1`, type: 'movie' },
      { url: `${TMDB_BASE}/discover/tv?api_key=${apiKey}&with_origin_country=CN&sort_by=popularity.desc&page=1`, type: 'tv' },
      { url: `${TMDB_BASE}/discover/tv?api_key=${apiKey}&with_origin_country=JP&with_genres=16&sort_by=popularity.desc&page=1`, type: 'tv' },
    ];

    const asianCountries = new Set(['KR', 'CN', 'TW', 'HK', 'JP', 'IN', 'TH']);
    const seenTarget = new Set<string>();

    for (const ep of discoverEndpoints) {
      try {
        const data = await fetchJsonWithRetry(ep.url);
        for (const item of (data.results || []).slice(0, 8)) {
          if (!item.poster_path) continue;
          const origins = item.origin_country || [];
          const langOk = item.original_language === 'ko' || item.original_language === 'zh' || item.original_language === 'ja' || item.original_language === 'hi';
          if (ep.type === 'tv' && origins.length > 0 && !origins.some((c: string) => asianCountries.has(c)) && !langOk) {
            continue;
          }
          const key = `${ep.type}:${item.id}`;
          if (!seenTarget.has(key)) {
            seenTarget.add(key);
            targets.push({ id: item.id, type: ep.type });
          }
        }
      } catch (err) {
        errors.push(`Discover failed (${ep.type}): ${err instanceof Error ? err.message : 'Unknown'}`);
      }
    }
  }

  for (const target of targets.slice(0, 28)) {
    try {
      const fresh = await fetchAndBuildRecord(target.id, target.type, apiKey);
      if (!fresh) continue;

      const prevByTmdb = byTmdb.get(`${target.type}:${fresh.tmdbId}`);
      const prevBySlug = bySlug.get(fresh.slug);
      const prev = prevByTmdb || prevBySlug;

      if (prev) {
        if (prev.tmdbId && fresh.tmdbId && prev.tmdbId !== fresh.tmdbId) {
          duplicatesSkipped += 1;
          continue;
        }
        const prevEpCount = prev.totalEpisodes || 1;
        const newEpCount = Math.max(prevEpCount, fresh.totalEpisodes);
        if (newEpCount > prevEpCount) {
          episodesDiscovered += newEpCount - prevEpCount;
        }
        const merged: Drama = {
          ...prev,
          imdbId: prev.imdbId || fresh.imdbId,
          tvdbId: prev.tvdbId || fresh.tvdbId,
          youtubeKey: prev.youtubeKey || fresh.youtubeKey,
          overview: prev.overview && prev.overview.length > 30 ? prev.overview : fresh.overview,
          poster: prev.poster || fresh.poster,
          backdrop: prev.backdrop || fresh.backdrop,
          rating: fresh.rating || prev.rating,
          totalEpisodes: newEpCount,
          latestEpisode: Math.max(prev.latestEpisode || 1, fresh.latestEpisode),
          seasons: fresh.seasons && fresh.seasons.length > 0 ? fresh.seasons : prev.seasons,
          cast: fresh.cast && fresh.cast.length > 0 ? fresh.cast : prev.cast,
          status: fresh.status || prev.status,
          updatedAt: fresh.updatedAt,
        };
        bySlug.set(prev.slug, merged);
        updated += 1;
      } else {
        bySlug.set(fresh.slug, fresh);
        byTmdb.set(`${target.type}:${fresh.tmdbId}`, fresh);
        episodesDiscovered += fresh.totalEpisodes || 1;
        added += 1;
      }
    } catch (err) {
      errors.push(`TMDB ${target.type}/${target.id}: ${err instanceof Error ? err.message : 'Sync error'}`);
    }
  }

  return {
    mergedDramas: Array.from(bySlug.values()),
    added,
    updated,
    episodesDiscovered,
    duplicatesSkipped,
    errors,
  };
}

const MOVIE_GENRE_NAMES: Record<number, string> = {
  28: 'Action',
  12: 'Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  14: 'Fantasy',
  36: 'History',
  27: 'Horror',
  10402: 'Music',
  9648: 'Mystery',
  10749: 'Romance',
  878: 'Sci-Fi',
  10770: 'TV Movie',
  53: 'Thriller',
  10752: 'War',
  37: 'Western',
};

const TV_GENRE_NAMES: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  9648: 'Mystery',
  10765: 'Sci-Fi & Fantasy',
  10768: 'War & Politics',
};

function mapGenreIdsFast(ids: unknown, mediaType: 'tv' | 'movie'): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return mediaType === 'movie' ? ['Action', 'Drama'] : ['Drama', 'Romance'];
  const table = mediaType === 'movie' ? MOVIE_GENRE_NAMES : TV_GENRE_NAMES;
  const mapped = ids.map(id => table[Number(id)]).filter(Boolean);
  return mapped.length > 0 ? mapped.slice(0, 4) : ['Drama'];
}

function mapLanguageToCountry(origLang?: string, origins: string[] = []): string {
  if (origLang === 'ko') return 'Korean';
  if (origLang === 'zh' || origLang === 'cn') return 'Chinese';
  if (origLang === 'ja') return 'Japanese';
  if (origLang === 'hi' || origLang === 'ta' || origLang === 'te') return 'Indian';
  if (origLang === 'th') return 'Thai';
  return mapOriginCountry(origins);
}

function ensureUniqueSlug(
  baseTitle: string,
  _year: number,
  tmdbId: number,
  mediaType: 'tv' | 'movie',
  bySlug: Map<string, Drama>
): string {
  const rawSlug = slugifyText(baseTitle) || `${mediaType}`;
  // Industry-standard TMDB/IMDb pattern (title-tmdbid) eliminates duplicate name collisions forever
  const idSlug = `${rawSlug}-${tmdbId}`;
  const existingExact = bySlug.get(rawSlug);
  if (existingExact && existingExact.tmdbId === tmdbId && (existingExact.type || 'tv') === mediaType) {
    return rawSlug;
  }
  return idSlug;
}

/**
 * Fast, parallel bulk catalog auto-sync:
 * Discovers 500+ distinct Asian & Popular Movies + 120+ TV Dramas cleanly with unique 1-page slugs.
 */
export async function runBulkCatalogAutoSync(params: {
  existingDramas: Drama[];
  apiKey: string;
  targetMovies?: number;
  targetDramas?: number;
}): Promise<{
  mergedDramas: Drama[];
  addedMovies: number;
  addedDramas: number;
  totalMovies: number;
  totalDramas: number;
}> {
  const { existingDramas, apiKey, targetMovies = 520, targetDramas = 140 } = params;
  const bySlug = new Map<string, Drama>(existingDramas.map(d => [d.slug, d]));
  const byTmdbKey = new Map<string, Drama>();
  for (const d of existingDramas) {
    if (d.tmdbId) byTmdbKey.set(`${d.type || 'tv'}:${d.tmdbId}`, d);
  }

  let addedMovies = 0;
  let addedDramas = 0;

  // Build paginated TMDB discover urls for movies (32 pages ~= 600+ unique movies across Korean, Asian & global hits)
  const movieUrls: string[] = [];
  for (let p = 1; p <= 10; p++) {
    movieUrls.push(
      `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_original_language=ko&sort_by=popularity.desc&page=${p}`
    );
  }
  for (let p = 1; p <= 8; p++) {
    movieUrls.push(
      `${TMDB_BASE}/discover/movie?api_key=${apiKey}&with_original_language=ja|zh|hi|th&sort_by=popularity.desc&page=${p}`
    );
  }
  for (let p = 1; p <= 12; p++) {
    movieUrls.push(
      `${TMDB_BASE}/movie/popular?api_key=${apiKey}&page=${p}`
    );
  }
  for (let p = 1; p <= 5; p++) {
    movieUrls.push(
      `${TMDB_BASE}/movie/top_rated?api_key=${apiKey}&page=${p}`
    );
  }

  const tvUrls: string[] = [];
  for (let p = 1; p <= 5; p++) {
    tvUrls.push(
      `${TMDB_BASE}/discover/tv?api_key=${apiKey}&with_original_language=ko&sort_by=popularity.desc&page=${p}`
    );
  }
  for (let p = 1; p <= 3; p++) {
    tvUrls.push(
      `${TMDB_BASE}/discover/tv?api_key=${apiKey}&with_original_language=zh|ja&sort_by=popularity.desc&page=${p}`
    );
  }

  const fetchBatch = async (urls: string[]) => {
    const results: any[] = [];
    for (let i = 0; i < urls.length; i += 6) {
      const slice = urls.slice(i, i + 6);
      const settled = await Promise.allSettled(
        slice.map(u => fetchJsonWithRetry(u))
      );
      for (const s of settled) {
        if (s.status === 'fulfilled' && Array.isArray(s.value?.results)) {
          results.push(...s.value.results);
        }
      }
    }
    return results;
  };

  const [movieItems, tvItems] = await Promise.all([fetchBatch(movieUrls), fetchBatch(tvUrls)]);

  let currentMovieCount = Array.from(bySlug.values()).filter(d => d.type === 'movie').length;
  for (const item of movieItems) {
    if (currentMovieCount >= targetMovies) break;
    if (!item?.id || !item.poster_path) continue;
    const tmdbKey = `movie:${item.id}`;
    if (byTmdbKey.has(tmdbKey)) continue;

    const title = item.title || item.original_title;
    if (!title) continue;
    const year = item.release_date ? parseInt(String(item.release_date).slice(0, 4), 10) || 2024 : 2024;
    const slug = ensureUniqueSlug(title, year, item.id, 'movie', bySlug);
    const country = mapLanguageToCountry(item.original_language, item.origin_country);

    const record: Drama = {
      id: slug,
      slug,
      tmdbId: item.id,
      title,
      hindiTitle: `${title} (${year}) Hindi Dubbed & ${country}`,
      country,
      year,
      rating: item.vote_average ? Number(Number(item.vote_average).toFixed(1)) || 7.6 : 7.6,
      views: `${Math.max(14, Math.round((item.popularity || 40) * 1.3))}K`,
      duration: '118 min',
      totalEpisodes: 1,
      genres: mapGenreIdsFast(item.genre_ids, 'movie'),
      overview:
        item.overview ||
        `Watch ${title} (${year}) full movie online in 1080p HD with Hindi Dub, Korean Original, English Dub & Urdu audio on HindiDrama.net.`,
      poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      backdrop: item.backdrop_path
        ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
        : `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      status: 'Completed',
      type: 'movie',
      language: 'Hindi Dubbed & Multi Audio',
      latestEpisode: 1,
      season: 1,
      popularityScore: Number(item.popularity || 50),
      updatedAt: item.release_date ? `${item.release_date}T00:00:00Z` : new Date().toISOString(),
      cast: [],
    };

    bySlug.set(slug, record);
    byTmdbKey.set(tmdbKey, record);
    addedMovies += 1;
    currentMovieCount += 1;
  }

  let currentDramaCount = Array.from(bySlug.values()).filter(d => d.type !== 'movie').length;
  for (const item of tvItems) {
    if (currentDramaCount >= targetDramas) break;
    if (!item?.id || !item.poster_path) continue;
    const tmdbKey = `tv:${item.id}`;
    if (byTmdbKey.has(tmdbKey)) continue;

    const title = item.name || item.original_name;
    if (!title) continue;
    const year = item.first_air_date ? parseInt(String(item.first_air_date).slice(0, 4), 10) || 2024 : 2024;
    const slug = ensureUniqueSlug(title, year, item.id, 'tv', bySlug);
    const country = mapLanguageToCountry(item.original_language, item.origin_country);

    const record: Drama = {
      id: slug,
      slug,
      tmdbId: item.id,
      title,
      hindiTitle: `${title} (Hindi Dubbed & ${country})`,
      country,
      year,
      rating: item.vote_average ? Number(Number(item.vote_average).toFixed(1)) || 8.0 : 8.0,
      views: `${Math.max(18, Math.round((item.popularity || 55) * 1.4))}K`,
      duration: '55 min',
      totalEpisodes: 16,
      genres: mapGenreIdsFast(item.genre_ids, 'tv'),
      overview:
        item.overview ||
        `Watch ${title} (${year}) full episodes online in 1080p HD with HLX.proxy multi-audio on HindiDrama.net.`,
      poster: `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      backdrop: item.backdrop_path
        ? `https://image.tmdb.org/t/p/original${item.backdrop_path}`
        : `https://image.tmdb.org/t/p/w500${item.poster_path}`,
      status: year >= 2025 ? 'Ongoing' : 'Completed',
      type: 'tv',
      language: 'Korean & Hindi Dub',
      latestEpisode: 16,
      season: 1,
      popularityScore: Number(item.popularity || 50),
      updatedAt: item.first_air_date ? `${item.first_air_date}T00:00:00Z` : new Date().toISOString(),
      cast: [],
    };

    bySlug.set(slug, record);
    byTmdbKey.set(tmdbKey, record);
    addedDramas += 1;
    currentDramaCount += 1;
  }

  const mergedDramas = Array.from(bySlug.values());
  return {
    mergedDramas,
    addedMovies,
    addedDramas,
    totalMovies: mergedDramas.filter(d => d.type === 'movie').length,
    totalDramas: mergedDramas.filter(d => d.type !== 'movie').length,
  };
}

/**
 * Dynamically resolves any unknown movie or drama slug directly via TMDB API
 * so direct deep-links (/movie/:slug or /drama/:slug) always generate a real page.
 */
export async function resolveSlugViaTmdb(params: {
  slug: string;
  preferredType?: 'movie' | 'tv';
  apiKey: string;
}): Promise<Drama | null> {
  const { slug, preferredType, apiKey } = params;
  const cleanSlug = slug.trim().toLowerCase();
  if (!cleanSlug) return null;

  try {
    // Support trailing -<tmdbId> (e.g. parasite-496243, oldboy-670) or bare numeric ID on /movie, /drama, and /watch
    const trailingIdMatch = cleanSlug.match(/(?:^|-)(\d+)$/);
    if (trailingIdMatch) {
      const tmdbNum = Number(trailingIdMatch[1]);
      if (tmdbNum > 0) {
        const tryOrder: ('movie' | 'tv')[] =
          preferredType === 'movie'
            ? ['movie', 'tv']
            : preferredType === 'tv'
              ? ['tv', 'movie']
              : ['movie', 'tv'];
        for (const candidateType of tryOrder) {
          try {
            const built = await fetchAndBuildRecord(tmdbNum, candidateType, apiKey);
            if (built) {
              const titleSlug = slugifyText(built.title);
              // Sanity verify if slug had title prefix or bare ID
              const cleanPrefix = cleanSlug.replace(/-\d+$/, '');
              if (
                /^\d+$/.test(cleanSlug) ||
                !cleanPrefix ||
                titleSlug === cleanPrefix ||
                titleSlug.includes(cleanPrefix) ||
                cleanPrefix.includes(titleSlug) ||
                tryOrder.length === 1 ||
                candidateType === preferredType
              ) {
                return { ...built, slug: cleanSlug, id: cleanSlug };
              }
            }
          } catch {
            // Try fallback mediaType
          }
        }
      }
    }

    const cleanWords = cleanSlug
      .replace(/-\d{2,9}$/, '')
      .replace(/-/g, ' ')
      .trim();
    if (!cleanWords) return null;

    const endpoint =
      preferredType === 'movie'
        ? `${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(cleanWords)}&include_adult=false`
        : `${TMDB_BASE}/search/multi?api_key=${apiKey}&query=${encodeURIComponent(cleanWords)}&include_adult=false`;

    const searchData = await fetchJsonWithRetry(endpoint);
    const candidates = (searchData.results || []).filter(
      (r: any) =>
        (r.media_type === 'movie' || r.media_type === 'tv' || preferredType === 'movie') &&
        r.poster_path
    );
    if (candidates.length === 0) return null;

    const exact =
      candidates.find((c: any) => slugifyText(c.title || c.name || '') === cleanSlug) ||
      candidates[0];
    const resolvedType: 'movie' | 'tv' =
      preferredType === 'movie' || exact.media_type === 'movie' ? 'movie' : 'tv';

    const record = await fetchAndBuildRecord(Number(exact.id), resolvedType, apiKey);
    if (!record) return null;
    return { ...record, slug: cleanSlug, id: cleanSlug };
  } catch {
    return null;
  }
}
