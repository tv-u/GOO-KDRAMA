import React, { useMemo, useState } from 'react';
import { Film, Play, Search, Star, SlidersHorizontal, X } from 'lucide-react';
import type { Drama } from '../types/drama.ts';
import { OptimizedImage } from './OptimizedImage.tsx';
import { AdsterraBanner } from './AdsterraBanner.tsx';

interface MoviesDirectoryProps {
  dramas: Drama[];
  page: number;
  onPageChange: (page: number) => void;
  onOpenMovie: (slug: string) => void;
  onWatchMovie: (slug: string) => void;
  onBack: () => void;
}

const COUNTRY_FILTERS = ['All', 'Korean', 'Japanese', 'Chinese', 'Indian', 'Thai'];

export const MoviesDirectory: React.FC<MoviesDirectoryProps> = ({
  dramas,
  page,
  onPageChange,
  onOpenMovie,
  onWatchMovie,
  onBack,
}) => {
  const [query, setQuery] = useState('');
  const [countryFilter, setCountryFilter] = useState('All');
  const [sortBy, setSortBy] = useState<'popular' | 'rating' | 'year' | 'title'>('popular');

  const allMovies = useMemo(() => dramas.filter(d => d.type === 'movie'), [dramas]);

  const filteredMovies = useMemo(() => {
    let list = [...allMovies];
    if (query.trim()) {
      const q = query.trim().toLowerCase();
      list = list.filter(
        m =>
          m.title.toLowerCase().includes(q) ||
          m.country.toLowerCase().includes(q) ||
          (m.genres || []).some(g => g.toLowerCase().includes(q)) ||
          String(m.year).includes(q)
      );
    }
    if (countryFilter !== 'All') {
      list = list.filter(m => m.country.toLowerCase() === countryFilter.toLowerCase());
    }
    if (sortBy === 'rating') list.sort((a, b) => b.rating - a.rating);
    else if (sortBy === 'year') list.sort((a, b) => b.year - a.year);
    else if (sortBy === 'title') list.sort((a, b) => a.title.localeCompare(b.title));
    else list.sort((a, b) => (b.popularityScore || 0) - (a.popularityScore || 0));

    return list;
  }, [allMovies, query, countryFilter, sortBy]);

  const ITEMS_PER_PAGE = 24;
  const totalPages = Math.max(1, Math.ceil(filteredMovies.length / ITEMS_PER_PAGE));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const paginated = filteredMovies.slice(
    (safePage - 1) * ITEMS_PER_PAGE,
    safePage * ITEMS_PER_PAGE
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs text-slate-400 mb-5">
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            onBack();
          }}
          className="text-[#00c896] hover:underline font-medium"
        >
          Home
        </a>
        <span>/</span>
        <span className="text-white font-semibold">All Movies Directory ({allMovies.length})</span>
      </nav>

      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 pb-5 mb-6 border-b border-[#1e2638]">
        <div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight flex items-center gap-2.5">
            <Film className="w-6 h-6 text-[#00c896]" />
            <span>Asian &amp; Global Movies Index</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1 tabular-nums">
            Showing {paginated.length} of {filteredMovies.length} individual SEO-ready movie pages (Page {safePage} of {totalPages})
          </p>
        </div>

        {/* Controls */}
        <div className="flex flex-wrap items-center gap-2.5">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 text-[#00c896] absolute left-3 top-2.5 pointer-events-none" />
            <input
              type="text"
              value={query}
              onChange={e => {
                setQuery(e.target.value);
                onPageChange(1);
              }}
              placeholder="Filter 500+ movies..."
              className="w-full bg-[#111622] border border-[#1e2638] rounded-lg pl-9 pr-8 py-2 text-xs sm:text-sm text-white placeholder-slate-400 focus:outline-none focus:border-[#00c896]"
            />
            {query && (
              <button
                type="button"
                onClick={() => {
                  setQuery('');
                  onPageChange(1);
                }}
                aria-label="Clear filter"
                className="absolute right-2.5 top-2.5 text-slate-400 hover:text-white cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-1.5">
            <SlidersHorizontal className="w-4 h-4 text-slate-400" />
            <select
              aria-label="Sort Movies"
              value={sortBy}
              onChange={e => {
                setSortBy(e.target.value as any);
                onPageChange(1);
              }}
              className="bg-[#111622] border border-[#1e2638] rounded-lg px-3 py-2 text-xs sm:text-sm text-slate-200 focus:outline-none focus:border-[#00c896] cursor-pointer"
            >
              <option value="popular">Most Popular</option>
              <option value="rating">Top Rated</option>
              <option value="year">Newest Release</option>
              <option value="title">Title (A - Z)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Country Filter Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar mb-6">
        {COUNTRY_FILTERS.map(country => {
          const active = countryFilter === country;
          return (
            <button
              key={country}
              type="button"
              onClick={() => {
                setCountryFilter(country);
                onPageChange(1);
              }}
              className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                active
                  ? 'bg-[#00c896] text-slate-950 border-[#00c896]'
                  : 'bg-[#111622] hover:bg-[#1a2234] text-slate-300 border-[#1e2638]'
              }`}
            >
              {country}
            </button>
          );
        })}
      </div>

      <AdsterraBanner type="native" className="mb-8" />

      {/* Movies Grid — Each card opens its own unique /movie/:slug page */}
      {paginated.length === 0 ? (
        <div className="text-center py-16 bg-[#111622] border border-[#1e2638] rounded-2xl">
          <p className="text-slate-200 font-semibold">No movies match your current filter.</p>
          <button
            type="button"
            onClick={() => {
              setQuery('');
              setCountryFilter('All');
              onPageChange(1);
            }}
            className="mt-3 px-4 py-2 rounded-lg bg-[#00c896] text-slate-950 text-xs font-bold cursor-pointer"
          >
            Reset Filters
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {paginated.map(movie => (
            <a
              key={`${movie.slug}-${movie.tmdbId}`}
              href={`/movie/${movie.slug}`}
              onClick={e => {
                e.preventDefault();
                onOpenMovie(movie.slug);
              }}
              className="group cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#111622] border border-[#1e2638] group-hover:border-[#00c896]/70 shadow-md transition-all duration-300 group-hover:-translate-y-1">
                <OptimizedImage
                  src={movie.poster}
                  alt={`${movie.title} (${movie.year}) Movie Poster`}
                  width={342}
                  height={513}
                  sizes="(max-width: 640px) 50vw, 18vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14]/90 via-transparent to-transparent" />

                <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#0a0d14]/85 text-amber-400 font-bold text-[11px] px-1.5 py-0.5 rounded tabular-nums">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{movie.rating}</span>
                </div>

                <div className="absolute bottom-2 left-2 bg-[#00c896] text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded">
                  HD
                </div>

                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Watch ${movie.title}`}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onWatchMovie(movie.slug);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onWatchMovie(movie.slug);
                      }
                    }}
                    className="w-11 h-11 rounded-full bg-[#00c896] text-slate-950 flex items-center justify-center shadow-xl"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </span>
                </div>
              </div>

              <div className="mt-2.5 px-0.5">
                <h2 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-[#00c896] transition-colors line-clamp-1">
                  {movie.title}
                </h2>
                <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 tabular-nums">
                  {movie.year} · {movie.country} · {(movie.genres || [])[0] || 'Movie'}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {/* SEO-Crawlable Anchor Pagination */}
      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
          <a
            href={safePage <= 2 ? '/movies' : `/movies/page/${safePage - 1}`}
            onClick={e => {
              e.preventDefault();
              if (safePage > 1) onPageChange(safePage - 1);
            }}
            className={`px-3 py-1.5 rounded-lg border border-[#1e2638] bg-[#111622] text-xs sm:text-sm font-medium transition-colors ${
              safePage === 1
                ? 'opacity-40 pointer-events-none text-slate-500'
                : 'text-slate-200 hover:bg-[#1a2234]'
            }`}
          >
            « Prev
          </a>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, safePage - 4), Math.min(totalPages, safePage + 4))
            .map(p => (
              <a
                key={p}
                href={p === 1 ? '/movies' : `/movies/page/${p}`}
                onClick={e => {
                  e.preventDefault();
                  onPageChange(p);
                }}
                className={`w-9 h-9 flex items-center justify-center rounded-lg text-xs sm:text-sm font-semibold transition-colors ${
                  safePage === p
                    ? 'bg-[#00c896] text-slate-950 font-bold'
                    : 'bg-[#111622] border border-[#1e2638] text-slate-300 hover:bg-[#1a2234]'
                }`}
              >
                {p}
              </a>
            ))}

          <a
            href={`/movies/page/${Math.min(totalPages, safePage + 1)}`}
            onClick={e => {
              e.preventDefault();
              if (safePage < totalPages) onPageChange(safePage + 1);
            }}
            className={`px-3 py-1.5 rounded-lg border border-[#1e2638] bg-[#111622] text-xs sm:text-sm font-medium transition-colors ${
              safePage === totalPages
                ? 'opacity-40 pointer-events-none text-slate-500'
                : 'text-slate-200 hover:bg-[#1a2234]'
            }`}
          >
            Next »
          </a>
        </div>
      )}
    </div>
  );
};
