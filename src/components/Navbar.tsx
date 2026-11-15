import React, { useState, useEffect, useRef } from 'react';
import { Search, Play, Sparkles, PlusCircle, X, Menu, Bookmark, ShieldCheck, History, Loader2 } from 'lucide-react';
import type { DramaCategory, Drama } from '../types/drama.ts';
import { getAllDramas, searchTMDB, fetchDramaDetailsFromTMDB } from '../services/tmdb.ts';
import { getSearchHistory, addSearchHistory, clearSearchHistory, trackPlatformEvent } from '../services/storage.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

interface NavbarProps {
  currentCategory: DramaCategory;
  onSelectCategory: (cat: DramaCategory) => void;
  onNavigateHome: () => void;
  onOpenDrama: (slug: string) => void;
  onOpenDramaSynced?: (drama: Drama) => void;
  onOpenLibrary: () => void;
  onOpenAdmin: () => void;
  onOpenRequest: () => void;
  onOpenSync: () => void;
  onSearch: (query: string) => void;
  searchQuery: string;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentCategory,
  onSelectCategory,
  onNavigateHome,
  onOpenDrama,
  onOpenDramaSynced,
  onOpenLibrary,
  onOpenAdmin,
  onOpenRequest,
  onOpenSync,
  onSearch,
  searchQuery,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Drama[]>([]);
  const [tmdbSuggestions, setTmdbSuggestions] = useState<any[]>([]);
  const [searchingTmdb, setSearchingTmdb] = useState(false);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [searchHistory, setSearchHistory] = useState<string[]>([]);
  const [syncingTmdbId, setSyncingTmdbId] = useState<number | null>(null);
  const searchRef = useRef<HTMLDivElement>(null);

  const categories: { label: string; value: DramaCategory }[] = [
    { label: 'Home', value: 'all' },
    { label: 'Hindi Dubbed', value: 'hindi-dubbed' },
    { label: 'K-Drama', value: 'korean' },
    { label: 'Movies', value: 'movies' },
    { label: 'Trending', value: 'trending' },
    { label: 'C-Drama', value: 'chinese' },
    { label: 'J-Drama', value: 'japanese' },
    { label: 'Indian', value: 'indian' },
    { label: 'Anime', value: 'anime' },
  ];

  useEffect(() => {
    setSearchHistory(getSearchHistory());
  }, []);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowSuggestions(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    const trimmed = searchQuery.trim();
    if (trimmed.length < 2) {
      setSuggestions([]);
      setTmdbSuggestions([]);
      setSearchingTmdb(false);
      return;
    }

    const q = trimmed.toLowerCase();
    const local = getAllDramas().filter(
      d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.hindiTitle || '').toLowerCase().includes(q) ||
        (d.genres || []).some(g => g.toLowerCase().includes(q)) ||
        (d.country || '').toLowerCase().includes(q) ||
        String(d.tmdbId || '') === trimmed ||
        (d.cast || []).some(c => (c.name || '').toLowerCase().includes(q))
    );

    setSuggestions(local.slice(0, 6));
    setShowSuggestions(true);

    const timer = setTimeout(() => {
      if (local.length >= 4 || /^\d+$/.test(trimmed)) return;
      setSearchingTmdb(true);
      searchTMDB(trimmed)
        .then(res => {
          const localTmdbIds = new Set(local.map(d => d.tmdbId));
          setTmdbSuggestions(
            (res || []).filter((r: any) => r.poster_path && !localTmdbIds.has(r.id)).slice(0, 3)
          );
        })
        .catch(() => {})
        .finally(() => setSearchingTmdb(false));
    }, 220);

    return () => clearTimeout(timer);
  }, [searchQuery]);

  const handleSelectSuggestion = (drama: Drama) => {
    setSearchHistory(addSearchHistory(drama.title));
    setShowSuggestions(false);
    trackPlatformEvent({
      type: 'poster_click',
      dramaSlug: drama.slug,
      dramaTitle: drama.title,
    });
    onOpenDrama(drama.slug);
  };

  const handleSyncAndOpenTmdb = async (item: any) => {
    setSyncingTmdbId(item.id);
    try {
      const synced = await fetchDramaDetailsFromTMDB(item.id, item.media_type === 'movie' ? 'movie' : 'tv');
      if (synced) {
        setSearchHistory(addSearchHistory(synced.title));
        onOpenDramaSynced?.(synced);
        setShowSuggestions(false);
        onOpenDrama(synced.slug);
      }
    } finally {
      setSyncingTmdbId(null);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      if (searchQuery.trim().length >= 2) {
        setSearchHistory(addSearchHistory(searchQuery));
      }
      setShowSuggestions(false);
      onSearch(searchQuery);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0a0d14]/95 backdrop-blur-md border-b border-[#1e2638]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          {/* Brand Zone */}
          <a
            href="/"
            onClick={e => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="flex items-center gap-2.5 group shrink-0 whitespace-nowrap cursor-pointer"
          >
            <div className="w-9 h-9 rounded-lg bg-[#00c896] text-slate-950 flex items-center justify-center shadow-lg shadow-emerald-500/20 group-hover:scale-105 transition-transform">
              <Play className="w-4 h-4 fill-current ml-0.5" />
            </div>
            <span className="text-xl font-extrabold tracking-tight text-white">
              Hindi<span className="text-[#00c896]">Drama</span>
            </span>
          </a>

          {/* FlixHQ Centered Search */}
          <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onFocus={() => setShowSuggestions(true)}
                onChange={e => onSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search K-Dramas, movies, actors, TMDB ID..."
                className="w-full bg-[#111622] text-slate-100 placeholder-slate-400 text-sm rounded-full pl-10 pr-9 py-2 border border-[#1e2638] focus:outline-none focus:border-[#00c896] focus:ring-1 focus:ring-[#00c896] transition-all"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => onSearch('')}
                  aria-label="Clear search"
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showSuggestions && (searchQuery.trim().length >= 2 || searchHistory.length > 0) && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-[#111622] border border-[#1e2638] rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-[#1e2638] max-h-[70vh] overflow-y-auto">
                {searchQuery.trim().length < 2 && searchHistory.length > 0 && (
                  <div className="p-3">
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2">
                      <span className="inline-flex items-center gap-1 font-semibold">
                        <History className="w-3 h-3" />
                        Recent Searches
                      </span>
                      <button
                        type="button"
                        onClick={() => {
                          clearSearchHistory();
                          setSearchHistory([]);
                        }}
                        className="text-slate-400 hover:text-white cursor-pointer"
                      >
                        Clear
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {searchHistory.map(h => (
                        <button
                          key={h}
                          type="button"
                          onClick={() => {
                            onSearch(h);
                            setShowSuggestions(true);
                          }}
                          className="px-2.5 py-1 rounded-md bg-[#1a2234] hover:bg-[#232d45] text-xs text-slate-200 cursor-pointer"
                        >
                          {h}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {suggestions.map(drama => (
                  <a
                    key={drama.id}
                    href={drama.type === 'movie' ? `/movie/${drama.slug}` : `/drama/${drama.slug}`}
                    onClick={e => {
                      e.preventDefault();
                      handleSelectSuggestion(drama);
                    }}
                    className="w-full text-left p-2.5 hover:bg-[#1a2234] flex items-center gap-3 transition-colors cursor-pointer"
                  >
                    <OptimizedImage
                      src={drama.poster}
                      alt={`${drama.title} Poster`}
                      width={80}
                      height={112}
                      className="w-10 h-14 object-cover rounded bg-[#1a2234] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {drama.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate tabular-nums">
                        {drama.country} · {drama.year} · {drama.type === 'movie' ? 'Movie' : `${drama.totalEpisodes} Eps`}
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-400 shrink-0 mr-1 tabular-nums">
                      ★ {drama.rating}
                    </span>
                  </a>
                ))}

                {tmdbSuggestions.map(item => (
                  <button
                    key={`tmdb-${item.id}`}
                    type="button"
                    onClick={() => handleSyncAndOpenTmdb(item)}
                    className="w-full text-left p-2.5 hover:bg-[#1a2234] flex items-center gap-3 transition-colors cursor-pointer"
                  >
                    <img
                      src={`https://image.tmdb.org/t/p/w200${item.poster_path}`}
                      alt={item.name || item.title}
                      referrerPolicy="no-referrer"
                      className="w-10 h-14 object-cover rounded bg-[#1a2234] shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#00c896] truncate">
                        {item.name || item.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        TMDB #{item.id} · Sync & Stream
                      </p>
                    </div>
                    {syncingTmdbId === item.id && <Loader2 className="w-4 h-4 text-[#00c896] animate-spin shrink-0" />}
                  </button>
                ))}

                {searchQuery.trim().length >= 2 && (
                  <button
                    type="button"
                    onClick={() => {
                      setSearchHistory(addSearchHistory(searchQuery));
                      setShowSuggestions(false);
                      onSearch(searchQuery);
                    }}
                    className="w-full py-2.5 bg-[#161d2d] hover:bg-[#00c896] text-center text-xs font-semibold text-[#00c896] hover:text-slate-950 transition-colors cursor-pointer"
                  >
                    {searchingTmdb
                      ? `Searching TMDB for "${searchQuery}"...`
                      : `View all results for "${searchQuery}"`}
                  </button>
                )}
              </div>
            )}
          </div>

          {/* Right Action Controls */}
          <div className="hidden lg:flex items-center gap-2 shrink-0">
            <a
              href="/library"
              onClick={e => {
                e.preventDefault();
                onOpenLibrary();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111622] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Bookmark className="w-3.5 h-3.5 text-[#00c896]" />
              <span>Library</span>
            </a>
            <button
              type="button"
              onClick={onOpenSync}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111622] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Auto-Sync Asian Dramas via TMDB API"
            >
              <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
              <span>TMDB Sync</span>
            </button>
            <a
              href="/admin"
              onClick={e => {
                e.preventDefault();
                onOpenAdmin();
              }}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[#111622] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] transition-colors whitespace-nowrap shrink-0 cursor-pointer"
              title="Admin Analytics & Sync Console"
            >
              <ShieldCheck className="w-3.5 h-3.5 text-slate-300" />
              <span>Admin</span>
            </a>
            <button
              type="button"
              onClick={onOpenRequest}
              className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-bold bg-[#00c896] hover:bg-[#00b084] text-slate-950 transition-colors shadow-sm shadow-emerald-500/20 whitespace-nowrap shrink-0 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Request</span>
            </button>
          </div>

          {/* Mobile Controls */}
          <div className="flex lg:hidden items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={onOpenLibrary}
              className="p-2 text-slate-300 hover:text-white rounded-lg bg-[#111622] border border-[#1e2638] cursor-pointer"
              aria-label="Open Library"
            >
              <Bookmark className="w-4 h-4 text-[#00c896]" />
            </button>
            <button
              type="button"
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white rounded-lg bg-[#111622] border border-[#1e2638] cursor-pointer"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>
        </div>

        {/* FlixHQ / DramaCool Category Bar */}
        <nav
          aria-label="Main Categories"
          className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-2 border-t border-[#1e2638]/70"
        >
          {categories.map(cat => {
            const isActive = currentCategory === cat.value && !searchQuery;
            const href =
              cat.value === 'all' ? '/' : cat.value === 'movies' ? '/movies' : `/category/${cat.value}`;
            return (
              <a
                key={cat.value}
                href={href}
                onClick={e => {
                  e.preventDefault();
                  if (cat.value === 'all') {
                    onNavigateHome();
                  } else {
                    onSelectCategory(cat.value);
                  }
                  setMobileMenuOpen(false);
                }}
                className={`px-3 py-1 rounded-md text-xs sm:text-sm font-semibold transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                  isActive
                    ? 'bg-[#00c896] text-slate-950 shadow-sm shadow-emerald-500/25'
                    : 'text-slate-300 hover:text-white hover:bg-[#111622]'
                }`}
              >
                {cat.label}
              </a>
            );
          })}
        </nav>
      </div>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden border-t border-[#1e2638] bg-[#0a0d14] px-4 pt-3 pb-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search dramas, movies, actors..."
              className="w-full bg-[#111622] text-slate-100 placeholder-slate-400 text-sm rounded-lg pl-10 pr-4 py-2 border border-[#1e2638] focus:outline-none focus:border-[#00c896]"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="grid grid-cols-2 gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                onOpenRequest();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-bold bg-[#00c896] text-slate-950 cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Request Title</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenSync();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold bg-[#111622] text-slate-200 border border-[#1e2638] cursor-pointer"
            >
              <Sparkles className="w-4 h-4 text-cyan-400" />
              <span>TMDB Sync</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenLibrary();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold bg-[#111622] text-slate-200 border border-[#1e2638] cursor-pointer"
            >
              <Bookmark className="w-4 h-4 text-[#00c896]" />
              <span>My Library</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onOpenAdmin();
                setMobileMenuOpen(false);
              }}
              className="flex items-center justify-center gap-1.5 py-2.5 rounded-lg text-xs font-semibold bg-[#111622] text-slate-200 border border-[#1e2638] cursor-pointer"
            >
              <ShieldCheck className="w-4 h-4 text-slate-300" />
              <span>Admin Panel</span>
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
