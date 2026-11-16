import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import type { AppView, CastProfile, Drama, DramaCategory, SortOption } from './types/drama.ts';
import {
  getAllDramas,
  fetchKoreanDramasTMDB,
  fetchTrendingKoreanMoviesTMDB,
  fetchLatestKDramaEpisodesTMDB,
  saveLocalSyncedDrama,
  type LatestAiringEpisodeItem,
} from './services/tmdb.ts';
import { Search, X, Star, Play, Flame } from 'lucide-react';
import {
  getWatchHistory,
  getFavorites,
  removeWatchHistoryItem,
  trackPlatformEvent,
  type WatchHistoryItem,
} from './services/storage.ts';
import { applyClientSeo, buildSeoMetadata, slugifyText } from './services/seo.ts';
import { triggerSmartlinkWithCooldown } from './services/adsterra.ts';
import { Navbar } from './components/Navbar.tsx';
import { HeroSpotlight } from './components/HeroSpotlight.tsx';
import { HeroTop10 } from './components/HeroTop10.tsx';
import { LatestEpisodes } from './components/LatestEpisodes.tsx';
import { OttCarouselRow, mapDramaToCarouselItem } from './components/OttCarouselRow.tsx';
import { DramaGrid } from './components/DramaGrid.tsx';
import { WatchPlayer } from './components/WatchPlayer.tsx';
import { DramaDetail } from './components/DramaDetail.tsx';
import { MovieDetail } from './components/MovieDetail.tsx';
import { MoviesDirectory } from './components/MoviesDirectory.tsx';
import { GenrePage } from './components/GenrePage.tsx';
import { CastPage } from './components/CastPage.tsx';
import { LibraryPage } from './components/LibraryPage.tsx';
import { AdminDashboard } from './components/AdminDashboard.tsx';
import { SyncModal } from './components/SyncModal.tsx';
import { RequestModal } from './components/RequestModal.tsx';
import { StaticPages } from './components/StaticPages.tsx';
import { Footer } from './components/Footer.tsx';
import { FloatingTelegram } from './components/FloatingTelegram.tsx';
import { AdsterraBanner } from './components/AdsterraBanner.tsx';

export interface AppProps {
  initialUrl?: string;
  initialDramas?: Drama[];
  initialCastProfile?: CastProfile | null;
  origin?: string;
}

interface ParsedRoute {
  view: AppView;
  category: DramaCategory;
  searchQuery: string;
  dramaSlug: string;
  season: number;
  episode: number;
  moviesPage: number;
  forceHindiOnly: boolean;
  customWindowMode: boolean;
  initialServerId?: number;
  initialLang?: import('./types/drama.ts').AudioLanguageCode;
  genreSlug: string;
  castSlug: string;
  staticPage: 'dmca' | 'disclaimer' | 'privacy' | 'terms' | 'contact';
}

const BASE_PREFIX = (() => {
  const raw = typeof import.meta !== 'undefined' ? ((import.meta as any).env?.BASE_URL || '/') : '/';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
})();

function stripBasePrefix(rawPath: string): string {
  const clean = rawPath || '/';
  if (BASE_PREFIX && clean.startsWith(BASE_PREFIX)) {
    const rest = clean.slice(BASE_PREFIX.length);
    return rest.startsWith('/') ? rest : `/${rest}`;
  }
  return clean;
}

export function parseRouteUrl(rawUrl: string): ParsedRoute {
  const [rawPath, rawSearch = ''] = rawUrl.split('?');
  const path = stripBasePrefix(rawPath || '/');
  const search = new URLSearchParams(rawSearch);
  const forceHindiOnly = search.get('audio') === 'hindi' || search.get('hindiOnly') === '1';
  const customWindowMode = search.get('window') === '1';
  const rawServerParam = search.get('server');
  const parsedServerId = rawServerParam !== null && rawServerParam !== '' ? Number(rawServerParam) : undefined;
  const rawLangParam = search.get('lang') as import('./types/drama.ts').AudioLanguageCode | null;
  const validLang = rawLangParam && ['hi', 'ko', 'ta', 'te', 'en', 'ur'].includes(rawLangParam) ? rawLangParam : undefined;
  const rawSeasonParam = search.get('season');
  const parsedSeasonParam = rawSeasonParam ? parseInt(rawSeasonParam, 10) : 1;

  const base: ParsedRoute = {
    view: 'home',
    category: 'all',
    searchQuery: '',
    dramaSlug: '',
    season: Number.isFinite(parsedSeasonParam) && parsedSeasonParam > 0 ? parsedSeasonParam : 1,
    episode: 1,
    moviesPage: 1,
    forceHindiOnly,
    customWindowMode,
    initialServerId: Number.isFinite(parsedServerId) ? parsedServerId : undefined,
    initialLang: validLang,
    genreSlug: '',
    castSlug: '',
    staticPage: 'dmca',
  };

  const q = search.get('q');
  if (q) {
    return { ...base, view: 'home', searchQuery: q };
  }

  const watchSeasonMatch = path.match(/^\/watch\/([^/]+)\/season-(\d+)\/episode-(\d+)$/i);
  if (watchSeasonMatch) {
    return {
      ...base,
      view: 'watch',
      dramaSlug: decodeURIComponent(watchSeasonMatch[1]),
      season: parseInt(watchSeasonMatch[2], 10) || 1,
      episode: parseInt(watchSeasonMatch[3], 10) || 1,
    };
  }

  const watchMatch = path.match(/^\/watch\/([^/]+)\/episode-(\d+)$/i);
  if (watchMatch) {
    return {
      ...base,
      view: 'watch',
      dramaSlug: decodeURIComponent(watchMatch[1]),
      episode: parseInt(watchMatch[2], 10) || 1,
    };
  }

  const watchBareMatch = path.match(/^\/watch\/([^/]+)$/i);
  if (watchBareMatch) {
    return {
      ...base,
      view: 'watch',
      dramaSlug: decodeURIComponent(watchBareMatch[1]),
      episode: 1,
    };
  }

  const moviePageMatch = path.match(/^\/movie\/([^/]+)$/i);
  if (moviePageMatch) {
    return { ...base, view: 'movie', dramaSlug: decodeURIComponent(moviePageMatch[1]) };
  }

  if (path === '/movies') {
    return { ...base, view: 'movies', category: 'movies', moviesPage: 1 };
  }

  const moviesPaginatedMatch = path.match(/^\/movies\/page\/(\d+)$/i);
  if (moviesPaginatedMatch) {
    return {
      ...base,
      view: 'movies',
      category: 'movies',
      moviesPage: Math.max(1, parseInt(moviesPaginatedMatch[1], 10) || 1),
    };
  }

  const dramaMatch = path.match(/^\/drama\/([^/]+)$/i);
  if (dramaMatch) {
    return { ...base, view: 'detail', dramaSlug: decodeURIComponent(dramaMatch[1]) };
  }

  const genreMatch = path.match(/^\/genre\/([^/]+)$/i);
  if (genreMatch) {
    return { ...base, view: 'genre', genreSlug: decodeURIComponent(genreMatch[1]).toLowerCase() };
  }

  const castMatch = path.match(/^\/cast\/([^/]+)$/i);
  if (castMatch) {
    return { ...base, view: 'cast', castSlug: decodeURIComponent(castMatch[1]) };
  }

  const catMatch = path.match(/^\/category\/([^/]+)$/i);
  if (catMatch) {
    const cat = decodeURIComponent(catMatch[1]).toLowerCase() as DramaCategory;
    if (cat === 'movies') {
      return { ...base, view: 'movies', category: 'movies', moviesPage: 1 };
    }
    return { ...base, view: 'home', category: cat };
  }

  if (path === '/library') return { ...base, view: 'library' };
  if (path === '/admin') return { ...base, view: 'admin' };
  if (path === '/dmca') return { ...base, view: 'static', staticPage: 'dmca' };
  if (path === '/disclaimer') return { ...base, view: 'static', staticPage: 'disclaimer' };
  if (path === '/privacy-policy' || path === '/privacy') return { ...base, view: 'static', staticPage: 'privacy' };
  if (path === '/terms') return { ...base, view: 'static', staticPage: 'terms' };
  if (path === '/contact') return { ...base, view: 'static', staticPage: 'contact' };

  return base;
}

export default function App({
  initialUrl,
  initialDramas,
  initialCastProfile = null,
  origin = 'https://hindidrama.net',
}: AppProps) {
  const startingUrl =
    initialUrl ||
    (typeof window !== 'undefined' ? window.location.pathname + window.location.search : '/');

  const initialParsed = parseRouteUrl(startingUrl);

  const [dramas, setDramas] = useState<Drama[]>(() => getAllDramas(initialDramas || [], false));
  const [currentCategory, setCurrentCategory] = useState<DramaCategory>(initialParsed.category);
  const [searchQuery, setSearchQuery] = useState<string>(initialParsed.searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [currentView, setCurrentView] = useState<AppView>(initialParsed.view);
  const [activeDramaSlug, setActiveDramaSlug] = useState<string>(initialParsed.dramaSlug);
  const [activeSeason, setActiveSeason] = useState<number>(initialParsed.season);
  const [activeEpisode, setActiveEpisode] = useState<number>(initialParsed.episode);
  const [moviesPage, setMoviesPage] = useState<number>(initialParsed.moviesPage);
  const [resolvingSlug, setResolvingSlug] = useState<boolean>(false);
  const [forceHindiOnly, setForceHindiOnly] = useState<boolean>(initialParsed.forceHindiOnly);
  const [customWindowMode, setCustomWindowMode] = useState<boolean>(initialParsed.customWindowMode);
  const [initialWindowServer] = useState<number | undefined>(initialParsed.initialServerId);
  const [initialWindowLang] = useState<import('./types/drama.ts').AudioLanguageCode | undefined>(initialParsed.initialLang);
  const [activeGenreSlug, setActiveGenreSlug] = useState<string>(initialParsed.genreSlug);
  const [activeCastSlug, setActiveCastSlug] = useState<string>(initialParsed.castSlug);
  const [activeStaticPage, setActiveStaticPage] = useState<'dmca' | 'disclaimer' | 'privacy' | 'terms' | 'contact'>(
    initialParsed.staticPage
  );

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);
  const [continueWatching, setContinueWatching] = useState<WatchHistoryItem[]>([]);
  const [favoriteGenres, setFavoriteGenres] = useState<string[]>([]);
  const [catalogLoading, setCatalogLoading] = useState(false);
  const [tmdbFeedLoading, setTmdbFeedLoading] = useState(true);
  const [latestKDramas, setLatestKDramas] = useState<Drama[]>([]);
  const [trendingKoreanMovies, setTrendingKoreanMovies] = useState<Drama[]>([]);
  const [liveEpisodes, setLiveEpisodes] = useState<LatestAiringEpisodeItem[]>([]);
  const [trendingTab, setTrendingTab] = useState<'all' | 'kdrama' | 'movies'>('all');
  const syncedItemsRef = useRef<Map<string, Drama>>(new Map());

  const mergeIntoDramasCatalog = useCallback((incoming: Drama[]) => {
    if (!incoming || incoming.length === 0) return;
    setDramas(prev => {
      const bySlug = new Map<string, Drama>();
      const tmdbIndex = new Map<string, string>();
      for (const item of prev) {
        bySlug.set(item.slug, item);
        if (item.tmdbId) tmdbIndex.set(`${item.tmdbId}:${item.type || 'tv'}`, item.slug);
      }
      for (const item of incoming) {
        const tmdbKey = item.tmdbId ? `${item.tmdbId}:${item.type || 'tv'}` : '';
        const existingSlug = (tmdbKey && tmdbIndex.get(tmdbKey)) || (bySlug.has(item.slug) ? item.slug : undefined);
        if (existingSlug) {
          const existing = bySlug.get(existingSlug)!;
          bySlug.set(existingSlug, {
            ...item,
            ...existing,
            latestEpisode: Math.max(existing.latestEpisode || 1, item.latestEpisode || 1),
            totalEpisodes: Math.max(existing.totalEpisodes || 1, item.totalEpisodes || 1),
            popularityScore: Math.max(existing.popularityScore || 0, item.popularityScore || 0),
            status: item.status === 'Ongoing' ? 'Ongoing' : existing.status,
            updatedAt: item.updatedAt || existing.updatedAt,
          });
        } else {
          bySlug.set(item.slug, item);
          if (tmdbKey) tmdbIndex.set(tmdbKey, item.slug);
        }
      }
      return Array.from(bySlug.values());
    });
  }, []);

  useEffect(() => {
    let active = true;
    setTmdbFeedLoading(true);
    Promise.allSettled([
      fetchLatestKDramaEpisodesTMDB(18),
      fetchKoreanDramasTMDB(1),
      fetchTrendingKoreanMoviesTMDB(1),
    ]).then(([epRes, kdRes, mvRes]) => {
      if (!active) return;
      const discovered: Drama[] = [];
      if (epRes.status === 'fulfilled' && epRes.value) {
        if (epRes.value.episodes.length > 0) setLiveEpisodes(epRes.value.episodes);
        if (epRes.value.dramas.length > 0) discovered.push(...epRes.value.dramas);
      }
      if (kdRes.status === 'fulfilled' && kdRes.value && kdRes.value.length > 0) {
        setLatestKDramas(kdRes.value);
        discovered.push(...kdRes.value);
      }
      if (mvRes.status === 'fulfilled' && mvRes.value && mvRes.value.length > 0) {
        setTrendingKoreanMovies(mvRes.value);
        discovered.push(...mvRes.value);
      }
      if (discovered.length > 0) {
        mergeIntoDramasCatalog(discovered);
      }
      setTmdbFeedLoading(false);
    });
    return () => {
      active = false;
    };
  }, [mergeIntoDramasCatalog]);

  const refreshClientLibraryState = useCallback(() => {
    setContinueWatching(getWatchHistory());
    const favs = getFavorites();
    const genres = new Set<string>();
    favs.forEach(f => (f.genres || []).forEach(g => genres.add(g)));
    setFavoriteGenres(Array.from(genres));
  }, []);

  const refreshServerCatalog = useCallback(() => {
    setDramas(getAllDramas(initialDramas || []));
    if (typeof window !== 'undefined' && window.location.hostname.endsWith('.github.io')) {
      return;
    }
    setCatalogLoading(true);
    fetch('/api/dramas')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.dramas && Array.isArray(data.dramas)) {
          mergeIntoDramasCatalog(data.dramas);
        }
      })
      .catch(() => {})
      .finally(() => setCatalogLoading(false));
  }, [initialDramas, mergeIntoDramasCatalog]);

  // Refresh local synced dramas & user library state post-mount (prevents hydration mismatch)
  useEffect(() => {
    refreshClientLibraryState();
    refreshServerCatalog();
  }, [refreshClientLibraryState, refreshServerCatalog]);

  // Refresh Continue Watching whenever navigating back to home
  useEffect(() => {
    if (currentView === 'home') {
      refreshClientLibraryState();
    }
  }, [currentView, refreshClientLibraryState]);

  // Track real platform page visits per route change (skip /admin telemetry noise)
  useEffect(() => {
    if (typeof window === 'undefined' || currentView === 'admin') return;
    trackPlatformEvent({
      type: 'page_view',
      path: `${window.location.pathname}${window.location.search}`,
      dramaSlug: currentView === 'detail' || currentView === 'watch' ? activeDramaSlug : undefined,
    });
  }, [currentView, activeDramaSlug, activeEpisode, currentCategory, activeGenreSlug, activeCastSlug]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteUrl(window.location.pathname + window.location.search);
      setCurrentView(parsed.view);
      setCurrentCategory(parsed.category);
      setSearchQuery(parsed.searchQuery);
      setActiveDramaSlug(parsed.dramaSlug);
      setActiveSeason(parsed.season);
      setActiveEpisode(parsed.episode);
      setMoviesPage(parsed.moviesPage);
      setForceHindiOnly(parsed.forceHindiOnly);
      setActiveGenreSlug(parsed.genreSlug);
      setActiveCastSlug(parsed.castSlug);
      setActiveStaticPage(parsed.staticPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeDrama = useMemo(() => {
    if (!activeDramaSlug) return dramas[0];
    const lower = activeDramaSlug.toLowerCase();
    const exact = dramas.find(d => d.slug.toLowerCase() === lower || d.id.toLowerCase() === lower);
    if (exact) return exact;
    const trailingId = lower.match(/(?:^|-)(\d+)$/)?.[1];
    if (trailingId) {
      return dramas.find(
        d => String(d.tmdbId) === trailingId && (currentView !== 'movie' || d.type === 'movie')
      );
    }
    return undefined;
  }, [dramas, activeDramaSlug, currentView]);

  // Dynamically resolve any unknown /movie/:slug, /drama/:slug, or /watch/:slug directly from TMDB
  useEffect(() => {
    if (
      typeof window === 'undefined' ||
      !activeDramaSlug ||
      activeDrama ||
      (currentView !== 'movie' && currentView !== 'detail' && currentView !== 'watch')
    ) {
      return;
    }
    let active = true;
    setResolvingSlug(true);
    const typeHint = currentView === 'movie' ? 'movie' : '';
    fetch(`/api/dramas/resolve?slug=${encodeURIComponent(activeDramaSlug)}&type=${typeHint}`)
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active || !data?.drama) return;
        mergeIntoDramasCatalog([data.drama]);
        saveLocalSyncedDrama(data.drama);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setResolvingSlug(false);
      });
    return () => {
      active = false;
    };
  }, [activeDramaSlug, activeDrama, currentView, mergeIntoDramasCatalog]);

  // Dynamic Client SEO & JSON-LD Injection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = stripBasePrefix(window.location.pathname);
    const qs = new URLSearchParams(window.location.search);
    const meta = buildSeoMetadata({
      path: currentPath,
      origin: window.location.origin || origin,
      dramas,
      activeDrama:
        currentView === 'watch' || currentView === 'detail' || currentView === 'movie'
          ? activeDrama
          : undefined,
      episode: activeEpisode,
      season: activeSeason,
      category: currentCategory,
      genre: activeGenreSlug,
      castProfile: currentView === 'cast' ? initialCastProfile : null,
      searchQuery,
      staticPage: currentView === 'static' ? activeStaticPage : undefined,
      hlLang: qs.get('hl') || undefined,
      isPlayerQueryVariant:
        qs.get('window') === '1' || qs.has('server') || qs.has('lang') || qs.has('audio'),
    });
    applyClientSeo(meta);
  }, [
    currentView,
    activeDrama,
    activeEpisode,
    currentCategory,
    activeGenreSlug,
    activeCastSlug,
    activeStaticPage,
    searchQuery,
    dramas,
    initialCastProfile,
    origin,
  ]);

  const pushRoute = (routePath: string) => {
    if (typeof window === 'undefined') return;
    const full = `${BASE_PREFIX}${routePath}` || '/';
    window.history.pushState({}, '', full);
  };

  const navigateToHome = () => {
    setCurrentView('home');
    setSearchQuery('');
    setCurrentCategory('all');
    setForceHindiOnly(false);
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      pushRoute('/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenMoviesDirectory = (page = 1) => {
    const safePage = Math.max(1, page);
    setCurrentCategory('movies');
    setSearchQuery('');
    setMoviesPage(safePage);
    setCurrentView('movies');
    if (typeof window !== 'undefined') {
      pushRoute(safePage > 1 ? `/movies/page/${safePage}` : '/movies');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectCategory = (cat: DramaCategory | string) => {
    const formatted = cat.toLowerCase() as DramaCategory;
    if (formatted === 'movies') {
      handleOpenMoviesDirectory(1);
      return;
    }
    setCurrentCategory(formatted);
    setForceHindiOnly(formatted === 'hindi-dubbed');
    setSearchQuery('');
    setCurrentView('home');
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      pushRoute(formatted === 'all' ? '/' : `/category/${formatted}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const persistClickedDrama = useCallback(
    (slug: string) => {
      const target =
        dramas.find(d => d.slug === slug) || syncedItemsRef.current.get(slug.toLowerCase());
      if (target) {
        saveLocalSyncedDrama(target);
      }
    },
    [dramas]
  );

  const handleOpenDrama = (slug: string) => {
    persistClickedDrama(slug);
    const target =
      dramas.find(d => d.slug.toLowerCase() === slug.toLowerCase()) ||
      syncedItemsRef.current.get(slug.toLowerCase());
    const isMovie = target?.type === 'movie';
    setActiveDramaSlug(slug);
    setCurrentView(isMovie ? 'movie' : 'detail');
    if (typeof window !== 'undefined') {
      const qs = currentCategory === 'hindi-dubbed' ? '?audio=hindi' : '';
      pushRoute(`${isMovie ? `/movie/${slug}` : `/drama/${slug}`}${qs}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleWatchEpisode = (slug: string, ep: number, seasonNum?: number) => {
    persistClickedDrama(slug);
    triggerSmartlinkWithCooldown(45000);
    const lockHindi = currentCategory === 'hindi-dubbed' || forceHindiOnly;
    const targetDrama =
      dramas.find(d => d.slug.toLowerCase() === slug.toLowerCase()) ||
      syncedItemsRef.current.get(slug.toLowerCase());
    const isMovie = targetDrama?.type === 'movie';
    const resolvedSeason = seasonNum || targetDrama?.season || 1;
    setActiveDramaSlug(slug);
    setActiveSeason(resolvedSeason);
    setActiveEpisode(isMovie ? 1 : ep);
    setForceHindiOnly(lockHindi);
    setCurrentView('watch');
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams();
      if (lockHindi) params.set('audio', 'hindi');
      if (!isMovie && resolvedSeason > 1) params.set('season', String(resolvedSeason));
      const qs = params.toString() ? `?${params.toString()}` : '';
      const baseWatchPath = isMovie
        ? `/watch/${slug}`
        : resolvedSeason > 1
          ? `/watch/${slug}/season-${resolvedSeason}/episode-${ep}`
          : `/watch/${slug}/episode-${ep}`;
      pushRoute(`${baseWatchPath}${qs}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenGenre = (genreSlug: string) => {
    setActiveGenreSlug(genreSlug.toLowerCase());
    setCurrentPage(1);
    setCurrentView('genre');
    if (typeof window !== 'undefined') {
      pushRoute(`/genre/${genreSlug.toLowerCase()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenCast = (castSlug: string) => {
    setActiveCastSlug(castSlug);
    setCurrentView('cast');
    if (typeof window !== 'undefined') {
      pushRoute(`/cast/${castSlug}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenLibrary = () => {
    setCurrentView('library');
    if (typeof window !== 'undefined') {
      pushRoute('/library');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenAdmin = () => {
    setCurrentView('admin');
    if (typeof window !== 'undefined') {
      pushRoute('/admin');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenStaticPage = (page: string) => {
    setActiveStaticPage(page as any);
    setCurrentView('static');
    if (typeof window !== 'undefined') {
      pushRoute(`/${page === 'privacy' ? 'privacy-policy' : page}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDramaSynced = (newDrama: Drama) => {
    syncedItemsRef.current.set(newDrama.slug.toLowerCase(), newDrama);
    setDramas(prev => {
      const filtered = prev.filter(d => d.slug !== newDrama.slug && (!newDrama.tmdbId || d.tmdbId !== newDrama.tmdbId));
      return [newDrama, ...filtered];
    });
  };

  const filteredDramas = useMemo(() => {
    let result = [...dramas];

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      result = result.filter(
        d =>
          (d.title || '').toLowerCase().includes(q) ||
          (d.hindiTitle || '').toLowerCase().includes(q) ||
          (d.genres || []).some(g => g.toLowerCase().includes(q)) ||
          (d.country || '').toLowerCase().includes(q) ||
          String(d.year || '').includes(q)
      );
    } else {
      if (currentCategory === 'hindi-dubbed') {
        result = result.filter(
          d =>
            d.country.toLowerCase() === 'korean' &&
            (Boolean(d.hindiOnly) || (d.language || '').toLowerCase().includes('hindi'))
        );
      } else if (currentCategory === 'korean') {
        result = result.filter(d => d.country.toLowerCase() === 'korean');
      } else if (currentCategory === 'chinese') {
        result = result.filter(d => d.country.toLowerCase() === 'chinese' || d.country.toLowerCase() === 'taiwanese');
      } else if (currentCategory === 'japanese') {
        result = result.filter(d => d.country.toLowerCase() === 'japanese');
      } else if (currentCategory === 'movies') {
        result = result.filter(d => d.type === 'movie');
      } else if (currentCategory === 'anime') {
        result = result.filter(
          d =>
            (d.genres || []).some(g => g.toLowerCase().includes('anim')) ||
            (d.country.toLowerCase() === 'japanese' && d.totalEpisodes >= 12)
        );
      } else if (currentCategory === 'indian') {
        result = result.filter(d => d.country.toLowerCase() === 'indian');
      } else if (currentCategory === 'trending') {
        result = result.filter(d => d.rating >= 8.0);
      }
    }

    if (sortBy === 'rating') {
      result.sort((a, b) => b.rating - a.rating);
    } else if (sortBy === 'views') {
      const parseViews = (v: string) => {
        if (v.includes('K')) return parseFloat(v) * 1000;
        return parseInt(v, 10) || 0;
      };
      result.sort((a, b) => parseViews(b.views) - parseViews(a.views));
    } else if (sortBy === 'title') {
      result.sort((a, b) => a.title.localeCompare(b.title));
    }

    return result;
  }, [dramas, currentCategory, searchQuery, sortBy]);

  const relatedDramas = useMemo(() => {
    if (!activeDrama) return [];
    return dramas.filter(d => d.country === activeDrama.country && d.slug !== activeDrama.slug);
  }, [dramas, activeDrama]);

  const latestKDramasCarousel = useMemo(() => {
    return (latestKDramas.length > 0 ? latestKDramas : dramas.filter(d => d.country.toLowerCase() === 'korean' && d.type !== 'movie'))
      .slice(0, 14)
      .map(mapDramaToCarouselItem);
  }, [latestKDramas, dramas]);

  const trendingKoreanMoviesCarousel = useMemo(() => {
    return (trendingKoreanMovies.length > 0 ? trendingKoreanMovies : dramas.filter(d => d.type === 'movie'))
      .slice(0, 14)
      .map(mapDramaToCarouselItem);
  }, [trendingKoreanMovies, dramas]);

  const flixTrendingItems = useMemo(() => {
    if (trendingTab === 'kdrama') return latestKDramasCarousel;
    if (trendingTab === 'movies') return trendingKoreanMoviesCarousel;
    return [...dramas]
      .sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0) || (b.rating || 0) - (a.rating || 0))
      .slice(0, 14)
      .map(mapDramaToCarouselItem);
  }, [trendingTab, latestKDramasCarousel, trendingKoreanMoviesCarousel, dramas]);

  const ongoingSidebarItems = useMemo(() => {
    const liveOngoing = liveEpisodes.filter(e => e.isOngoing).map(e => e.drama);
    if (liveOngoing.length >= 4) return liveOngoing.slice(0, 8);
    const ongoingCatalog = dramas.filter(
      d => d.status === 'Ongoing' && d.type !== 'movie' && !liveOngoing.some(l => l.slug === d.slug)
    );
    const combined = [...liveOngoing, ...ongoingCatalog];
    if (combined.length > 0) return combined.slice(0, 8);
    return dramas.filter(d => d.country.toLowerCase() === 'korean' && d.type !== 'movie').slice(0, 8);
  }, [liveEpisodes, dramas]);

  const topRatedCarousel = useMemo(
    () => [...dramas].sort((a, b) => b.rating - a.rating).slice(0, 14).map(mapDramaToCarouselItem),
    [dramas]
  );

  const recommendedCarousel = useMemo(() => {
    if (favoriteGenres.length === 0) {
      return dramas.filter(d => d.rating >= 8.3).slice(6, 20).map(mapDramaToCarouselItem);
    }
    return dramas
      .filter(d => (d.genres || []).some(g => favoriteGenres.includes(g)))
      .slice(0, 14)
      .map(mapDramaToCarouselItem);
  }, [dramas, favoriteGenres]);

  const continueWatchingItems = useMemo(() => {
    return continueWatching.map(item => {
      const duration = item.durationSeconds || 0;
      const progress = item.progressSeconds || 0;
      const pct = duration > 10 ? Math.min(98, Math.round((progress / duration) * 100)) : 0;
      const mins = Math.floor(progress / 60);
      const secs = Math.floor(progress % 60).toString().padStart(2, '0');
      return {
        slug: item.dramaSlug,
        title: item.dramaTitle,
        poster: item.poster,
        country: item.country,
        year: item.year,
        episode: item.episode,
        totalEpisodes: item.totalEpisodes,
        type: item.type,
        progressPercent: pct,
        resumeLabel: progress > 5 ? `Ep ${item.episode} · ${mins}:${secs}` : `Ep ${item.episode}`,
      };
    });
  }, [continueWatching]);

  const sectionTitle = useMemo(() => {
    if (searchQuery.trim()) {
      return `Search Results for "${searchQuery}"`;
    }
    if (currentCategory === 'hindi-dubbed') return 'Hindi Dubbed K-Dramas (100% Pure Hindi Only)';
    if (currentCategory === 'movies') return 'Popular Asian & Korean Movies';
    if (currentCategory === 'anime') return 'Anime Series & Dubbed Collection';
    if (currentCategory === 'korean') return 'Korean Dramas (Kdrama Hindi)';
    if (currentCategory === 'chinese') return 'Chinese Dramas (C-Drama Hindi)';
    if (currentCategory === 'japanese') return 'Japanese Dramas (J-Drama Hindi)';
    if (currentCategory === 'indian') return 'Indian Dramas & Web Series';
    if (currentCategory === 'trending') return 'Trending Asian Dramas';
    return 'Recently Added & Full Catalog';
  }, [currentCategory, searchQuery]);

  const isStandaloneWindow = currentView === 'watch' && customWindowMode;

  return (
    <div className="min-h-screen flex flex-col bg-[#0a0d14] text-slate-100">
      
      {!isStandaloneWindow && <AdsterraBanner type="top" />}

      {!isStandaloneWindow && (
        <Navbar
          currentCategory={currentCategory}
          onSelectCategory={handleSelectCategory}
          onNavigateHome={navigateToHome}
          onOpenDrama={handleOpenDrama}
          onOpenDramaSynced={handleDramaSynced}
          onOpenLibrary={handleOpenLibrary}
          onOpenAdmin={handleOpenAdmin}
          onOpenRequest={() => setRequestModalOpen(true)}
          onOpenSync={() => setSyncModalOpen(true)}
          onSearch={q => {
            setSearchQuery(q);
            if (currentView !== 'home') setCurrentView('home');
          }}
          searchQuery={searchQuery}
        />
      )}

      {/* Main SSR / Hydrated Views */}
      <main className="flex-1">
        {currentView === 'home' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {!searchQuery && currentCategory === 'all' && (
              <>
                <HeroSpotlight
                  dramas={dramas}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                />

                {/* Live Search Bar */}
                <div className="relative mb-8 max-w-2xl mx-auto">
                  <div className="relative flex items-center">
                    <Search className="absolute left-4 w-5 h-5 text-[#00c896] pointer-events-none" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={e => setSearchQuery(e.target.value)}
                      placeholder="Live Search Korean Dramas, Asian Movies, actors, genres..."
                      className="w-full bg-[#111622] border border-[#1e2638] rounded-xl pl-12 pr-10 py-3.5 text-sm sm:text-base text-white placeholder-slate-400 focus:outline-none focus:border-[#00c896] focus:ring-2 focus:ring-[#00c896]/20 shadow-xl shadow-black/40 transition-all"
                    />
                    {searchQuery && (
                      <button
                        type="button"
                        onClick={() => setSearchQuery('')}
                        className="absolute right-3.5 p-1 rounded-lg text-slate-400 hover:text-white hover:bg-[#1a2234] transition-colors cursor-pointer"
                        title="Clear Search"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>

                {/* FlixHQ Tabbed Trending Showcase */}
                <OttCarouselRow
                  title="Trending Now"
                  subtitle="Auto-updated from TMDB Trending & Korean Streaming Charts"
                  items={flixTrendingItems}
                  loading={(catalogLoading || tmdbFeedLoading) && flixTrendingItems.length === 0}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                  headerRight={
                    <div className="flex items-center gap-1 bg-[#111622] p-1 rounded-lg border border-[#1e2638]">
                      {(
                        [
                          { id: 'all', label: 'All' },
                          { id: 'kdrama', label: 'K-Dramas' },
                          { id: 'movies', label: 'Korean Movies' },
                        ] as const
                      ).map(tab => (
                        <button
                          key={tab.id}
                          type="button"
                          onClick={() => setTrendingTab(tab.id)}
                          className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                            trendingTab === tab.id
                              ? 'bg-[#00c896] text-slate-950'
                              : 'text-slate-300 hover:text-white'
                          }`}
                        >
                          {tab.label}
                        </button>
                      ))}
                    </div>
                  }
                />

                {/* DramaCool Split Section: Latest Airing Episodes + Ongoing Sidebar */}
                <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start mb-4">
                  <div className="xl:col-span-9 min-w-0">
                    <LatestEpisodes
                      dramas={dramas}
                      liveEpisodes={liveEpisodes}
                      loading={tmdbFeedLoading && liveEpisodes.length === 0}
                      onWatchEpisode={handleWatchEpisode}
                      onOpenDrama={handleOpenDrama}
                    />
                  </div>

                  {/* DramaCool Ongoing & Quick Genres Sidebar */}
                  <aside className="xl:col-span-3 space-y-6">
                    <div className="bg-[#111622] border border-[#1e2638] rounded-xl p-4">
                      <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1e2638]">
                        <h3 className="text-sm font-bold text-white flex items-center gap-1.5">
                          <Flame className="w-4 h-4 text-[#00c896]" />
                          <span>Ongoing Series</span>
                        </h3>
                        <button
                          type="button"
                          onClick={() => handleSelectCategory('korean')}
                          className="text-[11px] font-semibold text-[#00c896] hover:underline cursor-pointer"
                        >
                          All →
                        </button>
                      </div>

                      <div className="space-y-2.5">
                        {ongoingSidebarItems.map(item => (
                          <a
                            key={`sidebar-${item.slug}`}
                            href={`/watch/${item.slug}/episode-${item.latestEpisode || 1}`}
                            onClick={e => {
                              e.preventDefault();
                              handleWatchEpisode(item.slug, item.latestEpisode || 1);
                            }}
                            className="flex items-center gap-3 p-1.5 rounded-lg hover:bg-[#1a2234] transition-colors group"
                          >
                            <img
                              src={item.poster}
                              alt={item.title}
                              referrerPolicy="no-referrer"
                              className="w-11 h-14 object-cover rounded bg-[#1a2234] shrink-0"
                            />
                            <div className="flex-1 min-w-0">
                              <p className="text-xs font-semibold text-slate-100 group-hover:text-[#00c896] truncate">
                                {item.title}
                              </p>
                              <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 tabular-nums">
                                <span className="text-[#00c896] font-semibold">
                                  {item.status === 'Ongoing' ? `EP ${item.latestEpisode || item.totalEpisodes}` : 'Completed'}
                                </span>
                                <span aria-hidden="true">·</span>
                                <span className="inline-flex items-center gap-0.5 text-amber-400">
                                  <Star className="w-2.5 h-2.5 fill-amber-400" />
                                  {item.rating}
                                </span>
                              </div>
                            </div>
                            <Play className="w-3.5 h-3.5 text-slate-500 group-hover:text-[#00c896] shrink-0" />
                          </a>
                        ))}
                      </div>
                    </div>

                    <div className="bg-[#111622] border border-[#1e2638] rounded-xl p-4">
                      <h3 className="text-sm font-bold text-white pb-2.5 mb-3 border-b border-[#1e2638]">
                        Quick Genres
                      </h3>
                      <div className="flex flex-wrap gap-1.5">
                        {['Romance', 'Action', 'Thriller', 'Fantasy', 'Comedy', 'Historical', 'Mystery', 'Sci-Fi', 'Drama'].map(genre => {
                          const gSlug = slugifyText(genre);
                          return (
                            <a
                              key={`side-genre-${genre}`}
                              href={`/genre/${gSlug}`}
                              onClick={e => {
                                e.preventDefault();
                                handleOpenGenre(gSlug);
                              }}
                              className="px-2.5 py-1 rounded-md bg-[#0a0d14] border border-[#1e2638] hover:border-[#00c896]/60 text-[11px] font-medium text-slate-300 hover:text-[#00c896] transition-colors"
                            >
                              {genre}
                            </a>
                          );
                        })}
                      </div>
                    </div>
                  </aside>
                </div>

                {/* Latest K-Dramas Section */}
                <OttCarouselRow
                  title="Latest K-Dramas"
                  subtitle="Popular Korean Dramas auto-synced via TMDB (with_original_language=ko)"
                  items={latestKDramasCarousel}
                  loading={(catalogLoading || tmdbFeedLoading) && latestKDramas.length === 0}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                  onViewAll={() => handleSelectCategory('korean')}
                />

                {/* Trending Korean Movies Section */}
                <OttCarouselRow
                  title="Trending Korean Movies"
                  subtitle="Blockbuster Korean cinema & trending Asian feature films"
                  items={trendingKoreanMoviesCarousel}
                  loading={(catalogLoading || tmdbFeedLoading) && trendingKoreanMovies.length === 0}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                  onViewAll={() => handleSelectCategory('movies')}
                />

                {continueWatchingItems.length > 0 && (
                  <OttCarouselRow
                    title="Continue Watching"
                    subtitle="Pick up right where you left off"
                    items={continueWatchingItems}
                    onOpenDrama={handleOpenDrama}
                    onWatchEpisode={handleWatchEpisode}
                    onRemoveItem={slug => {
                      removeWatchHistoryItem(slug);
                      refreshClientLibraryState();
                    }}
                    onViewAll={handleOpenLibrary}
                  />
                )}

                <HeroTop10
                  dramas={dramas}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                />

                <OttCarouselRow
                  title="Top Rated"
                  subtitle="Highest IMDb & TMDB audience-rated series"
                  items={topRatedCarousel}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                />

                <OttCarouselRow
                  title="Recommended For You"
                  subtitle={
                    favoriteGenres.length > 0
                      ? `Based on your favorite genres: ${favoriteGenres.slice(0, 3).join(', ')}`
                      : 'Curated top picks across Romance, Thriller & Action'
                  }
                  items={recommendedCarousel}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                />
              </>
            )}

            <AdsterraBanner type="native" className="mb-8" />

            <DramaGrid
              dramas={filteredDramas}
              onOpenDrama={handleOpenDrama}
              onWatchEpisode={handleWatchEpisode}
              title={sectionTitle}
              subtitle={
                currentCategory === 'hindi-dubbed'
                  ? `Showing ${filteredDramas.length} verified Korean dramas playing strictly in Hindi Dubbed Audio Only (No other audio languages)`
                  : undefined
              }
              sortBy={sortBy}
              onSortChange={setSortBy}
              currentPage={currentPage}
              onPageChange={page => {
                setCurrentPage(page);
                if (typeof window !== 'undefined') {
                  window.scrollTo({ top: 300, behavior: 'smooth' });
                }
              }}
            />
          </div>
        )}

        {currentView === 'watch' && activeDrama && (
          <WatchPlayer
            drama={activeDrama}
            currentEpisode={activeEpisode}
            currentSeason={activeSeason}
            hindiOnlyLocked={forceHindiOnly}
            customWindowMode={customWindowMode}
            initialServerId={initialWindowServer}
            initialLang={initialWindowLang}
            onSelectEpisode={(ep, seasonNum) => {
              const nextSeason = seasonNum || activeSeason || activeDrama.season || 1;
              setActiveSeason(nextSeason);
              setActiveEpisode(ep);
              if (typeof window !== 'undefined') {
                const currentSearch = new URLSearchParams(window.location.search);
                const params = new URLSearchParams();
                if (forceHindiOnly) params.set('audio', 'hindi');
                if (customWindowMode) params.set('window', '1');
                const activeServer = currentSearch.get('server');
                const activeLang = currentSearch.get('lang');
                if (activeServer) params.set('server', activeServer);
                if (activeLang) params.set('lang', activeLang);
                if (nextSeason > 1) params.set('season', String(nextSeason));
                const qs = params.toString() ? `?${params.toString()}` : '';
                const watchBasePath =
                  activeDrama.type === 'movie'
                    ? `/watch/${activeDrama.slug}`
                    : nextSeason > 1
                      ? `/watch/${activeDrama.slug}/season-${nextSeason}/episode-${ep}`
                      : `/watch/${activeDrama.slug}/episode-${ep}`;
                pushRoute(`${watchBasePath}${qs}`);
                window.scrollTo({ top: 120, behavior: 'smooth' });
              }
            }}
            onNavigateHome={() => {
              setCustomWindowMode(false);
              navigateToHome();
            }}
            onSelectCategory={cat => {
              setCustomWindowMode(false);
              handleSelectCategory(cat);
            }}
            onOpenDramaDetail={slug => {
              setCustomWindowMode(false);
              handleOpenDrama(slug);
            }}
            onOpenGenre={g => {
              setCustomWindowMode(false);
              handleOpenGenre(g);
            }}
          />
        )}

        {(currentView === 'movie' || currentView === 'detail' || currentView === 'watch') &&
          !activeDrama && (
            <div className="max-w-3xl mx-auto px-4 py-20 text-center">
              {resolvingSlug || catalogLoading ? (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-10 h-10 border-3 border-[#00c896] border-t-transparent rounded-full animate-spin" />
                  <p className="text-sm font-semibold text-slate-300">
                    Syncing page metadata from TMDB...
                  </p>
                </div>
              ) : (
                <div className="bg-[#111622] border border-[#1e2638] rounded-2xl p-8 space-y-3">
                  <h2 className="text-lg font-bold text-white">Title Not Found</h2>
                  <p className="text-xs text-slate-400">
                    Could not resolve &quot;{activeDramaSlug}&quot;. Browse our auto-synced catalog instead.
                  </p>
                  <button
                    type="button"
                    onClick={navigateToHome}
                    className="px-4 py-2 rounded-lg bg-[#00c896] text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Back to Home
                  </button>
                </div>
              )}
            </div>
          )}

        {currentView === 'movie' && activeDrama && (
          <MovieDetail
            movie={activeDrama}
            relatedMovies={dramas.filter(d => d.type === 'movie' && d.slug !== activeDrama.slug).slice(0, 12)}
            onWatchMovie={slug => handleWatchEpisode(slug, 1)}
            onOpenMovie={handleOpenDrama}
            onOpenCast={handleOpenCast}
            onOpenGenre={handleOpenGenre}
            onOpenMoviesDirectory={() => handleOpenMoviesDirectory(1)}
            onBack={navigateToHome}
          />
        )}

        {currentView === 'movies' && (
          <MoviesDirectory
            dramas={dramas}
            page={moviesPage}
            onPageChange={page => handleOpenMoviesDirectory(page)}
            onOpenMovie={handleOpenDrama}
            onWatchMovie={slug => handleWatchEpisode(slug, 1)}
            onBack={navigateToHome}
          />
        )}

        {currentView === 'detail' && activeDrama && (
          activeDrama.type === 'movie' ? (
            <MovieDetail
              movie={activeDrama}
              relatedMovies={dramas.filter(d => d.type === 'movie' && d.slug !== activeDrama.slug).slice(0, 12)}
              onWatchMovie={slug => handleWatchEpisode(slug, 1)}
              onOpenMovie={handleOpenDrama}
              onOpenCast={handleOpenCast}
              onOpenGenre={handleOpenGenre}
              onOpenMoviesDirectory={() => handleOpenMoviesDirectory(1)}
              onBack={navigateToHome}
            />
          ) : (
            <DramaDetail
              drama={activeDrama}
              relatedDramas={relatedDramas}
              onWatchEpisode={handleWatchEpisode}
              onOpenDrama={handleOpenDrama}
              onOpenCast={handleOpenCast}
              onOpenGenre={handleOpenGenre}
              onSelectCategory={handleSelectCategory}
              onBack={navigateToHome}
            />
          )
        )}

        {currentView === 'genre' && (
          <GenrePage
            genreSlug={activeGenreSlug}
            allDramas={dramas}
            sortBy={sortBy}
            onSortChange={setSortBy}
            currentPage={currentPage}
            onPageChange={page => {
              setCurrentPage(page);
              if (typeof window !== 'undefined') {
                window.scrollTo({ top: 200, behavior: 'smooth' });
              }
            }}
            onOpenDrama={handleOpenDrama}
            onWatchEpisode={handleWatchEpisode}
            onSelectGenre={handleOpenGenre}
            onBack={navigateToHome}
          />
        )}

        {currentView === 'cast' && (
          <CastPage
            castSlug={activeCastSlug}
            initialCastProfile={initialCastProfile}
            dramas={dramas}
            onOpenDrama={handleOpenDrama}
            onDramaSynced={handleDramaSynced}
            onBack={navigateToHome}
          />
        )}

        {currentView === 'library' && (
          <LibraryPage
            dramas={dramas}
            onOpenDrama={handleOpenDrama}
            onWatchEpisode={handleWatchEpisode}
            onBack={navigateToHome}
          />
        )}

        {currentView === 'admin' && (
          <AdminDashboard
            onBack={navigateToHome}
            onCatalogUpdated={refreshServerCatalog}
          />
        )}

        {currentView === 'static' && (
          <StaticPages
            page={activeStaticPage}
            onBack={navigateToHome}
          />
        )}
      </main>

      {!isStandaloneWindow && (
        <Footer
          onSelectCategory={handleSelectCategory}
          onNavigateHome={navigateToHome}
          onOpenPage={handleOpenStaticPage}
          onOpenRequest={() => setRequestModalOpen(true)}
        />
      )}

      {!isStandaloneWindow && <FloatingTelegram />}

      <SyncModal
        isOpen={syncModalOpen}
        onClose={() => setSyncModalOpen(false)}
        onDramaSynced={handleDramaSynced}
      />

      <RequestModal
        isOpen={requestModalOpen}
        onClose={() => setRequestModalOpen(false)}
      />

    </div>
  );
}
