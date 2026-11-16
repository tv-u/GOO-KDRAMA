import type { CastMember, CastProfile, Drama, TmdbEpisodeMeta } from '../types/drama.ts';
import baseDramas from '../data/dramas.json';
import { slugifyText } from './seo.ts';

export const TMDB_API_KEY =
  (typeof import.meta !== 'undefined' && (import.meta as any).env?.VITE_TMDB_API_KEY) ||
  '174d0214bf933dd59b3d5ec68a0c967f';
const BASE_URL = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p/w500';
const BACKDROP_BASE = 'https://image.tmdb.org/t/p/original';

// Local storage key for dynamically synced dramas
const CUSTOM_DRAMAS_KEY = 'hindidrama_custom_synced';

export function getLocalSyncedDramas(): Drama[] {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return [];
  try {
    const raw = localStorage.getItem(CUSTOM_DRAMAS_KEY);
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveLocalSyncedDrama(drama: Drama): void {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') return;
  try {
    const existing = getLocalSyncedDramas();
    const filtered = existing.filter(d => d.slug !== drama.slug);
    localStorage.setItem(CUSTOM_DRAMAS_KEY, JSON.stringify([drama, ...filtered]));
  } catch (e) {
    console.error('Failed to save custom drama', e);
  }
}

export function getAllDramas(extraDramas: Drama[] = [], includeLocal = true): Drama[] {
  const custom = includeLocal ? getLocalSyncedDramas() : [];
  const allMap = new Map<string, Drama>();

  (baseDramas as Drama[]).forEach(d => {
    allMap.set(d.slug, d);
  });

  extraDramas.forEach(d => {
    allMap.set(d.slug, d);
  });

  custom.forEach(d => {
    allMap.set(d.slug, d);
  });

  return Array.from(allMap.values());
}

export function getDramaBySlug(slug: string, extraDramas: Drama[] = []): Drama | undefined {
  const all = getAllDramas(extraDramas);
  const lower = slug.toLowerCase();
  const exact = all.find(d => d.slug.toLowerCase() === lower || d.id.toLowerCase() === lower);
  if (exact) return exact;
  const trailingId = lower.match(/(?:^|-)(\d+)$/)?.[1];
  if (trailingId) {
    return all.find(d => String(d.tmdbId) === trailingId);
  }
  return undefined;
}

export async function searchTMDB(query: string): Promise<any[]> {
  if (!query.trim()) return [];
  try {
    const res = await fetch(
      `${BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(query)}&include_adult=false`
    );
    if (!res.ok) return [];
    const data = await res.json();
    return (data.results || []).filter((item: any) => item.media_type === 'tv' || item.media_type === 'movie');
  } catch (err) {
    console.error('TMDB Search error', err);
    return [];
  }
}

export async function fetchTrendingTMDB(): Promise<any[]> {
  try {
    const res = await fetch(`${BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return data.results || [];
  } catch (err) {
    console.error('TMDB Trending error', err);
    return [];
  }
}

const TV_GENRE_MAP: Record<number, string> = {
  10759: 'Action & Adventure',
  16: 'Animation',
  35: 'Comedy',
  80: 'Crime',
  99: 'Documentary',
  18: 'Drama',
  10751: 'Family',
  10762: 'Kids',
  9648: 'Mystery',
  10763: 'News',
  10764: 'Reality',
  10765: 'Sci-Fi & Fantasy',
  10766: 'Soap',
  10767: 'Talk',
  10768: 'War & Politics',
  37: 'Western',
};

const MOVIE_GENRE_MAP: Record<number, string> = {
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

function mapGenreIds(ids: unknown, mediaType: 'tv' | 'movie'): string[] {
  if (!Array.isArray(ids) || ids.length === 0) return mediaType === 'movie' ? ['Action', 'Thriller'] : ['Drama', 'Romance'];
  const table = mediaType === 'movie' ? MOVIE_GENRE_MAP : TV_GENRE_MAP;
  const mapped = ids.map(id => table[Number(id)]).filter(Boolean);
  return mapped.length > 0 ? mapped.slice(0, 3) : ['Drama', 'Romance'];
}

export interface LatestAiringEpisodeItem {
  drama: Drama;
  season: number;
  episode: number;
  episodeName: string;
  airDate?: string;
  stillUrl: string;
  isOngoing: boolean;
}

export async function fetchKoreanDramasTMDB(page = 1): Promise<Drama[]> {
  try {
    const res = await fetchTmdbWithRetry(
      `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko&sort_by=popularity.desc&page=${page}`
    );
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.results || [])
      .filter((item: any) => Boolean(item.poster_path))
      .map((item: any) => {
        const title = item.name || item.original_name || 'Korean Drama';
        const slug = slugifyText(title);
        const year = item.first_air_date ? parseInt(item.first_air_date.slice(0, 4), 10) : 2025;
        return {
          id: slug,
          slug,
          tmdbId: item.id,
          title,
          hindiTitle: `${title} (Hindi Dubbed & Korean)`,
          country: 'Korean' as const,
          year,
          rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : 8.2,
          views: `${Math.max(12, Math.floor(item.popularity || 120))}K`,
          duration: '60 min',
          totalEpisodes: 16,
          genres: mapGenreIds(item.genre_ids, 'tv'),
          overview: item.overview || `Watch ${title} online with auto-episode sync & multi-source playback.`,
          poster: `${IMAGE_BASE}${item.poster_path}`,
          backdrop: item.backdrop_path ? `${BACKDROP_BASE}${item.backdrop_path}` : `${IMAGE_BASE}${item.poster_path}`,
          status: year >= 2025 ? ('Ongoing' as const) : ('Completed' as const),
          type: 'tv' as const,
          language: 'Korean & Hindi Dub',
          latestEpisode: 16,
          season: 1,
          popularityScore: Number(item.popularity || 0),
          cast: [],
        };
      });
  } catch (err) {
    console.error('Failed to fetch Korean dramas from TMDB', err);
    return [];
  }
}

export async function fetchTrendingKoreanMoviesTMDB(page = 1): Promise<Drama[]> {
  try {
    const res = await fetchTmdbWithRetry(
      `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_original_language=ko&sort_by=popularity.desc&page=${page}`
    );
    if (!res || !res.ok) return [];
    const data = await res.json();
    return (data.results || [])
      .filter((item: any) => Boolean(item.poster_path))
      .map((item: any) => {
        const title = item.title || item.original_title || 'Korean Movie';
        const slug = slugifyText(title);
        const year = item.release_date ? parseInt(item.release_date.slice(0, 4), 10) : 2025;
        return {
          id: slug,
          slug,
          tmdbId: item.id,
          title,
          hindiTitle: `${title} (Korean / Hindi Dub)`,
          country: 'Korean' as const,
          year,
          rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : 7.9,
          views: `${Math.max(10, Math.floor(item.popularity || 95))}K`,
          duration: '118 min',
          totalEpisodes: 1,
          genres: mapGenreIds(item.genre_ids, 'movie'),
          overview: item.overview || `Stream ${title} full movie in HD with multi-source server support.`,
          poster: `${IMAGE_BASE}${item.poster_path}`,
          backdrop: item.backdrop_path ? `${BACKDROP_BASE}${item.backdrop_path}` : `${IMAGE_BASE}${item.poster_path}`,
          status: 'Completed' as const,
          type: 'movie' as const,
          language: 'Korean & Hindi Dub',
          latestEpisode: 1,
          season: 1,
          popularityScore: Number(item.popularity || 0),
          cast: [],
        };
      });
  } catch (err) {
    console.error('Failed to fetch Korean movies from TMDB', err);
    return [];
  }
}

/**
 * Fetches live airing & recently updated K-Dramas from TMDB, hydrating each show's
 * real last_episode_to_air metadata for DramaCool-style homepage auto-updates.
 */
export async function fetchLatestKDramaEpisodesTMDB(limit = 18): Promise<{
  dramas: Drama[];
  episodes: LatestAiringEpisodeItem[];
}> {
  try {
    const today = new Date();
    const pastWindow = new Date(today.getTime() - 90 * 86_400_000).toISOString().slice(0, 10);
    const todayIso = today.toISOString().slice(0, 10);

    const [airingDiscoverRes, popularDiscoverRes, onTheAirRes] = await Promise.all([
      fetchTmdbWithRetry(
        `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko&air_date.gte=${pastWindow}&air_date.lte=${todayIso}&sort_by=popularity.desc&page=1`
      ),
      fetchTmdbWithRetry(
        `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_original_language=ko&sort_by=popularity.desc&page=1`
      ),
      fetchTmdbWithRetry(`${BASE_URL}/tv/on_the_air?api_key=${TMDB_API_KEY}&page=1`),
    ]);

    const pool = new Map<number, any>();
    const collect = async (res: Response | null, onlyKorean = false) => {
      if (!res || !res.ok) return;
      const json = await res.json();
      for (const item of json.results || []) {
        if (!item?.id || !item.poster_path) continue;
        if (onlyKorean && item.original_language !== 'ko') continue;
        if (!pool.has(item.id)) pool.set(item.id, item);
      }
    };

    await Promise.all([
      collect(airingDiscoverRes, false),
      collect(onTheAirRes, true),
      collect(popularDiscoverRes, false),
    ]);

    const candidates = Array.from(pool.values()).slice(0, limit);
    if (candidates.length === 0) return { dramas: [], episodes: [] };

    const detailResults = await Promise.allSettled(
      candidates.map(async item => {
        const res = await fetchTmdbWithRetry(`${BASE_URL}/tv/${item.id}?api_key=${TMDB_API_KEY}`);
        if (!res || !res.ok) return null;
        return res.json();
      })
    );

    const dramas: Drama[] = [];
    const episodes: LatestAiringEpisodeItem[] = [];

    detailResults.forEach((result, idx) => {
      const baseItem = candidates[idx];
      const detail = result.status === 'fulfilled' && result.value ? result.value : null;

      const title = detail?.name || baseItem.name || baseItem.original_name || 'Korean Drama';
      const slug = slugifyText(title);
      const airStr = detail?.first_air_date || baseItem.first_air_date || '2025';
      const year = parseInt(String(airStr).slice(0, 4), 10) || 2025;
      const lastEp = detail?.last_episode_to_air;
      const latestEpNum = Number(lastEp?.episode_number) || Number(detail?.number_of_episodes) || 12;
      const latestSeason = Number(lastEp?.season_number) || 1;
      const totalEps = Math.max(latestEpNum, Number(detail?.number_of_episodes) || latestEpNum || 16);
      const showStatus = detail?.status || '';
      const isOngoing =
        showStatus === 'Returning Series' ||
        showStatus === 'In Production' ||
        Boolean(detail?.next_episode_to_air);

      const genres =
        Array.isArray(detail?.genres) && detail.genres.length > 0
          ? detail.genres.map((g: any) => g.name).slice(0, 3)
          : mapGenreIds(baseItem.genre_ids, 'tv');

      const posterUrl = detail?.poster_path
        ? `${IMAGE_BASE}${detail.poster_path}`
        : `${IMAGE_BASE}${baseItem.poster_path}`;
      const backdropPath = detail?.backdrop_path || baseItem.backdrop_path || detail?.poster_path || baseItem.poster_path;
      const backdropUrl = `${BACKDROP_BASE}${backdropPath}`;
      const stillPath = lastEp?.still_path || detail?.backdrop_path || baseItem.backdrop_path || baseItem.poster_path;
      const stillUrl = `https://image.tmdb.org/t/p/w500${stillPath}`;

      const dramaObj: Drama = {
        id: slug,
        slug,
        tmdbId: baseItem.id,
        title,
        hindiTitle: `${title} (Hindi Dubbed & Korean)`,
        country: 'Korean',
        year,
        rating: detail?.vote_average
          ? Number(detail.vote_average.toFixed(1))
          : baseItem.vote_average
            ? Number(baseItem.vote_average.toFixed(1))
            : 8.3,
        views: `${Math.max(15, Math.floor(detail?.popularity || baseItem.popularity || 140))}K`,
        duration: `${detail?.episode_run_time?.[0] || lastEp?.runtime || 60} min`,
        totalEpisodes: totalEps,
        genres,
        overview:
          detail?.overview ||
          baseItem.overview ||
          `Stream ${title} online in HD with multi-source auto-episode sync.`,
        poster: posterUrl,
        backdrop: backdropUrl,
        status: isOngoing ? 'Ongoing' : 'Completed',
        type: 'tv',
        language: 'Korean & Hindi Dub',
        latestEpisode: latestEpNum,
        season: latestSeason,
        seasons: Array.isArray(detail?.seasons)
          ? detail.seasons
              .filter((s: any) => Number(s.season_number) > 0 && (s.episode_count || 0) > 0)
              .map((s: any) => ({
                seasonNumber: Number(s.season_number),
                name: s.name || `Season ${s.season_number}`,
                episodeCount: Number(s.episode_count) || 1,
                airDate: s.air_date || undefined,
                poster: s.poster_path ? `${IMAGE_BASE}${s.poster_path}` : undefined,
              }))
          : undefined,
        popularityScore: Number(detail?.popularity || baseItem.popularity || 0),
        updatedAt: lastEp?.air_date || undefined,
        cast: [],
      };

      dramas.push(dramaObj);
      episodes.push({
        drama: dramaObj,
        season: latestSeason,
        episode: latestEpNum,
        episodeName: lastEp?.name || `Episode ${latestEpNum}`,
        airDate: lastEp?.air_date || detail?.last_air_date || undefined,
        stillUrl,
        isOngoing,
      });
    });

    episodes.sort((a, b) => {
      const dateA = a.airDate ? Date.parse(a.airDate) : 0;
      const dateB = b.airDate ? Date.parse(b.airDate) : 0;
      if (dateB !== dateA) return dateB - dateA;
      return (b.drama.popularityScore || 0) - (a.drama.popularityScore || 0);
    });

    return { dramas, episodes };
  } catch (err) {
    console.error('Failed to fetch latest airing K-Drama episodes from TMDB', err);
    return { dramas: [], episodes: [] };
  }
}

export async function fetchDramaCredits(tmdbId: number, type: 'tv' | 'movie' = 'tv'): Promise<CastMember[]> {
  try {
    const res = await fetch(`${BASE_URL}/${type}/${tmdbId}/credits?api_key=${TMDB_API_KEY}`);
    if (!res.ok) return [];
    const data = await res.json();
    return ((data.cast || []) as any[])
      .slice(0, 12)
      .map(actor => ({
        id: actor.id,
        slug: `${actor.id}-${slugifyText(actor.name || 'actor')}`,
        name: actor.name || 'Unknown Cast',
        character: actor.character || 'Main Cast',
        profilePath: actor.profile_path
          ? `https://image.tmdb.org/t/p/w342${actor.profile_path}`
          : 'https://image.tmdb.org/t/p/w342/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
        popularity: actor.popularity || 0,
      }));
  } catch (err) {
    console.error('TMDB Credits fetch error', err);
    return [];
  }
}

export async function fetchCastDetails(castSlugOrId: string): Promise<CastProfile | null> {
  try {
    let personId: number | null = null;
    const idMatch = castSlugOrId.match(/^(\d+)(?:-|$)/);
    if (idMatch) {
      personId = parseInt(idMatch[1], 10);
    } else {
      const searchQuery = castSlugOrId.replace(/-/g, ' ');
      const searchRes = await fetch(
        `${BASE_URL}/search/person?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}`
      );
      if (searchRes.ok) {
        const searchData = await searchRes.json();
        personId = searchData.results?.[0]?.id || null;
      }
    }

    if (!personId) return null;

    const res = await fetch(
      `${BASE_URL}/person/${personId}?api_key=${TMDB_API_KEY}&append_to_response=combined_credits`
    );
    if (!res.ok) return null;
    const data = await res.json();

    const rawCastCredits: any[] = data.combined_credits?.cast || [];
    const uniqueMap = new Map<number, any>();
    rawCastCredits.forEach(item => {
      if ((item.media_type === 'tv' || item.media_type === 'movie') && item.poster_path && !uniqueMap.has(item.id)) {
        uniqueMap.set(item.id, item);
      }
    });

    const credits = Array.from(uniqueMap.values())
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
          poster: `${IMAGE_BASE}${item.poster_path}`,
          rating: item.vote_average ? Number(item.vote_average.toFixed(1)) : 8.0,
          mediaType: (item.media_type === 'movie' ? 'movie' : 'tv') as 'tv' | 'movie',
        };
      });

    return {
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
  } catch (err) {
    console.error('Failed to fetch cast profile from TMDB:', err);
    return null;
  }
}

export async function fetchDramaDetailsFromTMDB(tmdbId: number, type: 'tv' | 'movie' = 'tv'): Promise<Drama | null> {
  try {
    const res = await fetch(`${BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,external_ids,videos`);
    if (!res.ok) return null;
    const data = await res.json();

    const title = data.name || data.title || 'Unknown Drama';
    const slug = slugifyText(title);

    let country = 'Korean';
    if (data.origin_country && data.origin_country.length > 0) {
      const c = data.origin_country[0];
      if (c === 'CN' || c === 'TW' || c === 'HK') country = 'Chinese';
      else if (c === 'JP') country = 'Japanese';
      else if (c === 'IN') country = 'Indian';
      else if (c === 'KR') country = 'Korean';
      else if (c === 'TH') country = 'Thai';
    }

    const year = data.first_air_date
      ? parseInt(data.first_air_date.slice(0, 4), 10)
      : data.release_date
        ? parseInt(data.release_date.slice(0, 4), 10)
        : 2024;
    const totalEpisodes = data.number_of_episodes || (type === 'movie' ? 1 : 16);
    const genres = (data.genres || []).map((g: any) => g.name);
    const cast: CastMember[] = ((data.credits?.cast || []) as any[]).slice(0, 12).map(actor => ({
      id: actor.id,
      slug: `${actor.id}-${slugifyText(actor.name || 'actor')}`,
      name: actor.name || 'Cast Member',
      character: actor.character || 'Main Role',
      profilePath: actor.profile_path
        ? `https://image.tmdb.org/t/p/w342${actor.profile_path}`
        : 'https://image.tmdb.org/t/p/w342/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      popularity: actor.popularity || 0,
    }));

    const ytTrailer = (data.videos?.results || []).find(
      (v: any) => v.site === 'YouTube' && v.key
    );

    const drama: Drama = {
      id: slug,
      slug,
      tmdbId,
      imdbId: data.external_ids?.imdb_id || data.imdb_id || undefined,
      tvdbId: data.external_ids?.tvdb_id ? Number(data.external_ids.tvdb_id) : undefined,
      youtubeKey: ytTrailer?.key || undefined,
      title,
      hindiTitle: `${title} (Hindi Dubbed)`,
      country,
      year,
      rating: data.vote_average ? Number(data.vote_average.toFixed(1)) : 8.0,
      views: '1.5K',
      duration: '45 min',
      totalEpisodes,
      genres: genres.length > 0 ? genres : ['Drama', 'Romance'],
      overview: data.overview || `Watch ${title} Hindi Dubbed full episodes online in HD on HindiDrama.net.`,
      poster: data.poster_path
        ? `${IMAGE_BASE}${data.poster_path}`
        : 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      backdrop: data.backdrop_path
        ? `${BACKDROP_BASE}${data.backdrop_path}`
        : data.poster_path
          ? `${IMAGE_BASE}${data.poster_path}`
          : 'https://image.tmdb.org/t/p/original/2DxbreN5QiYYc5KT3zW7c7Sn8Zg.jpg',
      status: data.status === 'Ended' ? 'Completed' : 'Completed',
      type,
      language: 'Hindi Dubbed',
      latestEpisode: totalEpisodes,
      cast,
      updatedAt: new Date().toISOString(),
    };

    saveLocalSyncedDrama(drama);

    // Register with server SSR + Sitemap generator when running in browser
    if (typeof window !== 'undefined') {
      fetch('/api/dramas/sync', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(drama),
      }).catch(() => {});
    }

    return drama;
  } catch (err) {
    console.error('Failed to fetch details from TMDB', err);
    return null;
  }
}

export async function fetchTmdbEpisodeSync(
  tmdbId: number,
  season: number,
  episode: number,
  type: 'tv' | 'movie' = 'tv'
): Promise<TmdbEpisodeMeta | null> {
  if (!tmdbId) return null;
  try {
    const showReq = fetchTmdbWithRetry(
      `${BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=external_ids,videos`
    );
    const epReq =
      type === 'tv'
        ? fetchTmdbWithRetry(`${BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`)
        : Promise.resolve(null);

    const [showRes, epRes] = await Promise.all([showReq, epReq]);
    if (!showRes || !showRes.ok) return null;

    const showData = await showRes.json();
    const epData = epRes && epRes.ok ? await epRes.json() : null;

    const title = showData.name || showData.title || 'Asian Drama';
    const episodeName =
      epData?.name || (type === 'movie' ? `${title} Full Movie` : `Episode ${episode}`);
    const overview =
      epData?.overview ||
      showData.overview ||
      `Stream ${title} Episode ${episode} in Hindi Dubbed HD on HindiDrama.net.`;
    const backdropPath = epData?.still_path || showData.backdrop_path || showData.poster_path;
    const ytTrailer = (showData.videos?.results || []).find(
      (v: any) => v.site === 'YouTube' && v.key
    );

    return {
      title,
      episodeName,
      overview,
      backdrop: backdropPath
        ? `${BACKDROP_BASE}${backdropPath}`
        : 'https://image.tmdb.org/t/p/original/2DxbreN5QiYYc5KT3zW7c7Sn8Zg.jpg',
      runtime: epData?.runtime || showData.episode_run_time?.[0] || 45,
      imdbId: showData.external_ids?.imdb_id || showData.imdb_id || undefined,
      youtubeKey: ytTrailer?.key || undefined,
      spokenLanguages: Array.isArray(showData.spoken_languages) ? showData.spoken_languages : [],
    };
  } catch (err) {
    console.error('TMDB episode metadata sync failed:', err);
    return null;
  }
}

const seasonCache = new Map<string, { data: import('../types/drama.ts').EpisodeDetail[]; ts: number }>();
const showSeasonsCache = new Map<number, { data: import('../types/drama.ts').SeasonSummary[]; ts: number }>();

async function fetchTmdbWithRetry(url: string, retries = 2): Promise<Response | null> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(url);
      if (res.status === 429 && attempt < retries) {
        const retryAfter = Number(res.headers.get('retry-after') || '1');
        await new Promise(r => setTimeout(r, Math.min(3000, Math.max(400, retryAfter * 1000))));
        continue;
      }
      return res;
    } catch {
      if (attempt === retries) return null;
      await new Promise(r => setTimeout(r, 350 * (attempt + 1)));
    }
  }
  return null;
}

export async function fetchTmdbShowSeasons(
  tmdbId: number
): Promise<import('../types/drama.ts').SeasonSummary[]> {
  if (!tmdbId) return [];
  const cached = showSeasonsCache.get(tmdbId);
  if (cached && Date.now() - cached.ts < 1_800_000) return cached.data;

  try {
    const res = await fetchTmdbWithRetry(`${BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}`);
    if (!res || !res.ok) return [];
    const data = await res.json();
    const seasons: import('../types/drama.ts').SeasonSummary[] = (data.seasons || [])
      .filter((s: any) => Number(s.season_number) > 0 && (s.episode_count || 0) > 0)
      .map((s: any) => ({
        seasonNumber: Number(s.season_number),
        name: s.name || `Season ${s.season_number}`,
        episodeCount: Number(s.episode_count) || 1,
        airDate: s.air_date || undefined,
        poster: s.poster_path ? `${IMAGE_BASE}${s.poster_path}` : undefined,
      }));
    showSeasonsCache.set(tmdbId, { data: seasons, ts: Date.now() });
    return seasons;
  } catch {
    return [];
  }
}

export async function fetchTmdbSeasonEpisodes(
  tmdbId: number,
  seasonNumber = 1
): Promise<import('../types/drama.ts').EpisodeDetail[]> {
  if (!tmdbId) return [];
  const key = `${tmdbId}:s${seasonNumber}`;
  const cached = seasonCache.get(key);
  if (cached && Date.now() - cached.ts < 1_800_000) return cached.data;

  try {
    const res = await fetchTmdbWithRetry(
      `${BASE_URL}/tv/${tmdbId}/season/${seasonNumber}?api_key=${TMDB_API_KEY}`
    );
    if (!res || !res.ok) return [];
    const data = await res.json();
    const eps: import('../types/drama.ts').EpisodeDetail[] = (data.episodes || []).map((ep: any) => ({
      seasonNumber,
      episodeNumber: Number(ep.episode_number) || 1,
      name: ep.name || `Episode ${ep.episode_number}`,
      overview: ep.overview || `Stream Episode ${ep.episode_number} in HD with multi-source fallback.`,
      airDate: ep.air_date || undefined,
      stillUrl: ep.still_path ? `https://image.tmdb.org/t/p/w500${ep.still_path}` : undefined,
      runtime: Number(ep.runtime) || undefined,
    }));
    seasonCache.set(key, { data: eps, ts: Date.now() });
    return eps;
  } catch {
    return [];
  }
}
