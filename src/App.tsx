import React, { useState, useEffect, useMemo } from 'react';
import type { AppView, CastProfile, Drama, DramaCategory, SortOption } from './types/drama.ts';
import { getAllDramas } from './services/tmdb.ts';
import { applyClientSeo, buildSeoMetadata } from './services/seo.ts';
import { Navbar } from './components/Navbar.tsx';
import { HeroTop10 } from './components/HeroTop10.tsx';
import { LatestEpisodes } from './components/LatestEpisodes.tsx';
import { DramaGrid } from './components/DramaGrid.tsx';
import { WatchPlayer } from './components/WatchPlayer.tsx';
import { DramaDetail } from './components/DramaDetail.tsx';
import { GenrePage } from './components/GenrePage.tsx';
import { CastPage } from './components/CastPage.tsx';
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
  episode: number;
  genreSlug: string;
  castSlug: string;
  staticPage: 'dmca' | 'disclaimer' | 'privacy' | 'terms' | 'contact';
}

export function parseRouteUrl(rawUrl: string): ParsedRoute {
  const [rawPath, rawSearch = ''] = rawUrl.split('?');
  const path = rawPath || '/';
  const search = new URLSearchParams(rawSearch);

  const base: ParsedRoute = {
    view: 'home',
    category: 'all',
    searchQuery: '',
    dramaSlug: '',
    episode: 1,
    genreSlug: '',
    castSlug: '',
    staticPage: 'dmca',
  };

  const q = search.get('q');
  if (q) {
    return { ...base, view: 'home', searchQuery: q };
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
    return { ...base, view: 'home', category: decodeURIComponent(catMatch[1]).toLowerCase() as DramaCategory };
  }

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

  const [dramas, setDramas] = useState<Drama[]>(() => getAllDramas(initialDramas || []));
  const [currentCategory, setCurrentCategory] = useState<DramaCategory>(initialParsed.category);
  const [searchQuery, setSearchQuery] = useState<string>(initialParsed.searchQuery);
  const [sortBy, setSortBy] = useState<SortOption>('latest');
  const [currentPage, setCurrentPage] = useState<number>(1);

  const [currentView, setCurrentView] = useState<AppView>(initialParsed.view);
  const [activeDramaSlug, setActiveDramaSlug] = useState<string>(initialParsed.dramaSlug);
  const [activeEpisode, setActiveEpisode] = useState<number>(initialParsed.episode);
  const [activeGenreSlug, setActiveGenreSlug] = useState<string>(initialParsed.genreSlug);
  const [activeCastSlug, setActiveCastSlug] = useState<string>(initialParsed.castSlug);
  const [activeStaticPage, setActiveStaticPage] = useState<'dmca' | 'disclaimer' | 'privacy' | 'terms' | 'contact'>(
    initialParsed.staticPage
  );

  const [syncModalOpen, setSyncModalOpen] = useState(false);
  const [requestModalOpen, setRequestModalOpen] = useState(false);

  // Refresh local synced dramas on mount + sync from server catalog
  useEffect(() => {
    setDramas(getAllDramas(initialDramas || []));

    fetch('/api/dramas')
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (data?.dramas && Array.isArray(data.dramas)) {
          setDramas(getAllDramas(data.dramas));
        }
      })
      .catch(() => {});
  }, [initialDramas]);

  // Listen for browser back/forward navigation
  useEffect(() => {
    const handlePopState = () => {
      const parsed = parseRouteUrl(window.location.pathname + window.location.search);
      setCurrentView(parsed.view);
      setCurrentCategory(parsed.category);
      setSearchQuery(parsed.searchQuery);
      setActiveDramaSlug(parsed.dramaSlug);
      setActiveEpisode(parsed.episode);
      setActiveGenreSlug(parsed.genreSlug);
      setActiveCastSlug(parsed.castSlug);
      setActiveStaticPage(parsed.staticPage);
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  const activeDrama = useMemo(() => {
    return dramas.find(d => d.slug === activeDramaSlug) || dramas[0];
  }, [dramas, activeDramaSlug]);

  // Dynamic Client SEO & JSON-LD Injection
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const currentPath = window.location.pathname;
    const meta = buildSeoMetadata({
      path: currentPath,
      origin: window.location.origin || origin,
      dramas,
      activeDrama: currentView === 'watch' || currentView === 'detail' ? activeDrama : undefined,
      episode: activeEpisode,
      category: currentCategory,
      genre: activeGenreSlug,
      castProfile: currentView === 'cast' ? initialCastProfile : null,
      searchQuery,
      staticPage: currentView === 'static' ? activeStaticPage : undefined,
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

  const navigateToHome = () => {
    setCurrentView('home');
    setSearchQuery('');
    setCurrentCategory('all');
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', '/');
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleSelectCategory = (cat: DramaCategory | string) => {
    const formatted = cat.toLowerCase() as DramaCategory;
    setCurrentCategory(formatted);
    setSearchQuery('');
    setCurrentView('home');
    setCurrentPage(1);
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', formatted === 'all' ? '/' : `/category/${formatted}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenDrama = (slug: string) => {
    setActiveDramaSlug(slug);
    setCurrentView('detail');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/drama/${slug}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleWatchEpisode = (slug: string, ep: number) => {
    setActiveDramaSlug(slug);
    setActiveEpisode(ep);
    setCurrentView('watch');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/watch/${slug}/episode-${ep}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenGenre = (genreSlug: string) => {
    setActiveGenreSlug(genreSlug.toLowerCase());
    setCurrentPage(1);
    setCurrentView('genre');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/genre/${genreSlug.toLowerCase()}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenCast = (castSlug: string) => {
    setActiveCastSlug(castSlug);
    setCurrentView('cast');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/cast/${castSlug}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleOpenStaticPage = (page: string) => {
    setActiveStaticPage(page as any);
    setCurrentView('static');
    if (typeof window !== 'undefined') {
      window.history.pushState({}, '', `/${page === 'privacy' ? 'privacy-policy' : page}`);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleDramaSynced = (newDrama: Drama) => {
    setDramas(prev => {
      const filtered = prev.filter(d => d.slug !== newDrama.slug);
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
      if (currentCategory === 'korean') {
        result = result.filter(d => d.country.toLowerCase() === 'korean');
      } else if (currentCategory === 'chinese') {
        result = result.filter(d => d.country.toLowerCase() === 'chinese' || d.country.toLowerCase() === 'taiwanese');
      } else if (currentCategory === 'japanese') {
        result = result.filter(d => d.country.toLowerCase() === 'japanese');
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

  const sectionTitle = useMemo(() => {
    if (searchQuery.trim()) {
      return `Search Results for "${searchQuery}"`;
    }
    if (currentCategory === 'korean') return 'Korean Dramas (Kdrama Hindi)';
    if (currentCategory === 'chinese') return 'Chinese Dramas (C-Drama Hindi)';
    if (currentCategory === 'japanese') return 'Japanese Dramas (J-Drama Hindi)';
    if (currentCategory === 'indian') return 'Indian Dramas & Web Series';
    if (currentCategory === 'trending') return 'Trending Asian Dramas';
    return 'Latest Added';
  }, [currentCategory, searchQuery]);

  return (
    <div className="min-h-screen flex flex-col bg-[#0b0f19] text-slate-100">
      
      {/* Top Active Adsterra Smartlink Banner */}
      <AdsterraBanner type="top" />

      {/* Global Navbar */}
      <Navbar
        currentCategory={currentCategory}
        onSelectCategory={handleSelectCategory}
        onNavigateHome={navigateToHome}
        onOpenDrama={handleOpenDrama}
        onOpenRequest={() => setRequestModalOpen(true)}
        onOpenSync={() => setSyncModalOpen(true)}
        onSearch={q => {
          setSearchQuery(q);
          if (currentView !== 'home') setCurrentView('home');
        }}
        searchQuery={searchQuery}
      />

      {/* Main SSR / Hydrated Views */}
      <main className="flex-1">
        {currentView === 'home' && (
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
            {!searchQuery && currentCategory === 'all' && (
              <>
                <HeroTop10
                  dramas={dramas}
                  onOpenDrama={handleOpenDrama}
                  onWatchEpisode={handleWatchEpisode}
                />
                <LatestEpisodes
                  dramas={dramas}
                  onWatchEpisode={handleWatchEpisode}
                  onOpenDrama={handleOpenDrama}
                />
              </>
            )}

            <AdsterraBanner type="native" className="mb-8" />

            <DramaGrid
              dramas={filteredDramas}
              onOpenDrama={handleOpenDrama}
              onWatchEpisode={handleWatchEpisode}
              title={sectionTitle}
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
            onSelectEpisode={ep => {
              setActiveEpisode(ep);
              if (typeof window !== 'undefined') {
                window.history.pushState({}, '', `/watch/${activeDrama.slug}/episode-${ep}`);
                window.scrollTo({ top: 120, behavior: 'smooth' });
              }
            }}
            onNavigateHome={navigateToHome}
            onSelectCategory={handleSelectCategory}
            onOpenDramaDetail={handleOpenDrama}
            onOpenGenre={handleOpenGenre}
          />
        )}

        {currentView === 'detail' && activeDrama && (
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

        {currentView === 'static' && (
          <StaticPages
            page={activeStaticPage}
            onBack={navigateToHome}
          />
        )}
      </main>

      <Footer
        onSelectCategory={handleSelectCategory}
        onNavigateHome={navigateToHome}
        onOpenPage={handleOpenStaticPage}
        onOpenRequest={() => setRequestModalOpen(true)}
      />

      <FloatingTelegram />

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
