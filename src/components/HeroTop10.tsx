import React, { useMemo, useRef } from 'react';
import { Star, ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { Drama } from '../types/drama.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

interface HeroTop10Props {
  dramas: Drama[];
  onOpenDrama: (slug: string) => void;
  onWatchEpisode: (slug: string, ep: number) => void;
}

export const HeroTop10: React.FC<HeroTop10Props> = ({ dramas, onOpenDrama, onWatchEpisode }) => {
  const scrollRef = useRef<HTMLDivElement>(null);

  const top10List = useMemo(() => {
    if (!dramas || dramas.length === 0) return [];
    const sorted = [...dramas].sort((a, b) => {
      const popDiff = (b.popularityScore || 0) - (a.popularityScore || 0);
      if (popDiff !== 0) return popDiff;
      return (b.rating || 0) - (a.rating || 0);
    });
    return sorted.slice(0, 10).map((item, idx) => ({ ...item, rank: idx + 1 }));
  }, [dramas]);

  if (top10List.length === 0) {
    return null;
  }

  const scroll = (direction: 'left' | 'right') => {
    if (scrollRef.current) {
      const { scrollLeft, clientWidth } = scrollRef.current;
      const scrollAmount = clientWidth * 0.75;
      scrollRef.current.scrollTo({
        left: direction === 'left' ? scrollLeft - scrollAmount : scrollLeft + scrollAmount,
        behavior: 'smooth',
      });
    }
  };

  return (
    <section className="mb-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2.5">
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Top 10 Trending <span className="text-[#00c896]">·</span>{' '}
            <span className="text-slate-400 font-medium text-sm sm:text-base">This Week</span>
          </h2>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-lg bg-[#111622] hover:bg-[#1a2234] text-slate-200 flex items-center justify-center transition-colors border border-[#1e2638] cursor-pointer"
            aria-label="Previous Top 10"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-lg bg-[#111622] hover:bg-[#1a2234] text-slate-200 flex items-center justify-center transition-colors border border-[#1e2638] cursor-pointer"
            aria-label="Next Top 10"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-1 no-scrollbar snap-x snap-mandatory"
      >
        {top10List.map((item, idx) => (
          <a
            key={`${item.slug}-${item.rank}`}
            href={item.type === 'movie' ? `/movie/${item.slug}` : `/drama/${item.slug}`}
            className="relative shrink-0 w-44 sm:w-52 group cursor-pointer snap-start block"
            onClick={e => {
              e.preventDefault();
              onOpenDrama(item.slug);
            }}
          >
            <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-[#111622] border border-[#1e2638] group-hover:border-[#00c896]/70 shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <OptimizedImage
                src={item.poster}
                alt={`${item.title} (${item.year}) Hindi Dubbed Poster`}
                width={342}
                height={513}
                sizes="(max-width: 640px) 176px, 208px"
                priority={idx < 4}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-transparent to-transparent" />

              <div className="absolute bottom-1 right-2 text-5xl sm:text-6xl font-black italic text-[#00c896]/95 drop-shadow-[0_4px_12px_rgba(0,0,0,0.95)] select-none pointer-events-none font-mono">
                #{item.rank}
              </div>

              <div className="absolute inset-0 bg-black/45 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <span
                  role="button"
                  tabIndex={0}
                  aria-label={`Watch ${item.title} Episode 1`}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onWatchEpisode(item.slug, 1);
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      e.stopPropagation();
                      onWatchEpisode(item.slug, 1);
                    }
                  }}
                  className="w-12 h-12 rounded-full bg-[#00c896] text-slate-950 flex items-center justify-center shadow-xl shadow-emerald-500/30 transform scale-90 group-hover:scale-100 transition-transform"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </span>
              </div>
            </div>

            <div className="mt-2.5 px-0.5">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-0.5 tabular-nums">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{item.rating}</span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-slate-400 font-normal">{item.country}</span>
              </div>
              <h3 className="text-sm font-bold text-slate-100 group-hover:text-[#00c896] transition-colors line-clamp-1">
                {item.title}
              </h3>
              <p className="text-[11px] text-slate-400 truncate tabular-nums">
                {(item.genres || []).slice(0, 2).join(', ')} ·{' '}
                {item.type === 'movie' ? 'Movie' : `${item.totalEpisodes || 16} Eps`}
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};
