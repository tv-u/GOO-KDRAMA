import fs from 'node:fs';
import path from 'node:path';

const ROOT = process.cwd();
const DRAMAS_PATH = path.resolve(ROOT, 'src/data/dramas.json');
const TMDB_API_KEY = process.env.TMDB_API_KEY || '174d0214bf933dd59b3d5ec68a0c967f';
const BASE_URL = 'https://api.themoviedb.org/3';

function slugify(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

function mapCountry(originCountries) {
  const c = Array.isArray(originCountries) && originCountries.length > 0 ? originCountries[0] : 'KR';
  if (c === 'CN' || c === 'TW' || c === 'HK') return 'Chinese';
  if (c === 'JP') return 'Japanese';
  if (c === 'IN') return 'Indian';
  if (c === 'TH') return 'Thai';
  return 'Korean';
}

async function fetchJson(url, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.status === 429 && attempt < retries) {
      const wait = Math.min(3000, Number(res.headers.get('retry-after') || '1') * 1000);
      await new Promise(r => setTimeout(r, wait));
      continue;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
    return res.json();
  }
  throw new Error(`Rate-limit exceeded for ${url}`);
}

async function fetchDiscoverDramas() {
  const endpoints = [
    { url: `${BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`, type: 'tv' },
    { url: `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=KR&sort_by=popularity.desc&page=1`, type: 'tv' },
    { url: `${BASE_URL}/discover/movie?api_key=${TMDB_API_KEY}&with_origin_country=KR&sort_by=popularity.desc&page=1`, type: 'movie' },
    { url: `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=CN&sort_by=popularity.desc&page=1`, type: 'tv' },
    { url: `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=JP&sort_by=popularity.desc&page=1`, type: 'tv' },
  ];

  const targets = [];
  const seen = new Set();
  const asianCountries = new Set(['KR', 'CN', 'TW', 'HK', 'JP', 'IN', 'TH']);

  for (const ep of endpoints) {
    try {
      const data = await fetchJson(ep.url);
      for (const item of data.results || []) {
        const origins = item.origin_country || [];
        const langOk = item.original_language === 'ko' || item.original_language === 'zh' || item.original_language === 'ja';
        if ((ep.type === 'movie' || origins.some(code => asianCountries.has(code)) || langOk) && item.poster_path) {
          const key = `${ep.type}:${item.id}`;
          if (!seen.has(key)) {
            seen.add(key);
            targets.push({ id: item.id, type: ep.type });
          }
        }
      }
    } catch (err) {
      console.warn(`Warning fetching discover endpoint: ${err.message}`);
    }
  }

  return targets.slice(0, 32);
}

async function buildDramaRecord(tmdbId, mediaType = 'tv') {
  const data = await fetchJson(
    `${BASE_URL}/${mediaType}/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits,external_ids,videos`
  );
  const title = data.name || data.title || data.original_name || data.original_title;
  if (!title || !data.poster_path) return null;

  const slug = slugify(title);
  if (!slug) return null;

  const country = mapCountry(
    data.origin_country || (data.production_countries || []).map(c => c.iso_3166_1)
  );
  const dateStr = data.first_air_date || data.release_date || '2025';
  const year = parseInt(dateStr.slice(0, 4), 10) || 2025;
  const totalEpisodes = mediaType === 'movie' ? 1 : Math.max(1, Number(data.number_of_episodes) || 16);
  const genres = Array.isArray(data.genres) && data.genres.length > 0
    ? data.genres.map(g => g.name).slice(0, 5)
    : ['Drama', 'Romance'];

  const seasons = mediaType === 'tv' && Array.isArray(data.seasons)
    ? data.seasons
        .filter(s => Number(s.season_number) > 0 && (s.episode_count || 0) > 0)
        .map(s => ({
          seasonNumber: Number(s.season_number),
          name: s.name || `Season ${s.season_number}`,
          episodeCount: Number(s.episode_count) || 1,
          airDate: s.air_date || undefined,
          poster: s.poster_path ? `https://image.tmdb.org/t/p/w342${s.poster_path}` : undefined,
        }))
    : undefined;

  const cast = (data.credits?.cast || []).slice(0, 8).map(actor => ({
    id: actor.id,
    slug: `${actor.id}-${slugify(actor.name || 'actor')}`,
    name: actor.name || 'Cast Member',
    character: actor.character || 'Main Role',
    profilePath: actor.profile_path
      ? `https://image.tmdb.org/t/p/w342${actor.profile_path}`
      : 'https://image.tmdb.org/t/p/w342/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
    popularity: actor.popularity || 0,
  }));

  const rating = data.vote_average ? Number(data.vote_average.toFixed(1)) : 8.2;
  const duration = mediaType === 'movie'
    ? `${data.runtime || 115} min`
    : `${data.episode_run_time?.[0] || 45} min`;

  const ytTrailer = (data.videos?.results || []).find(v => v.site === 'YouTube' && v.key);

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
    rating: rating > 0 ? rating : 8.1,
    views: `${Math.max(12, Math.round((data.popularity || 40) * 1.4))}K`,
    duration,
    totalEpisodes,
    genres,
    overview:
      data.overview ||
      `Watch ${title} Hindi Dubbed full ${mediaType === 'movie' ? 'movie' : 'episodes'} online in HD on HindiDrama.net.`,
    poster: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    backdrop: data.backdrop_path
      ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
      : `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    status: data.status === 'Returning Series' ? 'Ongoing' : 'Completed',
    type: mediaType,
    language: 'Hindi Dubbed',
    latestEpisode: totalEpisodes,
    seasons,
    cast,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(DRAMAS_PATH, 'utf-8'));
  const bySlug = new Map(existing.map(d => [d.slug, d]));
  const byTmdb = new Map(existing.filter(d => d.tmdbId).map(d => [`${d.type || 'tv'}:${d.tmdbId}`, d]));

  console.log(`Loaded ${existing.length} existing dramas. Discovering latest TMDB K-Dramas & Asian Movies...`);
  const targets = await fetchDiscoverDramas();
  let added = 0;
  let refreshed = 0;

  for (const target of targets) {
    try {
      const fresh = await buildDramaRecord(target.id, target.type);
      if (!fresh) continue;

      const prev = byTmdb.get(`${target.type}:${target.id}`) || bySlug.get(fresh.slug);
      if (prev) {
        const updated = {
          ...prev,
          imdbId: prev.imdbId || fresh.imdbId,
          tvdbId: prev.tvdbId || fresh.tvdbId,
          youtubeKey: prev.youtubeKey || fresh.youtubeKey,
          overview: prev.overview && prev.overview.length > 30 ? prev.overview : fresh.overview,
          poster: prev.poster || fresh.poster,
          backdrop: prev.backdrop || fresh.backdrop,
          totalEpisodes: Math.max(prev.totalEpisodes || 1, fresh.totalEpisodes),
          latestEpisode: Math.max(prev.latestEpisode || 1, fresh.latestEpisode),
          seasons: fresh.seasons && fresh.seasons.length > 0 ? fresh.seasons : prev.seasons,
          rating: fresh.rating || prev.rating,
          cast: fresh.cast.length > 0 ? fresh.cast : prev.cast,
          updatedAt: fresh.updatedAt,
        };
        bySlug.set(prev.slug, updated);
        refreshed++;
      } else {
        bySlug.set(fresh.slug, fresh);
        byTmdb.set(`${target.type}:${fresh.tmdbId}`, fresh);
        added++;
      }
    } catch (err) {
      console.warn(`Skipped TMDB ${target.type}/${target.id}: ${err.message}`);
    }
  }

  const merged = Array.from(bySlug.values());
  fs.writeFileSync(DRAMAS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log(`TMDB Auto-Sync Complete: ${added} new titles added, ${refreshed} refreshed. Total catalog: ${merged.length}`);
}

main().catch(err => {
  console.error('TMDB Auto-Sync failed:', err);
  process.exit(1);
});
