import React from 'react';
import { ArrowLeft, Tag } from 'lucide-react';
import type { Drama, SortOption } from '../types/drama.ts';
import { DramaGrid } from './DramaGrid.tsx';
import { AdsterraBanner } from './AdsterraBanner.tsx';
import { slugifyText } from '../services/seo.ts';

interface GenrePageProps {
  genreSlug: string;
  allDramas: Drama[];
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
  onOpenDrama: (slug: string) => void;
  onWatchEpisode: (slug: string, ep: number) => void;
  onSelectGenre: (genreSlug: string) => void;
  onBack: () => void;
}

export const GenrePage: React.FC<GenrePageProps> = ({
  genreSlug,
  allDramas,
  sortBy,
  onSortChange,
  currentPage,
  onPageChange,
  onOpenDrama,
  onWatchEpisode,
  onSelectGenre,
  onBack,
}) => {
  const cleanGenre = genreSlug.toLowerCase();

  // Extract all unique genres for cross-linking
  const allGenres = Array.from(
    new Set(allDramas.flatMap(d => d.genres || []))
  ).sort();

  const matchedLabel =
    allGenres.find(g => slugifyText(g) === cleanGenre) ||
    genreSlug.replace(/-/g, ' ').replace(/\b\w/g, c => c.toUpperCase());

  const matchingDramas = allDramas.filter(d =>
    (d.genres || []).some(g => slugifyText(g) === cleanGenre || g.toLowerCase() === cleanGenre)
  );

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Breadcrumb */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mb-5">
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            onBack();
          }}
          className="text-blue-500 hover:text-blue-400 font-medium"
        >
          Home
        </a>
        <span>/</span>
        <span>Genres</span>
        <span>/</span>
        <span className="text-slate-200 font-semibold">{matchedLabel} Dramas</span>
      </nav>

      {/* Genre Hero Banner */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-blue-400 text-xs font-bold uppercase tracking-wider mb-1">
              <Tag className="w-3.5 h-3.5" />
              <span>Genre Collection</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
              Best {matchedLabel} Dramas in Hindi Dubbed
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 mt-1">
              Watch {matchingDramas.length} top-rated {matchedLabel} Korean, Chinese, Japanese, and Indian series online free in 1080p HD.
            </p>
          </div>

          <button
            onClick={onBack}
            className="self-start sm:self-auto flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>All Dramas</span>
          </button>
        </div>

        {/* Genre Internal SEO Links */}
        <div className="flex flex-wrap gap-2 mt-5 pt-4 border-t border-slate-800/80">
          {allGenres.slice(0, 18).map(g => {
            const gSlug = slugifyText(g);
            const isActive = gSlug === cleanGenre;
            return (
              <a
                key={g}
                href={`/genre/${gSlug}`}
                onClick={e => {
                  e.preventDefault();
                  onSelectGenre(gSlug);
                }}
                className={`px-3 py-1 rounded-md text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-blue-600 text-white font-semibold'
                    : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                }`}
              >
                {g}
              </a>
            );
          })}
        </div>
      </div>

      <AdsterraBanner type="native" className="mb-8" />

      <DramaGrid
        dramas={matchingDramas}
        onOpenDrama={onOpenDrama}
        onWatchEpisode={onWatchEpisode}
        title={`${matchedLabel} Hindi Dubbed Series`}
        sortBy={sortBy}
        onSortChange={onSortChange}
        currentPage={currentPage}
        onPageChange={onPageChange}
      />
    </div>
  );
};
