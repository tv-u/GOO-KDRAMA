import React from 'react';
import { Play, Clock } from 'lucide-react';
import type { Drama } from '../types/drama.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

interface LatestEpisodesProps {
  dramas: Drama[];
  onWatchEpisode: (slug: string, ep: number) => void;
  onOpenDrama: (slug: string) => void;
}

export const LatestEpisodes: React.FC<LatestEpisodesProps> = ({
  dramas,
  onWatchEpisode,
}) => {
  if (!dramas || dramas.length === 0) {
    return null;
  }

  const latestEpisodesData = [
    { slug: 'the-remarried-empress', ep: 6, time: '2 hours ago' },
    { slug: 'the-devils-plan-3', ep: 5, time: '3 hours ago' },
    { slug: 'one-and-only', ep: 24, time: '5 hours ago' },
    { slug: 'study-group', ep: 10, time: '6 hours ago' },
    { slug: 'love-in-disguise', ep: 8, time: '8 hours ago' },
    { slug: 'doctor-x-mafia-in-white', ep: 10, time: '10 hours ago' },
    { slug: 'final-table', ep: 6, time: '12 hours ago' },
    { slug: 'love-between-lines', ep: 44, time: '14 hours ago' },
    { slug: 'the-brightest-star-in-the-sky', ep: 28, time: '16 hours ago' },
    { slug: 'make-me-tingle', ep: 10, time: '18 hours ago' },
    { slug: 'a-love-other-than-yours', ep: 14, time: '1 day ago' },
    { slug: 'wedding-impossible', ep: 12, time: '1 day ago' },
    { slug: 'sweet-teeth', ep: 22, time: '1 day ago' },
    { slug: '100-days-my-prince', ep: 16, time: '2 days ago' },
    { slug: 'take-charge-of-my-heart', ep: 10, time: '2 days ago' },
    { slug: 'a-korean-odyssey', ep: 20, time: '2 days ago' },
    { slug: 'angel-eyes', ep: 20, time: '3 days ago' },
    { slug: 'chip-in', ep: 16, time: '3 days ago' },
  ];

  return (
    <section className="mb-12">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-baseline gap-2">
          <h2 className="text-xl sm:text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <span>Latest Episodes</span>
            <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
          </h2>
          <span className="text-xs text-slate-400 hidden sm:inline">Fresh Hindi dubbed episodes released today</span>
        </div>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
        {latestEpisodesData.map(item => {
          const drama = dramas.find(d => d.slug === item.slug) || dramas[0];
          return (
            <a
              key={`${item.slug}-${item.ep}`}
              href={`/watch/${drama.slug}/episode-${item.ep}`}
              onClick={e => {
                e.preventDefault();
                onWatchEpisode(drama.slug, item.ep);
              }}
              className="group bg-slate-900/70 border border-slate-800/80 hover:border-blue-500/60 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 hover:shadow-lg hover:shadow-blue-900/10 block"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-slate-800">
                <OptimizedImage
                  src={drama.backdrop || drama.poster}
                  alt={`${drama.title} Episode ${item.ep} Hindi Dubbed Thumbnail`}
                  width={500}
                  height={312}
                  sizes="(max-width: 640px) 50vw, 18vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/20 to-transparent" />

                <div className="absolute bottom-2 left-2 bg-blue-600 text-white text-[11px] font-bold px-2 py-0.5 rounded shadow">
                  Episode {item.ep}
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                <div className="absolute top-2 right-2 flex items-center gap-1 bg-black/60 backdrop-blur-sm text-[10px] text-slate-300 px-1.5 py-0.5 rounded">
                  <Clock className="w-2.5 h-2.5" />
                  <span>{item.time}</span>
                </div>
              </div>

              <div className="p-2.5">
                <h3 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1">
                  {drama.title}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1">
                  <span className="text-slate-400">{drama.country}</span>
                  <span className="text-blue-400 font-medium">Hindi Dub</span>
                </div>
              </div>
            </a>
          );
        })}
      </div>
    </section>
  );
};
