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

async function fetchJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} for ${url}`);
  return res.json();
}

async function fetchDiscoverDramas() {
  const endpoints = [
    `${BASE_URL}/trending/tv/week?api_key=${TMDB_API_KEY}`,
    `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=KR&sort_by=popularity.desc&page=1`,
    `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=CN&sort_by=popularity.desc&page=1`,
    `${BASE_URL}/discover/tv?api_key=${TMDB_API_KEY}&with_origin_country=JP&sort_by=popularity.desc&page=1`,
  ];

  const candidateIds = new Set();
  const asianCountries = new Set(['KR', 'CN', 'TW', 'HK', 'JP', 'IN', 'TH']);

  for (const url of endpoints) {
    try {
      const data = await fetchJson(url);
      for (const item of data.results || []) {
        const origins = item.origin_country || [];
        if (origins.some(code => asianCountries.has(code)) && item.poster_path) {
          candidateIds.add(item.id);
        }
      }
    } catch (err) {
      console.warn(`Warning fetching discover endpoint: ${err.message}`);
    }
  }

  return Array.from(candidateIds).slice(0, 25);
}

async function buildDramaRecord(tmdbId) {
  const data = await fetchJson(
    `${BASE_URL}/tv/${tmdbId}?api_key=${TMDB_API_KEY}&append_to_response=credits`
  );
  const title = data.name || data.original_name;
  if (!title || !data.poster_path) return null;

  const slug = slugify(title);
  if (!slug) return null;

  const country = mapCountry(data.origin_country);
  const year = data.first_air_date ? parseInt(data.first_air_date.slice(0, 4), 10) || 2025 : 2025;
  const totalEpisodes = Math.max(1, Number(data.number_of_episodes) || 16);
  const genres = Array.isArray(data.genres) && data.genres.length > 0
    ? data.genres.map(g => g.name).slice(0, 4)
    : ['Drama', 'Romance'];

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

  return {
    id: slug,
    slug,
    tmdbId: data.id,
    title,
    hindiTitle: `${title} (Hindi Dubbed)`,
    country,
    year,
    rating: rating > 0 ? rating : 8.1,
    views: `${Math.max(12, Math.round((data.popularity || 40) * 1.4))}K`,
    duration: `${data.episode_run_time?.[0] || 45} min`,
    totalEpisodes,
    genres,
    overview:
      data.overview ||
      `Watch ${title} Hindi Dubbed full episodes online in HD on HindiDrama.net.`,
    poster: `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    backdrop: data.backdrop_path
      ? `https://image.tmdb.org/t/p/original${data.backdrop_path}`
      : `https://image.tmdb.org/t/p/w500${data.poster_path}`,
    status: data.status === 'Returning Series' ? 'Ongoing' : 'Completed',
    type: 'tv',
    language: 'Hindi Dubbed',
    latestEpisode: totalEpisodes,
    cast,
    updatedAt: new Date().toISOString(),
  };
}

async function main() {
  const existing = JSON.parse(fs.readFileSync(DRAMAS_PATH, 'utf-8'));
  const bySlug = new Map(existing.map(d => [d.slug, d]));
  const byTmdb = new Map(existing.filter(d => d.tmdbId).map(d => [d.tmdbId, d]));

  console.log(`Loaded ${existing.length} existing dramas. Discovering latest TMDB Asian dramas...`);
  const ids = await fetchDiscoverDramas();
  let added = 0;
  let refreshed = 0;

  for (const id of ids) {
    try {
      const fresh = await buildDramaRecord(id);
      if (!fresh) continue;

      const prev = byTmdb.get(id) || bySlug.get(fresh.slug);
      if (prev) {
        // Keep curated title/slug/views stable while refreshing episode counts, ratings, and cast
        const updated = {
          ...prev,
          totalEpisodes: Math.max(prev.totalEpisodes || 1, fresh.totalEpisodes),
          latestEpisode: Math.max(prev.latestEpisode || 1, fresh.latestEpisode),
          rating: fresh.rating || prev.rating,
          cast: fresh.cast.length > 0 ? fresh.cast : prev.cast,
          updatedAt: fresh.updatedAt,
        };
        bySlug.set(prev.slug, updated);
        refreshed++;
      } else {
        bySlug.set(fresh.slug, fresh);
        byTmdb.set(fresh.tmdbId, fresh);
        added++;
      }
    } catch (err) {
      console.warn(`Skipped TMDB ID ${id}: ${err.message}`);
    }
  }

  const merged = Array.from(bySlug.values());
  fs.writeFileSync(DRAMAS_PATH, JSON.stringify(merged, null, 2) + '\n', 'utf-8');
  console.log(`TMDB Auto-Sync Complete: ${added} new dramas added, ${refreshed} refreshed. Total catalog: ${merged.length}`);
}

main().catch(err => {
  console.error('TMDB Auto-Sync failed:', err);
  process.exit(1);
});
