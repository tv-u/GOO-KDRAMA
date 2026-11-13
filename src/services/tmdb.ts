import type { CastMember, CastProfile, Drama, TmdbEpisodeMeta } from '../types/drama.ts';
import baseDramas from '../data/dramas.json';
import { slugifyText } from './seo.ts';

export const TMDB_API_KEY = '174d0214bf933dd59b3d5ec68a0c967f';
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

export function getAllDramas(extraDramas: Drama[] = []): Drama[] {
  const custom = getLocalSyncedDramas();
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
  return all.find(d => d.slug.toLowerCase() === slug.toLowerCase() || d.id === slug);
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
    const res = await fetch(`${BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`);
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

    const drama: Drama = {
      id: slug,
      slug,
      tmdbId,
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
    const showReq = fetch(`${BASE_URL}/${type}/${tmdbId}?api_key=${TMDB_API_KEY}`);
    const epReq =
      type === 'tv'
        ? fetch(`${BASE_URL}/tv/${tmdbId}/season/${season}/episode/${episode}?api_key=${TMDB_API_KEY}`)
        : Promise.resolve(null);

    const [showRes, epRes] = await Promise.all([showReq, epReq]);
    if (!showRes.ok) return null;

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

    return {
      title,
      episodeName,
      overview,
      backdrop: backdropPath
        ? `${BACKDROP_BASE}${backdropPath}`
        : 'https://image.tmdb.org/t/p/original/2DxbreN5QiYYc5KT3zW7c7Sn8Zg.jpg',
      runtime: epData?.runtime || showData.episode_run_time?.[0] || 45,
      spokenLanguages: Array.isArray(showData.spoken_languages) ? showData.spoken_languages : [],
    };
  } catch (err) {
    console.error('TMDB episode metadata sync failed:', err);
    return null;
  }
}

