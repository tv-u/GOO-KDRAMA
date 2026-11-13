import React, { useState, useEffect, useRef } from 'react';
import { Search, Film, Sparkles, PlusCircle, X, Menu } from 'lucide-react';
import type { DramaCategory, Drama } from '../types/drama.ts';
import { getAllDramas } from '../services/tmdb.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

interface NavbarProps {
  currentCategory: DramaCategory;
  onSelectCategory: (cat: DramaCategory) => void;
  onNavigateHome: () => void;
  onOpenDrama: (slug: string) => void;
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
  onOpenRequest,
  onOpenSync,
  onSearch,
  searchQuery,
}) => {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Drama[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  const categories: { label: string; value: DramaCategory }[] = [
    { label: 'All Drama', value: 'all' },
    { label: 'Hindi Dubbed K-Drama', value: 'hindi-dubbed' },
    { label: 'Trending', value: 'trending' },
    { label: 'Korean', value: 'korean' },
    { label: 'Chinese', value: 'chinese' },
    { label: 'Japanese', value: 'japanese' },
    { label: 'Indian', value: 'indian' },
  ];

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
    if (!searchQuery.trim() || searchQuery.length < 2) {
      setSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    const q = searchQuery.toLowerCase();
    const local = getAllDramas().filter(
      d =>
        (d.title || '').toLowerCase().includes(q) ||
        (d.hindiTitle || '').toLowerCase().includes(q) ||
        (d.genres || []).some(g => g.toLowerCase().includes(q)) ||
        (d.country || '').toLowerCase().includes(q)
    );

    setSuggestions(local.slice(0, 6));
    setShowSuggestions(true);
  }, [searchQuery]);

  const handleSelectSuggestion = (slug: string) => {
    setShowSuggestions(false);
    onOpenDrama(slug);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      setShowSuggestions(false);
      onSearch(searchQuery);
    }
  };

  return (
    <header className="sticky top-0 z-50 bg-[#0b0f19]/95 backdrop-blur-md border-b border-slate-800/80">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 gap-4">
          
          {/* Logo Zone */}
          <div className="flex items-center gap-3">
            <a
              href="/"
              onClick={e => {
                e.preventDefault();
                onNavigateHome();
              }}
              className="flex items-center gap-2 group text-left cursor-pointer"
            >
              <div className="w-9 h-9 rounded-lg bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/20 group-hover:scale-105 transition-transform">
                <Film className="w-5 h-5 text-white" />
              </div>
              <div className="flex flex-col">
                <span className="text-xl font-extrabold tracking-tight text-white group-hover:text-blue-400 transition-colors">
                  Hindi<span className="text-blue-500">Drama</span>
                </span>
                <span className="text-[10px] text-slate-400 -mt-1 hidden sm:inline tracking-wider font-medium">
                  Asian Dramas in Hindi Dubbed
                </span>
              </div>
            </a>
          </div>

          {/* Search Bar with Autocomplete */}
          <div ref={searchRef} className="relative flex-1 max-w-md hidden md:block">
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={e => onSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Search dramas, Korean, Chinese, Indian..."
                className="w-full bg-slate-900/90 text-slate-100 placeholder-slate-400 text-sm rounded-full pl-10 pr-9 py-2 border border-slate-700/70 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all shadow-inner"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-2.5 pointer-events-none" />
              {searchQuery && (
                <button
                  onClick={() => onSearch('')}
                  className="absolute right-3 top-2.5 text-slate-400 hover:text-white"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {showSuggestions && suggestions.length > 0 && (
              <div className="absolute left-0 right-0 top-full mt-2 bg-slate-900 border border-slate-700 rounded-xl shadow-2xl overflow-hidden z-50 divide-y divide-slate-800">
                {suggestions.map(drama => (
                  <a
                    key={drama.id}
                    href={`/drama/${drama.slug}`}
                    onClick={e => {
                      e.preventDefault();
                      handleSelectSuggestion(drama.slug);
                    }}
                    className="w-full text-left p-2.5 hover:bg-slate-800/80 flex items-center gap-3 transition-colors cursor-pointer"
                  >
                    <OptimizedImage
                      src={drama.poster}
                      alt={`${drama.title} Hindi Dubbed Poster`}
                      width={80}
                      height={112}
                      className="w-10 h-14 object-cover rounded bg-slate-800 shrink-0"
                    />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {drama.title}
                      </p>
                      <p className="text-xs text-slate-400 truncate">
                        {drama.country} • {drama.year} • {drama.totalEpisodes} Eps • Hindi Dubbed
                      </p>
                    </div>
                    <span className="text-xs font-semibold text-amber-400 shrink-0 mr-1">
                      ★ {drama.rating}
                    </span>
                  </a>
                ))}
                <button
                  onClick={() => {
                    setShowSuggestions(false);
                    onSearch(searchQuery);
                  }}
                  className="w-full py-2 bg-slate-800/50 hover:bg-blue-600 text-center text-xs font-medium text-blue-400 hover:text-white transition-colors"
                >
                  View all results for "{searchQuery}"
                </button>
              </div>
            )}
          </div>

          {/* Action Tools */}
          <div className="hidden lg:flex items-center gap-2">
            <button
              onClick={onOpenSync}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700/60 transition-colors cursor-pointer"
              title="Auto-Sync Asian Dramas via TMDB API"
            >
              <Sparkles className="w-3.5 h-3.5 text-blue-400" />
              <span>TMDB Auto-Sync</span>
            </button>
            <button
              onClick={onOpenRequest}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition-colors shadow-sm shadow-blue-500/20 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>Request Drama</span>
            </button>
          </div>

          {/* Mobile menu button */}
          <div className="flex md:hidden items-center gap-2">
            <button
              onClick={onOpenSync}
              className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-800/60"
              title="TMDB Sync"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
            </button>
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="p-2 text-slate-300 hover:text-white rounded-lg bg-slate-800"
            >
              {mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
          </div>

        </div>

        {/* Categories Bar */}
        <nav aria-label="Main Categories" className="flex items-center gap-1 sm:gap-2 overflow-x-auto py-2.5 no-scrollbar border-t border-slate-800/40">
          {categories.map(cat => {
            const isActive = currentCategory === cat.value && !searchQuery;
            const href = cat.value === 'all' ? '/' : `/category/${cat.value}`;
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
                className={`px-3.5 py-1.5 rounded-md text-xs sm:text-sm font-medium transition-all whitespace-nowrap cursor-pointer ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30 font-semibold'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/60'
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
        <div className="md:hidden border-t border-slate-800 bg-[#0b0f19] px-4 pt-3 pb-4 space-y-3">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={e => onSearch(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Search dramas, Korean, Chinese..."
              className="w-full bg-slate-900 text-slate-100 placeholder-slate-400 text-sm rounded-lg pl-10 pr-4 py-2 border border-slate-700 focus:outline-none focus:border-blue-500"
            />
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          </div>

          <div className="flex gap-2 pt-2">
            <button
              onClick={() => {
                onOpenRequest();
                setMobileMenuOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-blue-600 text-white"
            >
              <PlusCircle className="w-4 h-4" />
              Request Drama
            </button>
            <button
              onClick={() => {
                onOpenSync();
                setMobileMenuOpen(false);
              }}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold bg-slate-800 text-slate-200 border border-slate-700"
            >
              <Sparkles className="w-4 h-4 text-blue-400" />
              TMDB Auto-Sync
            </button>
          </div>
        </div>
      )}
    </header>
  );
};
