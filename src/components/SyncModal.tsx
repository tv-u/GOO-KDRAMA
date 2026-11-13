import React, { useState } from 'react';
import { Sparkles, Search, RefreshCw, CheckCircle2, AlertCircle, Film, ExternalLink } from 'lucide-react';
import { TMDB_API_KEY, searchTMDB, fetchDramaDetailsFromTMDB, fetchTrendingTMDB } from '../services/tmdb';
import { Drama } from '../types/drama';

interface SyncModalProps {
  isOpen: boolean;
  onClose: () => void;
  onDramaSynced: (drama: Drama) => void;
}

export const SyncModal: React.FC<SyncModalProps> = ({ isOpen, onClose, onDramaSynced }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [syncingId, setSyncingId] = useState<number | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;

    setIsLoading(true);
    setMessage(null);
    try {
      const res = await searchTMDB(searchQuery);
      setResults(res);
      if (res.length === 0) {
        setMessage('No titles found on TMDB for this query.');
      }
    } catch (err) {
      setMessage('Failed to search TMDB.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncTrending = async () => {
    setIsLoading(true);
    setMessage('Fetching trending Asian dramas from TMDB...');
    try {
      const trending = await fetchTrendingTMDB();
      setResults(trending);
      setMessage(`Found ${trending.length} trending dramas from TMDB.`);
    } catch (err) {
      setMessage('Error fetching trending dramas.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSyncItem = async (item: any) => {
    setSyncingId(item.id);
    try {
      const type = item.media_type || (item.title ? 'movie' : 'tv');
      const synced = await fetchDramaDetailsFromTMDB(item.id, type);
      if (synced) {
        onDramaSynced(synced);
        setMessage(`Successfully synced "${synced.title}" to HindiDrama catalog!`);
      } else {
        setMessage('Could not sync this title.');
      }
    } catch (e) {
      setMessage('Sync failed. Please check network.');
    } finally {
      setSyncingId(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-xl w-full p-6 shadow-2xl relative max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-blue-400" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-white">
                TMDB Live Auto-Sync System
              </h3>
              <p className="text-[11px] text-slate-400">
                Connected with TMDB Key: <span className="font-mono text-blue-400">174d021...c967f</span>
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
          >
            ✕
          </button>
        </div>

        {/* Content Body */}
        <div className="py-4 space-y-4 overflow-y-auto flex-1">
          {/* Search Form */}
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search TMDB (e.g. Vincenzo, Hidden Love, Asur)..."
                className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
              />
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5 pointer-events-none" />
            </div>
            <button
              type="submit"
              disabled={isLoading || !searchQuery.trim()}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-lg text-xs sm:text-sm font-semibold transition-colors disabled:opacity-50"
            >
              Search
            </button>
          </form>

          {/* Quick Trending Action */}
          <div className="flex items-center justify-between bg-slate-800/60 p-3 rounded-lg border border-slate-700/60">
            <span className="text-xs text-slate-300">
              Sync newly airing Asian TV series from TMDB API
            </span>
            <button
              onClick={handleSyncTrending}
              disabled={isLoading}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-700 hover:bg-slate-600 text-slate-200 rounded text-xs font-semibold transition-colors disabled:opacity-50"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
              <span>Load Trending</span>
            </button>
          </div>

          {/* Status Message */}
          {message && (
            <div className="p-3 bg-blue-950/60 border border-blue-800/80 rounded-lg text-xs text-blue-200 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-blue-400 shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Search Results List */}
          <div className="space-y-2">
            {results.map((item) => {
              const title = item.name || item.title || 'Untitled';
              const year = item.first_air_date ? item.first_air_date.slice(0, 4) : (item.release_date ? item.release_date.slice(0, 4) : 'N/A');
              const isSyncing = syncingId === item.id;
              const poster = item.poster_path ? `https://image.tmdb.org/t/p/w200${item.poster_path}` : 'https://image.tmdb.org/t/p/w200/jyc9HDQDmJC4PthBUdw95XJJog9.jpg';

              return (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2.5 bg-slate-800/40 hover:bg-slate-800/80 border border-slate-800 rounded-xl transition-colors gap-3"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <img
                      src={poster}
                      alt={title}
                      className="w-10 h-14 object-cover rounded bg-slate-800 shrink-0"
                    />
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-100 truncate">
                        {title}
                      </p>
                      <p className="text-xs text-slate-400">
                        {year} • TMDB ID: {item.id} • Rating: ★ {item.vote_average ? item.vote_average.toFixed(1) : '8.0'}
                      </p>
                    </div>
                  </div>

                  <button
                    onClick={() => handleSyncItem(item)}
                    disabled={isSyncing}
                    className="shrink-0 px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg transition-colors disabled:opacity-50 flex items-center gap-1"
                  >
                    {isSyncing ? (
                      <>
                        <RefreshCw className="w-3 h-3 animate-spin" />
                        <span>Syncing...</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3 h-3" />
                        <span>Sync Now</span>
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="pt-3 border-t border-slate-800 flex justify-end shrink-0">
          <button
            onClick={onClose}
            className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg text-xs font-semibold transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
