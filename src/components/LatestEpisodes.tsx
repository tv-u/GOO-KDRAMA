import React, { useMemo, useState } from 'react';
import { Play, Calendar } from 'lucide-react';
import type { Drama } from '../types/drama.ts';
import type { LatestAiringEpisodeItem } from '../services/tmdb.ts';
import { OptimizedImage } from './OptimizedImage.tsx';

interface LatestEpisodesProps {
  dramas: Drama[];
  liveEpisodes?: LatestAiringEpisodeItem[];
  loading?: boolean;
  onWatchEpisode: (slug: string, ep: number) => void;
  onOpenDrama: (slug: string) => void;
}

type EpisodeFilterTab = 'all' | 'ongoing' | 'completed';

function formatAirDateLabel(airDate?: string): string {
  if (!airDate) return 'Recent';
  const parsed = Date.parse(airDate);
  if (Number.isNaN(parsed)) return airDate;
  return new Date(parsed).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
  });
}

export const LatestEpisodes: React.FC<LatestEpisodesProps> = ({
  dramas,
  liveEpisodes = [],
  loading = false,
  onWatchEpisode,
  onOpenDrama,
}) => {
  const [filterTab, setFilterTab] = useState<EpisodeFilterTab>('all');

  const resolvedEpisodes: LatestAiringEpisodeItem[] = useMemo(() => {
    if (liveEpisodes.length > 0) return liveEpisodes;
    return dramas
      .filter(d => d.type !== 'movie')
      .slice(0, 18)
      .map(d => ({
        drama: d,
        season: d.season || 1,
        episode: d.latestEpisode || d.totalEpisodes || 1,
        episodeName: `Episode ${d.latestEpisode || d.totalEpisodes || 1}`,
        airDate: d.updatedAt ? d.updatedAt.slice(0, 10) : undefined,
        stillUrl: d.backdrop || d.poster,
        isOngoing: d.status === 'Ongoing',
      }));
  }, [liveEpisodes, dramas]);

  const visibleItems = useMemo(() => {
    if (filterTab === 'ongoing') return resolvedEpisodes.filter(e => e.isOngoing).slice(0, 16);
    if (filterTab === 'completed') return resolvedEpisodes.filter(e => !e.isOngoing).slice(0, 16);
    return resolvedEpisodes.slice(0, 16);
  }, [resolvedEpisodes, filterTab]);

  if (!loading && visibleItems.length === 0) {
    return null;
  }

  return (
    <section className="mb-10">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 mb-4 border-b border-[#1e2638]">
        <div>
          <h2 className="text-lg sm:text-xl font-bold text-white tracking-tight">
            Latest Episode Updates
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Auto-synced recent Korean &amp; Asian drama releases from TMDB
          </p>
        </div>

        <div className="flex items-center gap-1.5 bg-[#111622] p-1 rounded-lg border border-[#1e2638] self-start sm:self-auto">
          {(
            [
              { id: 'all', label: 'All Updates' },
              { id: 'ongoing', label: 'Ongoing' },
              { id: 'completed', label: 'Completed' },
            ] as const
          ).map(tab => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setFilterTab(tab.id)}
              className={`px-3 py-1 rounded-md text-xs font-semibold transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                filterTab === tab.id
                  ? 'bg-[#00c896] text-slate-950'
                  : 'text-slate-300 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading && visibleItems.length === 0 ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {Array.from({ length: 12 }).map((_, idx) => (
            <div key={idx} className="bg-[#111622] border border-[#1e2638] rounded-xl overflow-hidden">
              <div className="aspect-[16/10] bg-[#1a2234] animate-pulse" />
              <div className="p-2.5 space-y-2">
                <div className="h-3.5 bg-[#1a2234] rounded w-3/4 animate-pulse" />
                <div className="h-3 bg-[#1a2234] rounded w-1/2 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
          {visibleItems.map(item => (
            <a
              key={`${item.drama.slug}-s${item.season}-e${item.episode}`}
              href={`/watch/${item.drama.slug}/episode-${item.episode}`}
              onClick={e => {
                e.preventDefault();
                onWatchEpisode(item.drama.slug, item.episode);
              }}
              className="group bg-[#111622] border border-[#1e2638] hover:border-[#00c896]/70 rounded-xl overflow-hidden cursor-pointer transition-all duration-300 hover:-translate-y-1 block"
            >
              <div className="relative aspect-[16/10] overflow-hidden bg-[#1a2234]">
                <OptimizedImage
                  src={item.stillUrl || item.drama.backdrop || item.drama.poster}
                  alt={`${item.drama.title} Episode ${item.episode}`}
                  width={500}
                  height={312}
                  sizes="(max-width: 640px) 50vw, 18vw"
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/25 to-transparent" />

                <div className="absolute bottom-2 left-2 bg-[#00c896] text-slate-950 text-[11px] font-extrabold px-2 py-0.5 rounded shadow tabular-nums">
                  EP {item.episode}
                </div>

                <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <div className="w-9 h-9 rounded-full bg-[#00c896] text-slate-950 flex items-center justify-center shadow-lg transform scale-90 group-hover:scale-100 transition-transform">
                    <Play className="w-4 h-4 fill-current ml-0.5" />
                  </div>
                </div>

                <div className="absolute top-2 right-2 flex items-center gap-1 bg-[#0a0d14]/80 text-[10px] text-slate-200 px-1.5 py-0.5 rounded tabular-nums">
                  <Calendar className="w-2.5 h-2.5 text-[#00c896]" />
                  <span>{formatAirDateLabel(item.airDate)}</span>
                </div>
              </div>

              <div className="p-2.5">
                <h3
                  onClick={e => {
                    if (e.metaKey || e.ctrlKey) return;
                    e.preventDefault();
                    e.stopPropagation();
                    onOpenDrama(item.drama.slug);
                  }}
                  className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-[#00c896] transition-colors line-clamp-1"
                >
                  {item.drama.title}
                </h3>
                <div className="flex items-center justify-between text-[11px] text-slate-400 mt-1 tabular-nums">
                  <span>Episode {item.episode} · {item.drama.country}</span>
                  <span className="text-[#00c896] font-semibold">SUB / DUB</span>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </section>
  );
};
