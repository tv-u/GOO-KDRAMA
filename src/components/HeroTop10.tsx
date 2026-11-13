import React, { useRef } from 'react';
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

  if (!dramas || dramas.length === 0) {
    return null;
  }

  const top10Slugs = [
    'the-remarried-empress',
    'love-in-disguise',
    'study-group',
    'final-table',
    'dead-end-job',
    'make-me-tingle',
    'love-between-lines',
    'doctor-x-mafia-in-white',
    'my-dearest-nemesis',
    'my-demon',
  ];

  const top10List = top10Slugs
    .map((slug, idx) => {
      const found = dramas.find(d => d.slug === slug);
      if (found) return { ...found, rank: idx + 1 };
      const fallback = dramas[idx % dramas.length] || dramas[0];
      if (!fallback) return null;
      return { ...fallback, rank: idx + 1 };
    })
    .filter(Boolean) as (Drama & { rank: number })[];

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
        <div className="flex items-baseline gap-2">
          <h1 className="text-xl sm:text-2xl font-bold text-white tracking-tight">
            Top 10 <span className="text-blue-500 font-normal">·</span> <span className="italic font-serif font-normal text-slate-300">This Week</span>
          </h1>
          <span className="text-xs text-slate-400 hidden sm:inline">Most streamed Hindi dubbed Asian dramas</span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            onClick={() => scroll('left')}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors border border-slate-700/60 cursor-pointer shadow-sm"
            aria-label="Previous Top 10"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={() => scroll('right')}
            className="w-8 h-8 rounded-full bg-slate-800 hover:bg-slate-700 text-slate-200 flex items-center justify-center transition-colors border border-slate-700/60 cursor-pointer shadow-sm"
            aria-label="Next Top 10"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-x-auto pb-3 pt-1 scrollbar-thin scrollbar-thumb-slate-800 scrollbar-track-transparent snap-x snap-mandatory"
        style={{ scrollbarWidth: 'none' }}
      >
        {top10List.map((item, idx) => (
          <a
            key={item.id + item.rank}
            href={`/drama/${item.slug}`}
            className="relative shrink-0 w-44 sm:w-52 group cursor-pointer snap-start block"
            onClick={e => {
              e.preventDefault();
              onOpenDrama(item.slug);
            }}
          >
            <div className="relative aspect-[2/3] w-full rounded-xl overflow-hidden bg-slate-800/80 border border-slate-800 group-hover:border-blue-500/60 shadow-lg transition-all duration-300 group-hover:-translate-y-1">
              <OptimizedImage
                src={item.poster}
                alt={`${item.title} (${item.year}) Hindi Dubbed Poster`}
                width={342}
                height={513}
                sizes="(max-width: 640px) 176px, 208px"
                priority={idx < 4}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />

              <div className="absolute top-2 left-2 bg-blue-600/90 text-white text-[10px] font-bold px-2 py-0.5 rounded tracking-wide shadow">
                HINDI DUBBED
              </div>

              <div className="absolute bottom-1 right-2 text-5xl sm:text-6xl font-black italic text-white/90 drop-shadow-[0_4px_10px_rgba(0,0,0,0.9)] select-none pointer-events-none font-mono">
                #{item.rank}
              </div>

              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <button
                  type="button"
                  aria-label={`Watch ${item.title} Episode 1`}
                  onClick={e => {
                    e.preventDefault();
                    e.stopPropagation();
                    onWatchEpisode(item.slug, 1);
                  }}
                  className="w-12 h-12 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-xl shadow-blue-600/40 transform scale-90 group-hover:scale-100 transition-transform"
                >
                  <Play className="w-5 h-5 fill-current ml-0.5" />
                </button>
              </div>
            </div>

            <div className="mt-2.5 px-0.5">
              <div className="flex items-center gap-1.5 text-xs text-amber-400 font-semibold mb-0.5">
                <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                <span>{item.rating}</span>
                <span className="text-slate-500 font-normal">·</span>
                <span className="text-slate-400 font-normal">{item.country}</span>
              </div>
              <h2 className="text-sm font-bold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                {item.title}
              </h2>
              <p className="text-[11px] text-slate-400 truncate">
                {(item.genres || []).slice(0, 2).join(', ')} • {item.totalEpisodes || 16} Episodes
              </p>
            </div>
          </a>
        ))}
      </div>
    </section>
  );
};
