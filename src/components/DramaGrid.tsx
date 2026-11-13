import React from 'react';
import { Eye, Star, Play, SlidersHorizontal } from 'lucide-react';
import type { Drama, SortOption } from '../types/drama.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

interface DramaGridProps {
  dramas: Drama[];
  onOpenDrama: (slug: string) => void;
  onWatchEpisode: (slug: string, ep: number) => void;
  title?: string;
  subtitle?: string;
  sortBy: SortOption;
  onSortChange: (sort: SortOption) => void;
  currentPage: number;
  onPageChange: (page: number) => void;
}

export const DramaGrid: React.FC<DramaGridProps> = ({
  dramas,
  onOpenDrama,
  onWatchEpisode,
  title = 'Latest Added',
  subtitle,
  sortBy,
  onSortChange,
  currentPage,
  onPageChange,
}) => {
  const ITEMS_PER_PAGE = 18;
  const totalPages = Math.ceil(dramas.length / ITEMS_PER_PAGE) || 1;
  const paginatedDramas = dramas.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE);

  return (
    <section className="mb-14">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-slate-800 gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            {subtitle || `Showing ${dramas.length} Asian dramas in full Hindi dubbed audio`}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          <SlidersHorizontal className="w-4 h-4 text-slate-400" />
          <select
            aria-label="Sort Dramas"
            value={sortBy}
            onChange={e => {
              onSortChange(e.target.value as SortOption);
              onPageChange(1);
            }}
            className="bg-slate-900 text-slate-200 text-xs sm:text-sm font-medium border border-slate-700 rounded-lg px-3 py-1.5 focus:outline-none focus:border-blue-500 cursor-pointer"
          >
            <option value="latest">Latest Added</option>
            <option value="views">Most Viewed</option>
            <option value="rating">Top Rated</option>
            <option value="title">Title (A - Z)</option>
          </select>
        </div>
      </div>

      {paginatedDramas.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/30 rounded-2xl border border-dashed border-slate-800">
          <p className="text-slate-300 font-medium">No dramas found in this category.</p>
          <p className="text-xs text-slate-500 mt-1">Try another filter or search keyword.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {paginatedDramas.map(drama => (
            <a
              key={drama.id}
              href={`/drama/${drama.slug}`}
              onClick={e => {
                e.preventDefault();
                onOpenDrama(drama.slug);
              }}
              className="group cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-slate-800/80 border border-slate-800 group-hover:border-blue-500/70 shadow-md group-hover:shadow-blue-900/20 transition-all duration-300 group-hover:-translate-y-1">
                <OptimizedImage
                  src={drama.poster}
                  alt={`${drama.title} (${drama.year}) Hindi Dubbed Poster`}
                  width={342}
                  height={513}
                  sizes="(max-width: 640px) 50vw, 18vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute top-2 left-2 bg-slate-900/80 backdrop-blur-sm text-slate-200 text-[10px] font-semibold px-2 py-0.5 rounded border border-slate-700/50">
                  {drama.country} • {drama.year}
                </div>

                <div className="absolute bottom-2 left-2 flex items-center gap-1 bg-black/75 backdrop-blur-sm text-slate-200 text-[11px] font-medium px-2 py-0.5 rounded">
                  <Eye className="w-3 h-3 text-slate-300" />
                  <span>{drama.views}</span>
                </div>

                <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/90 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded shadow">
                  <Star className="w-3 h-3 fill-slate-950" />
                  <span>{drama.rating}</span>
                </div>

                <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <button
                    type="button"
                    aria-label={`Watch ${drama.title} latest episode`}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onWatchEpisode(drama.slug, drama.latestEpisode || 1);
                    }}
                    className="w-11 h-11 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/50 transform scale-90 group-hover:scale-100 transition-transform"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </button>
                </div>
              </div>

              <div className="mt-2.5 px-0.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                    {drama.title}
                  </h3>
                  <p className="text-[11px] text-blue-400 font-medium">
                    Hindi Dubbed
                  </p>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5">
                    {(drama.genres || []).join(', ')}
                  </p>
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 pt-1 border-t border-slate-800/60">
                  <span>Drama</span>
                  <span className="font-semibold text-slate-400">
                    {drama.totalEpisodes} {drama.totalEpisodes === 1 ? 'Movie' : 'Episodes'}
                  </span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 mt-10">
          <button
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            « Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1).map(page => (
            <button
              key={page}
              onClick={() => onPageChange(page)}
              className={`w-8 h-8 rounded-lg text-xs sm:text-sm font-medium transition-colors ${
                currentPage === page
                  ? 'bg-blue-600 text-white font-bold shadow-md shadow-blue-600/30'
                  : 'bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800'
              }`}
            >
              {page}
            </button>
          ))}

          <button
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-slate-700 bg-slate-900 text-xs sm:text-sm font-medium text-slate-300 hover:bg-slate-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            Next »
          </button>
        </div>
      )}
    </section>
  );
};
