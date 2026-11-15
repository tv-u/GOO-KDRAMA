import React, { useState, useEffect } from 'react';
import { Bookmark, Heart, Clock, Play, Trash2, ArrowLeft, Film, Sparkles } from 'lucide-react';
import type { Drama } from '../types/drama.ts';
import type { LibraryDramaRef, WatchHistoryItem } from '../services/storage.ts';
import {
  getWatchHistory,
  getWatchlist,
  getFavorites,
  getRecentlyViewed,
  removeWatchHistoryItem,
  toggleWatchlist,
  toggleFavorite,
  getWatchedEpisodesForDrama,
} from '../services/storage.ts';
import { OptimizedImage } from './OptimizedImage.tsx';
import { AdsterraBanner } from './AdsterraBanner.tsx';

interface LibraryPageProps {
  dramas: Drama[];
  onOpenDrama: (slug: string) => void;
  onWatchEpisode: (slug: string, ep: number) => void;
  onBack: () => void;
}

type LibraryTab = 'continue' | 'watchlist' | 'favorites' | 'recent';

export const LibraryPage: React.FC<LibraryPageProps> = ({
  dramas,
  onOpenDrama,
  onWatchEpisode,
  onBack,
}) => {
  const [activeTab, setActiveTab] = useState<LibraryTab>('continue');
  const [history, setHistory] = useState<WatchHistoryItem[]>([]);
  const [watchlist, setWatchlist] = useState<LibraryDramaRef[]>([]);
  const [favorites, setFavorites] = useState<LibraryDramaRef[]>([]);
  const [recentlyViewed, setRecentlyViewed] = useState<LibraryDramaRef[]>([]);

  const reloadAll = () => {
    setHistory(getWatchHistory());
    setWatchlist(getWatchlist());
    setFavorites(getFavorites());
    setRecentlyViewed(getRecentlyViewed());
  };

  useEffect(() => {
    reloadAll();
  }, []);

  const formatTime = (sec?: number) => {
    if (!sec || sec <= 0) return null;
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${String(s).padStart(2, '0')}`;
  };

  const tabs: { id: LibraryTab; label: string; count: number; icon: React.ReactNode }[] = [
    { id: 'continue', label: 'Continue Watching & History', count: history.length, icon: <Play className="w-4 h-4" /> },
    { id: 'watchlist', label: 'Watchlist', count: watchlist.length, icon: <Bookmark className="w-4 h-4" /> },
    { id: 'favorites', label: 'Favorites', count: favorites.length, icon: <Heart className="w-4 h-4" /> },
    { id: 'recent', label: 'Recently Viewed', count: recentlyViewed.length, icon: <Clock className="w-4 h-4" /> },
  ];

  const renderRefGrid = (items: LibraryDramaRef[], emptyMsg: string, kind: 'watchlist' | 'favorites' | 'recent') => {
    if (items.length === 0) {
      return (
        <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
          <Film className="w-8 h-8 text-slate-600 mx-auto mb-2" />
          <p className="text-sm font-semibold text-slate-300">{emptyMsg}</p>
          <button
            type="button"
            onClick={onBack}
            className="mt-4 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold cursor-pointer"
          >
            Browse Dramas & Movies
          </button>
        </div>
      );
    }

    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-4">
        {items.map(item => {
          const watchedEps = getWatchedEpisodesForDrama(item.slug);
          return (
            <div key={item.slug} className="group relative bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
              {(kind === 'watchlist' || kind === 'favorites') && (
                <button
                  type="button"
                  onClick={() => {
                    if (kind === 'watchlist') toggleWatchlist(item);
                    else toggleFavorite(item);
                    reloadAll();
                  }}
                  title="Remove"
                  className="absolute top-2 right-2 z-10 w-7 h-7 rounded-lg bg-black/75 hover:bg-rose-600 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
              <a
                href={`/${item.type === 'movie' ? 'movie' : 'drama'}/${item.slug}`}
                onClick={e => {
                  e.preventDefault();
                  onOpenDrama(item.slug);
                }}
                className="block"
              >
                <div className="aspect-[2/3] bg-slate-800 overflow-hidden">
                  <OptimizedImage
                    src={item.poster}
                    alt={`${item.title} Poster`}
                    width={342}
                    height={513}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                  />
                </div>
                <div className="p-2.5">
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-100 line-clamp-1 group-hover:text-blue-400">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 mt-0.5 tabular-nums">
                    {item.country} · {item.year}
                    {watchedEps.length > 0 ? ` · ${watchedEps.length}/${item.totalEpisodes} watched` : ''}
                  </p>
                </div>
              </a>
            </div>
          );
        })}
      </div>
    );
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 mb-6 border-b border-slate-800">
        <div>
          <button
            type="button"
            onClick={onBack}
            className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mb-2 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Home</span>
          </button>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            My Streaming Library
          </h1>
          <p className="text-xs sm:text-sm text-slate-400 mt-1">
            Resume playback where you left off, track watched episodes, and manage your saved titles.
          </p>
        </div>
      </div>

      {/* Segmented Navigation Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-2 mb-6">
        {tabs.map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-3.5 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
            <span className="font-mono text-[11px] tabular-nums opacity-80">({t.count})</span>
          </button>
        ))}
      </div>

      {activeTab === 'continue' && (
        history.length === 0 ? (
          <div className="text-center py-16 bg-slate-900/40 rounded-xl border border-dashed border-slate-800">
            <Sparkles className="w-8 h-8 text-slate-600 mx-auto mb-2" />
            <p className="text-sm font-semibold text-slate-300">No watch history yet.</p>
            <p className="text-xs text-slate-500 mt-1">Start watching any K-Drama or Movie to save your resume position automatically.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {history.map(item => {
              const matched = dramas.find(d => d.slug === item.dramaSlug);
              const watchedCount = getWatchedEpisodesForDrama(item.dramaSlug).length;
              const totalEps = item.totalEpisodes || matched?.totalEpisodes || 1;
              const nextEp = Math.min(totalEps, item.episode + 1);
              const pct =
                item.durationSeconds && item.durationSeconds > 0 && item.progressSeconds
                  ? Math.min(100, Math.round((item.progressSeconds / item.durationSeconds) * 100))
                  : 0;
              const resumedStr = formatTime(item.progressSeconds);

              return (
                <div
                  key={`${item.dramaSlug}-${item.episode}`}
                  className="bg-slate-900/60 border border-slate-800 rounded-xl p-3.5 flex gap-3.5 items-start"
                >
                  <a
                    href={matched?.type === 'movie' || item.type === 'movie' ? `/watch/${item.dramaSlug}` : `/watch/${item.dramaSlug}/episode-${item.episode}`}
                    onClick={e => {
                      e.preventDefault();
                      onWatchEpisode(item.dramaSlug, item.episode);
                    }}
                    className="w-20 aspect-[2/3] rounded-lg overflow-hidden bg-slate-800 shrink-0 block"
                  >
                    <OptimizedImage
                      src={item.poster}
                      alt={item.dramaTitle}
                      width={160}
                      height={240}
                      className="w-full h-full object-cover"
                    />
                  </a>

                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <a
                        href={`/${matched?.type === 'movie' || item.type === 'movie' ? 'movie' : 'drama'}/${item.dramaSlug}`}
                        onClick={e => {
                          e.preventDefault();
                          onOpenDrama(item.dramaSlug);
                        }}
                        className="text-sm font-bold text-white hover:text-blue-400 truncate block"
                      >
                        {item.dramaTitle}
                      </a>
                      <button
                        type="button"
                        onClick={() => setHistory(removeWatchHistoryItem(item.dramaSlug))}
                        aria-label={`Remove ${item.dramaTitle} from history`}
                        className="text-slate-500 hover:text-rose-400 p-1 cursor-pointer shrink-0"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>

                    <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                      Episode {item.episode} of {totalEps}
                      {resumedStr ? ` · Resumes at ${resumedStr}` : ''}
                    </p>
                    <p className="text-[11px] text-slate-500 mt-0.5 tabular-nums">
                      {watchedCount} watched
                    </p>

                    {pct > 0 && (
                      <div className="w-full h-1.5 bg-slate-800 rounded-full overflow-hidden mt-2">
                        <div className="h-full bg-blue-500" style={{ width: `${pct}%` }} />
                      </div>
                    )}

                    <div className="flex flex-wrap items-center gap-2 mt-3">
                      <button
                        type="button"
                        onClick={() => onWatchEpisode(item.dramaSlug, item.episode)}
                        className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center gap-1 cursor-pointer"
                      >
                        <Play className="w-3 h-3 fill-current" />
                        <span>Resume Ep {item.episode}</span>
                      </button>
                      {item.episode < totalEps && (
                        <button
                          type="button"
                          onClick={() => onWatchEpisode(item.dramaSlug, nextEp)}
                          className="px-2.5 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-medium border border-slate-700 cursor-pointer"
                        >
                          Next: Ep {nextEp}
                        </button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )
      )}

      {activeTab === 'watchlist' &&
        renderRefGrid(watchlist, 'Your Watchlist is empty. Bookmark titles from any page.', 'watchlist')}
      {activeTab === 'favorites' &&
        renderRefGrid(favorites, 'No Favorites saved yet.', 'favorites')}
      {activeTab === 'recent' &&
        renderRefGrid(recentlyViewed, 'You have not viewed any drama details yet.', 'recent')}

      <AdsterraBanner type="native" className="mt-8" />
    </div>
  );
};
