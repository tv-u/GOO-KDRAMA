import React, { useRef } from 'react';
import { ChevronLeft, ChevronRight, Play, Star, X } from 'lucide-react';
import type { Drama } from '../types/drama.ts';
import { trackPlatformEvent } from '../services/storage.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

export interface CarouselCardItem {
  slug: string;
  title: string;
  poster: string;
  rating?: number;
  country?: string;
  year?: number;
  episode?: number;
  totalEpisodes?: number;
  type?: 'tv' | 'movie';
  progressPercent?: number;
  resumeLabel?: string;
}

interface OttCarouselRowProps {
  title: string;
  subtitle?: string;
  items: CarouselCardItem[];
  loading?: boolean;
  headerRight?: React.ReactNode;
  onOpenDrama: (slug: string) => void;
  onWatchEpisode?: (slug: string, ep: number) => void;
  onRemoveItem?: (slug: string) => void;
  onViewAll?: () => void;
}

export function mapDramaToCarouselItem(drama: Drama): CarouselCardItem {
  return {
    slug: drama.slug,
    title: drama.title,
    poster: drama.poster,
    rating: drama.rating,
    country: drama.country,
    year: drama.year,
    totalEpisodes: drama.totalEpisodes,
    type: drama.type,
  };
}

export const OttCarouselRow: React.FC<OttCarouselRowProps> = ({
  title,
  subtitle,
  items,
  loading = false,
  headerRight,
  onOpenDrama,
  onWatchEpisode,
  onRemoveItem,
  onViewAll,
}) => {
  const trackRef = useRef<HTMLDivElement>(null);

  if (!loading && (!items || items.length === 0)) return null;

  const scroll = (dir: 'left' | 'right') => {
    if (!trackRef.current) return;
    const { scrollLeft, clientWidth } = trackRef.current;
    const delta = clientWidth * 0.78;
    trackRef.current.scrollTo({
      left: dir === 'left' ? scrollLeft - delta : scrollLeft + delta,
      behavior: 'smooth',
    });
  };

  return (
    <section className="mb-10">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-3.5">
        <div className="min-w-0 flex flex-wrap items-center gap-3">
          <div>
            <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">{title}</h2>
            {subtitle && (
              <p className="text-xs text-slate-400 mt-0.5 truncate">{subtitle}</p>
            )}
          </div>
          {headerRight}
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {onViewAll && (
            <button
              type="button"
              onClick={onViewAll}
              className="text-xs font-semibold text-[#00c896] hover:text-[#34d399] px-2 py-1 cursor-pointer whitespace-nowrap shrink-0"
            >
              View All →
            </button>
          )}
          <button
            type="button"
            onClick={() => scroll('left')}
            aria-label={`Scroll ${title} left`}
            className="w-8 h-8 rounded-lg bg-[#111622] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            aria-label={`Scroll ${title} right`}
            className="w-8 h-8 rounded-lg bg-[#111622] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] flex items-center justify-center cursor-pointer transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={trackRef}
        className="flex gap-3.5 sm:gap-4 overflow-x-auto pb-2 no-scrollbar snap-x snap-mandatory"
      >
        {loading
          ? Array.from({ length: 6 }).map((_, idx) => (
              <div key={idx} className="w-36 sm:w-44 shrink-0 space-y-2">
                <div className="aspect-[2/3] rounded-xl bg-[#111622] animate-pulse border border-[#1e2638]" />
                <div className="h-3.5 bg-[#111622] rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-[#111622] rounded w-1/2 animate-pulse" />
              </div>
            ))
          : items.map(item => {
              const targetHref = item.episode
                ? item.type === 'movie'
                  ? `/watch/${item.slug}`
                  : `/watch/${item.slug}/episode-${item.episode}`
                : item.type === 'movie'
                  ? `/movie/${item.slug}`
                  : `/drama/${item.slug}`;
              return (
                <div
                  key={`${item.slug}-${item.episode || 0}`}
                  className="relative w-36 sm:w-44 shrink-0 group snap-start"
                >
                  {onRemoveItem && (
                    <button
                      type="button"
                      onClick={e => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemoveItem(item.slug);
                      }}
                      aria-label={`Remove ${item.title}`}
                      className="absolute top-2 right-2 z-20 w-7 h-7 rounded-lg bg-[#0a0d14]/85 hover:bg-rose-600 text-slate-200 hover:text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}

                  <a
                    href={targetHref}
                    onClick={e => {
                      e.preventDefault();
                      trackPlatformEvent({
                        type: 'poster_click',
                        dramaSlug: item.slug,
                        dramaTitle: item.title,
                      });
                      if (item.episode && onWatchEpisode) {
                        onWatchEpisode(item.slug, item.episode);
                      } else {
                        onOpenDrama(item.slug);
                      }
                    }}
                    className="block cursor-pointer"
                  >
                    <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#111622] border border-[#1e2638] group-hover:border-[#00c896]/70 transition-colors">
                      <OptimizedImage
                        src={item.poster}
                        alt={`${item.title} Hindi Dubbed Poster`}
                        width={342}
                        height={513}
                        sizes="(max-width: 640px) 144px, 176px"
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />

                      <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14]/85 via-transparent to-transparent" />

                      <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                        <span className="w-10 h-10 rounded-full bg-[#00c896] text-slate-950 flex items-center justify-center shadow-lg">
                          <Play className="w-4 h-4 fill-current ml-0.5" />
                        </span>
                      </div>

                      {typeof item.progressPercent === 'number' && (
                        <div className="absolute bottom-0 inset-x-0 bg-[#111622]/90 h-1.5">
                          <div
                            className="bg-[#00c896] h-full transition-all"
                            style={{ width: `${Math.max(4, Math.min(100, item.progressPercent))}%` }}
                          />
                        </div>
                      )}
                    </div>

                    <div className="mt-2 px-0.5">
                      <h3 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-[#00c896] transition-colors line-clamp-1">
                        {item.title}
                      </h3>
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-400 mt-0.5 tabular-nums truncate">
                        {item.resumeLabel ? (
                          <span className="text-[#00c896] font-medium">{item.resumeLabel}</span>
                        ) : (
                          <>
                            {item.rating && (
                              <span className="inline-flex items-center gap-0.5 text-amber-400 font-medium">
                                <Star className="w-3 h-3 fill-amber-400" />
                                {item.rating}
                              </span>
                            )}
                            {item.year && (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{item.year}</span>
                              </>
                            )}
                            {item.type === 'movie' ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>Movie</span>
                              </>
                            ) : item.totalEpisodes ? (
                              <>
                                <span aria-hidden="true">·</span>
                                <span>{item.totalEpisodes} Eps</span>
                              </>
                            ) : null}
                          </>
                        )}
                      </div>
                    </div>
                  </a>
                </div>
              );
            })}
      </div>
    </section>
  );
};
