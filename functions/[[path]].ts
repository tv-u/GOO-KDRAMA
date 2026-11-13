import baseDramas from '../src/data/dramas.json';
import { renderPage } from '../src/entry-server.tsx';
import { slugifyText } from '../src/services/seo.ts';
import type { CastMember, CastProfile, Drama } from '../src/types/drama.ts';
import type { CFContext } from './types.ts';

const DEFAULT_TMDB_KEY = '174d0214bf933dd59b3d5ec68a0c967f';

async function fetchTmdbCreditsEdge(
  tmdbId: number,
  apiKey: string,
  type: 'tv' | 'movie' = 'tv'
): Promise<CastMember[]> {
  try {
    const res = await fetch(
      `https://api.themoviedb.org/3/${type}/${tmdbId}/credits?api_key=${apiKey}`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (!res.ok) return [];
    const data = (await res.json()) as { cast?: any[] };
    return (data.cast || []).slice(0, 12).map(actor => ({
      id: actor.id,
      slug: `${actor.id}-${slugifyText(actor.name || 'actor')}`,
      name: actor.name || 'Unknown Cast',
      character: actor.character || 'Main Role',
      profilePath: actor.profile_path
        ? `https://image.tmdb.org/t/p/w342${actor.profile_path}`
        : 'https://image.tmdb.org/t/p/w342/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      popularity: actor.popularity || 0,
    }));
  } catch {
    return [];
  }
}

async function fetchCastProfileEdge(castSlug: string, apiKey: string): Promise<CastProfile | null> {
  try {
    let personId: number | null = null;
    const idMatch = castSlug.match(/^(\d+)(?:-|$)/);
    if (idMatch) {
      personId = parseInt(idMatch[1], 10);
    } else {
      const q = castSlug.replace(/-/g, ' ');
      const searchRes = await fetch(
        `https://api.themoviedb.org/3/search/person?api_key=${apiKey}&query=${encodeURIComponent(q)}`,
        { signal: AbortSignal.timeout(2500) }
      );
      if (searchRes.ok) {
        const searchData = (await searchRes.json()) as { results?: any[] };
        personId = searchData.results?.[0]?.id || null;
      }
    }

    if (!personId) return null;

    const res = await fetch(
      `https://api.themoviedb.org/3/person/${personId}?api_key=${apiKey}&append_to_response=combined_credits`,
      { signal: AbortSignal.timeout(3000) }
    );
    if (!res.ok) return null;
    const data = (await res.json()) as any;

    const rawCredits: any[] = data.combined_credits?.cast || [];
    const seen = new Set<number>();
    const credits = rawCredits
      .filter(
        c =>
          (c.media_type === 'tv' || c.media_type === 'movie') &&
          c.poster_path &&
          !seen.has(c.id) &&
          seen.add(c.id)
      )
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
  } catch {
    return null;
  }
}

async function fetchDramaBySlugFallbackEdge(slug: string, apiKey: string): Promise<Drama | null> {
  try {
    const query = slug.replace(/-/g, ' ').trim();
    if (!query) return null;
    const searchRes = await fetch(
      `https://api.themoviedb.org/3/search/multi?api_key=${apiKey}&query=${encodeURIComponent(query)}&include_adult=false`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (!searchRes.ok) return null;
    const searchData = (await searchRes.json()) as { results?: any[] };
    const hit = (searchData.results || []).find(r => r.media_type === 'tv' || r.media_type === 'movie');
    if (!hit) return null;

    const mediaType: 'tv' | 'movie' = hit.media_type === 'movie' ? 'movie' : 'tv';
    const detailRes = await fetch(
      `https://api.themoviedb.org/3/${mediaType}/${hit.id}?api_key=${apiKey}&append_to_response=credits`,
      { signal: AbortSignal.timeout(2500) }
    );
    if (!detailRes.ok) return null;
    const data = (await detailRes.json()) as any;
    const title = data.name || data.title || query;

    let country = 'Korean';
    const c = data.origin_country?.[0];
    if (c === 'CN' || c === 'TW' || c === 'HK') country = 'Chinese';
    else if (c === 'JP') country = 'Japanese';
    else if (c === 'IN') country = 'Indian';
    else if (c === 'TH') country = 'Thai';

    const yearStr = data.first_air_date || data.release_date || '2025';
    const year = parseInt(yearStr.slice(0, 4), 10) || 2025;
    const totalEpisodes = data.number_of_episodes || (mediaType === 'movie' ? 1 : 16);

    return {
      id: slug,
      slug,
      tmdbId: data.id,
      title,
      hindiTitle: `${title} (Hindi Dubbed)`,
      country,
      year,
      rating: data.vote_average ? Number(data.vote_average.toFixed(1)) : 8.1,
      views: '12K',
      duration: `${data.episode_run_time?.[0] || 45} min`,
      totalEpisodes,
      genres: (data.genres || []).map((g: any) => g.name).slice(0, 4) || ['Drama', 'Romance'],
      overview: data.overview || `Watch ${title} Hindi Dubbed full episodes online in HD on HindiDrama.net.`,
      poster: data.poster_path
        ? `https://image.tmdb.org/t/p/w500${data.poster_path}`
        : 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      backdrop: data.backdrop_path
        ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
        : 'https://image.tmdb.org/t/p/original/2DxbreN5QiYYc5KT3zW7c7Sn8Zg.jpg',
      status: 'Completed',
      type: mediaType,
      language: 'Hindi Dubbed',
      latestEpisode: totalEpisodes,
      cast: (data.credits?.cast || []).slice(0, 10).map((actor: any) => ({
        id: actor.id,
        slug: `${actor.id}-${slugifyText(actor.name || 'actor')}`,
        name: actor.name || 'Cast Member',
        character: actor.character || 'Main Role',
        profilePath: actor.profile_path
          ? `https://image.tmdb.org/t/p/w342${actor.profile_path}`
          : 'https://image.tmdb.org/t/p/w342/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
        popularity: actor.popularity || 0,
      })),
    };
  } catch {
    return null;
  }
}

export async function onRequestGet(context: CFContext): Promise<Response> {
  const url = new URL(context.request.url);
  const pathOnly = url.pathname;

  // Let static assets, API calls, robots, and sitemap pass straight through
  if (
    pathOnly.startsWith('/api/') ||
    pathOnly.startsWith('/assets/') ||
    pathOnly === '/sitemap.xml' ||
    pathOnly === '/robots.txt' ||
    pathOnly === '/favicon.svg' ||
    pathOnly === '/manifest.webmanifest' ||
    /\.[a-zA-Z0-9]{2,6}$/.test(pathOnly)
  ) {
    return context.next();
  }

  const origin = (context.env.SITE_URL || url.origin).replace(/\/$/, '');
  const apiKey = context.env.TMDB_API_KEY || DEFAULT_TMDB_KEY;
  const dramas: Drama[] = (baseDramas as Drama[]).map(d => ({ ...d }));

  try {
    // Pre-fetch cast credits or TMDB fallback for /drama/:slug and /watch/:slug/episode-:ep
    const dramaOrWatchMatch =
      pathOnly.match(/^\/drama\/([^/]+)$/i) || pathOnly.match(/^\/watch\/([^/]+)\/episode-\d+$/i);
    if (dramaOrWatchMatch) {
      const slug = decodeURIComponent(dramaOrWatchMatch[1]).toLowerCase();
      let target = dramas.find(d => d.slug.toLowerCase() === slug);

      if (!target) {
        const fetched = await fetchDramaBySlugFallbackEdge(slug, apiKey);
        if (fetched) {
          dramas.unshift(fetched);
          target = fetched;
        }
      } else if (pathOnly.startsWith('/drama/') && (!target.cast || target.cast.length === 0) && target.tmdbId) {
        const cast = await fetchTmdbCreditsEdge(target.tmdbId, apiKey, target.type || 'tv');
        if (cast.length > 0) {
          target.cast = cast;
        }
      }
    }

    // Pre-fetch actor profile on /cast/:slug
    let castProfile: CastProfile | null = null;
    const castMatch = pathOnly.match(/^\/cast\/([^/]+)$/i);
    if (castMatch) {
      castProfile = await fetchCastProfileEdge(decodeURIComponent(castMatch[1]), apiKey);
    }

    // Fetch built index.html template from Cloudflare Pages ASSETS
    const templateRes = await context.env.ASSETS.fetch(new URL('/index.html', url.origin));
    if (!templateRes.ok) {
      return context.next();
    }
    const templateHtml = await templateRes.text();

    const fullPath = url.pathname + url.search;
    const { appHtml, headTags, statusCode } = renderPage({
      url: fullPath,
      origin,
      dramas,
      castProfile,
    });

    const safeStateJson = JSON.stringify({ dramas, castProfile, origin }).replace(
      /<\/script/gi,
      '<\\/script'
    );
    const stateScript = `<script>window.__INITIAL_STATE__=${safeStateJson};</script>`;

    const finalHtml = templateHtml
      .replace(/<!--SEO_HEAD_START-->[\s\S]*?<!--SEO_HEAD_END-->/, headTags)
      .replace('<!--SSR_OUTLET-->', appHtml)
      .replace('<!--INITIAL_STATE-->', stateScript);

    return new Response(finalHtml, {
      status: statusCode,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': url.searchParams.has('q')
          ? 'no-store'
          : 'public, s-maxage=300, stale-while-revalidate=86400',
        'X-Robots-Tag': url.searchParams.has('q')
          ? 'noindex, follow'
          : 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
        'X-SSR-Engine': 'HindiDrama-Cloudflare-Edge-SSR',
      },
    });
  } catch (err) {
    console.error('Cloudflare Edge SSR fallback:', err);
    // Safe fallback to static ASSETS index.html
    return context.env.ASSETS.fetch(new URL('/index.html', url.origin));
  }
}
