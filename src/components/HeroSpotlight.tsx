import React, { useState, useEffect } from 'react';
import { Play, Info, Bookmark, Check, ChevronLeft, ChevronRight, Star } from 'lucide-react';
import type { Drama } from '../types/drama.ts';
import { isInWatchlist, toggleWatchlist, trackPlatformEvent } from '../services/storage.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

interface HeroSpotlightProps {
  dramas: Drama[];
  onOpenDrama: (slug: string) => void;
  onWatchEpisode: (slug: string, ep: number) => void;
}

export const HeroSpotlight: React.FC<HeroSpotlightProps> = ({
  dramas,
  onOpenDrama,
  onWatchEpisode,
}) => {
  const featured = dramas
    .filter(d => d.backdrop && d.overview)
    .slice(0, 7);

  const [activeIndex, setActiveIndex] = useState(0);
  const [inWatchlist, setInWatchlist] = useState(false);

  const active = featured[activeIndex % Math.max(1, featured.length)] || dramas[0];

  useEffect(() => {
    if (!active) return;
    setInWatchlist(isInWatchlist(active.slug));
  }, [active]);

  useEffect(() => {
    if (featured.length <= 1) return;
    const id = setInterval(() => {
      setActiveIndex(prev => (prev + 1) % featured.length);
    }, 8000);
    return () => clearInterval(id);
  }, [featured.length]);

  if (!active) return null;

  const handleToggleWatchlist = () => {
    const res = toggleWatchlist({
      slug: active.slug,
      title: active.title,
      poster: active.poster,
      country: active.country,
      year: active.year,
      rating: active.rating,
      totalEpisodes: active.totalEpisodes,
      type: active.type,
      genres: active.genres,
    });
    setInWatchlist(res.added);
  };

  return (
    <section
      aria-label="Featured Title"
      className="relative mb-8 rounded-2xl overflow-hidden border border-[#1e2638] bg-[#111622]"
    >
      <div className="relative h-[340px] sm:h-[420px] lg:h-[470px] w-full">
        <OptimizedImage
          src={active.backdrop || active.poster}
          alt={`${active.title} (${active.year}) Featured Backdrop`}
          width={1280}
          height={720}
          sizes="100vw"
          priority
          className="w-full h-full object-cover object-center transition-opacity duration-500"
        />

        {/* FlixHQ scrims for strong editorial contrast */}
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/65 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0d14]/95 via-[#0a0d14]/55 to-transparent" />

        {/* Foreground Content */}
        <div className="absolute inset-0 flex flex-col justify-end p-5 sm:p-8 lg:p-10 max-w-2xl">
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-300 font-medium mb-2 tabular-nums">
            <span className="text-[#00c896] font-bold uppercase tracking-wider">HD</span>
            <span aria-hidden="true">·</span>
            <span className="inline-flex items-center gap-1 text-amber-400 font-semibold">
              <Star className="w-3.5 h-3.5 fill-amber-400" />
              {active.rating}
            </span>
            <span aria-hidden="true">·</span>
            <span>{active.country}</span>
            <span aria-hidden="true">·</span>
            <span>{active.year}</span>
            <span aria-hidden="true">·</span>
            <span>
              {active.type === 'movie'
                ? active.duration || 'Full Movie'
                : active.status === 'Completed'
                  ? 'Completed'
                  : 'Ongoing'}
            </span>
            {(active.genres || []).length > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="text-slate-300">{active.genres.slice(0, 2).join(', ')}</span>
              </>
            )}
          </div>

          <h1 className="text-2xl sm:text-4xl lg:text-5xl font-extrabold text-white tracking-tight leading-tight text-balance">
            {active.title}
          </h1>

          <p className="text-xs sm:text-sm text-slate-300 line-clamp-2 sm:line-clamp-3 mt-2.5 max-w-xl leading-relaxed">
            {active.overview}
          </p>

          <div className="flex flex-wrap items-center gap-2.5 mt-5">
            <a
              href={active.type === 'movie' ? `/watch/${active.slug}` : `/watch/${active.slug}/episode-1`}
              onClick={e => {
                e.preventDefault();
                trackPlatformEvent({
                  type: 'poster_click',
                  dramaSlug: active.slug,
                  dramaTitle: active.title,
                });
                onWatchEpisode(active.slug, 1);
              }}
              className="px-5 py-2.5 rounded-lg bg-[#00c896] hover:bg-[#00b084] text-slate-950 text-xs sm:text-sm font-bold inline-flex items-center gap-2 transition-colors whitespace-nowrap shrink-0 shadow-lg shadow-emerald-500/25"
            >
              <Play className="w-4 h-4 fill-current" />
              <span>Watch Now</span>
            </a>

            <a
              href={active.type === 'movie' ? `/movie/${active.slug}` : `/drama/${active.slug}`}
              onClick={e => {
                e.preventDefault();
                trackPlatformEvent({
                  type: 'poster_click',
                  dramaSlug: active.slug,
                  dramaTitle: active.title,
                });
                onOpenDrama(active.slug);
              }}
              className="px-4 py-2.5 rounded-lg bg-[#111622]/90 hover:bg-[#1a2234] text-slate-100 text-xs sm:text-sm font-semibold inline-flex items-center gap-2 border border-[#1e2638] transition-colors whitespace-nowrap shrink-0"
            >
              <Info className="w-4 h-4" />
              <span>More Info</span>
            </a>

            <button
              type="button"
              onClick={handleToggleWatchlist}
              className={`px-4 py-2.5 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 border transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                inWatchlist
                  ? 'bg-[#00c896]/15 text-[#00c896] border-[#00c896]/40'
                  : 'bg-[#111622]/85 hover:bg-[#1a2234] text-slate-200 border-[#1e2638]'
              }`}
            >
              {inWatchlist ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
              <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
            </button>
          </div>
        </div>

        {/* Minimal Slide Controls */}
        {featured.length > 1 && (
          <div className="absolute bottom-5 right-5 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setActiveIndex(prev => (prev - 1 + featured.length) % featured.length)}
              aria-label="Previous featured title"
              className="w-9 h-9 rounded-lg bg-[#0a0d14]/80 hover:bg-[#111622] border border-[#1e2638] text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="text-xs font-mono tabular-nums text-slate-300 bg-[#0a0d14]/80 px-2.5 py-1.5 rounded-lg border border-[#1e2638]">
              {(activeIndex % featured.length) + 1}/{featured.length}
            </span>
            <button
              type="button"
              onClick={() => setActiveIndex(prev => (prev + 1) % featured.length)}
              aria-label="Next featured title"
              className="w-9 h-9 rounded-lg bg-[#0a0d14]/80 hover:bg-[#111622] border border-[#1e2638] text-white flex items-center justify-center cursor-pointer transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        )}
      </div>
    </section>
  );
};
