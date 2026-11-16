import React from 'react';
import { Star, Play, SlidersHorizontal } from 'lucide-react';
import type { Drama, SortOption } from '../types/drama.ts';
import { trackPlatformEvent } from '../services/storage.ts';
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
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-4 mb-6 border-b border-[#1e2638] gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            {title}
          </h2>
          <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
            {subtitle || `Showing ${dramas.length} Asian dramas & movies in HD`}
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
            className="bg-[#111622] text-slate-200 text-xs sm:text-sm font-medium border border-[#1e2638] rounded-lg px-3 py-1.5 focus:outline-none focus:border-[#00c896] cursor-pointer"
          >
            <option value="latest">Latest Added</option>
            <option value="views">Most Viewed</option>
            <option value="rating">Top Rated</option>
            <option value="title">Title (A - Z)</option>
          </select>
        </div>
      </div>

      {paginatedDramas.length === 0 ? (
        <div className="text-center py-16 bg-[#111622]/60 rounded-2xl border border-dashed border-[#1e2638]">
          <p className="text-slate-300 font-medium">No dramas found in this category.</p>
          <p className="text-xs text-slate-500 mt-1">Try another filter or search keyword.</p>
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4 sm:gap-5">
          {paginatedDramas.map(drama => (
            <a
              key={`${drama.id}-${drama.tmdbId || 0}`}
              href={drama.type === 'movie' ? `/movie/${drama.slug}` : `/drama/${drama.slug}`}
              onClick={e => {
                e.preventDefault();
                trackPlatformEvent({
                  type: 'poster_click',
                  dramaSlug: drama.slug,
                  dramaTitle: drama.title,
                });
                onOpenDrama(drama.slug);
              }}
              className="group cursor-pointer flex flex-col"
            >
              <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#111622] border border-[#1e2638] group-hover:border-[#00c896]/70 shadow-md transition-all duration-300 group-hover:-translate-y-1">
                <OptimizedImage
                  src={drama.poster}
                  alt={`${drama.title} (${drama.year}) Hindi Dubbed Poster`}
                  width={342}
                  height={513}
                  sizes="(max-width: 640px) 50vw, 18vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14]/90 via-transparent to-transparent" />

                <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#0a0d14]/85 text-amber-400 font-bold text-[11px] px-1.5 py-0.5 rounded tabular-nums">
                  <Star className="w-3 h-3 fill-amber-400" />
                  <span>{drama.rating}</span>
                </div>

                <div className="absolute bottom-2 left-2 bg-[#00c896] text-slate-950 text-[10px] font-extrabold px-1.5 py-0.5 rounded tabular-nums uppercase">
                  {drama.type === 'movie'
                    ? 'HD'
                    : drama.status === 'Completed'
                      ? 'COMPLETED'
                      : 'ONGOING'}
                </div>

                <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                  <span
                    role="button"
                    tabIndex={0}
                    aria-label={`Watch ${drama.title} latest episode`}
                    onClick={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      onWatchEpisode(drama.slug, drama.latestEpisode || 1);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        e.stopPropagation();
                        onWatchEpisode(drama.slug, drama.latestEpisode || 1);
                      }
                    }}
                    className="w-11 h-11 rounded-full bg-[#00c896] text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/30 transform scale-90 group-hover:scale-100 transition-transform"
                  >
                    <Play className="w-5 h-5 fill-current ml-0.5" />
                  </span>
                </div>
              </div>

              <div className="mt-2.5 px-0.5 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="text-xs sm:text-sm font-bold text-slate-100 group-hover:text-[#00c896] transition-colors line-clamp-1">
                    {drama.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 line-clamp-1 mt-0.5 tabular-nums">
                    {drama.year} · {drama.country} · {drama.type === 'movie' ? 'Movie' : `${drama.totalEpisodes} Eps`}
                  </p>
                </div>
                <p className="text-[11px] text-slate-500 line-clamp-1 mt-1">
                  {(drama.genres || []).slice(0, 2).join(', ')}
                </p>
              </div>
            </a>
          ))}
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex flex-wrap items-center justify-center gap-2 mt-10">
          <button
            type="button"
            onClick={() => onPageChange(Math.max(1, currentPage - 1))}
            disabled={currentPage === 1}
            className="px-3 py-1.5 rounded-lg border border-[#1e2638] bg-[#111622] text-xs sm:text-sm font-medium text-slate-300 hover:bg-[#1a2234] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            « Prev
          </button>

          {Array.from({ length: totalPages }, (_, i) => i + 1)
            .slice(Math.max(0, currentPage - 4), Math.min(totalPages, currentPage + 3))
            .map(page => (
              <button
                key={page}
                type="button"
                onClick={() => onPageChange(page)}
                className={`w-8 h-8 rounded-lg text-xs sm:text-sm font-medium transition-colors cursor-pointer ${
                  currentPage === page
                    ? 'bg-[#00c896] text-slate-950 font-bold shadow-md shadow-emerald-500/20'
                    : 'bg-[#111622] border border-[#1e2638] text-slate-300 hover:bg-[#1a2234]'
                }`}
              >
                {page}
              </button>
            ))}

          <button
            type="button"
            onClick={() => onPageChange(Math.min(totalPages, currentPage + 1))}
            disabled={currentPage === totalPages}
            className="px-3 py-1.5 rounded-lg border border-[#1e2638] bg-[#111622] text-xs sm:text-sm font-medium text-slate-300 hover:bg-[#1a2234] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
          >
            Next »
          </button>
        </div>
      )}
    </section>
  );
};
