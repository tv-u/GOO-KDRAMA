import React, { useState, useEffect, useCallback } from 'react';
import {
  ShieldCheck, Lock, RefreshCw, Plus, Trash2, ArrowLeft, Activity,
  BarChart3, AlertTriangle, Database, Film, LogOut, Power
} from 'lucide-react';
import type { AdminOverviewData } from '../types/drama.ts';

interface AdminDashboardProps {
  onBack: () => void;
  onCatalogUpdated: () => void;
}

const ADMIN_TOKEN_KEY = 'hindidrama_admin_session_token';

type AdminTab = 'overview' | 'health' | 'sources' | 'sync';

export const AdminDashboard: React.FC<AdminDashboardProps> = ({
  onBack,
  onCatalogUpdated,
}) => {
  const [token, setToken] = useState<string>('');
  const [password, setPassword] = useState<string>('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState<boolean>(false);

  const [overview, setOverview] = useState<AdminOverviewData | null>(null);
  const [loading, setLoading] = useState<boolean>(false);
  const [activeTab, setActiveTab] = useState<AdminTab>('overview');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // Sync Controls
  const [syncing, setSyncing] = useState<boolean>(false);
  const [customTmdbId, setCustomTmdbId] = useState<string>('');
  const [customType, setCustomType] = useState<'tv' | 'movie'>('tv');

  // Manual Authorized Source Form
  const [srcSlug, setSrcSlug] = useState<string>('');
  const [srcSeason, setSrcSeason] = useState<string>('1');
  const [srcEpisode, setSrcEpisode] = useState<string>('1');
  const [srcLabel, setSrcLabel] = useState<string>('');
  const [srcUrl, setSrcUrl] = useState<string>('');
  const [srcFormat, setSrcFormat] = useState<'hls' | 'dash' | 'mp4' | 'iframe'>('hls');
  const [addingSource, setAddingSource] = useState<boolean>(false);

  useEffect(() => {
    if (typeof window !== 'undefined' && typeof sessionStorage !== 'undefined') {
      const saved = sessionStorage.getItem(ADMIN_TOKEN_KEY);
      if (saved) setToken(saved);
    }
  }, []);

  const fetchOverview = useCallback(async (authToken: string) => {
    if (!authToken) return;
    setLoading(true);
    try {
      const res = await fetch('/api/admin/overview', {
        headers: { Authorization: `Bearer ${authToken}` },
      });
      if (res.status === 401) {
        if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ADMIN_TOKEN_KEY);
        setToken('');
        setOverview(null);
        setAuthError('Session expired. Please sign in again.');
        return;
      }
      if (res.ok) {
        const json = await res.json();
        if (json?.ok && json.data) {
          setOverview(json.data);
        }
      }
    } catch {
      setStatusMessage('Failed to reach admin analytics API.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (token) fetchOverview(token);
  }, [token, fetchOverview]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    setLoggingIn(true);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data?.token) {
        if (typeof sessionStorage !== 'undefined') {
          sessionStorage.setItem(ADMIN_TOKEN_KEY, data.token);
        }
        setToken(data.token);
        setPassword('');
      } else {
        setAuthError(data?.error || 'Authentication failed');
      }
    } catch {
      setAuthError('Admin login requires running the Node/Express server backend.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (typeof sessionStorage !== 'undefined') sessionStorage.removeItem(ADMIN_TOKEN_KEY);
    setToken('');
    setOverview(null);
  };

  const handleRunSync = async (useCustomId: boolean) => {
    if (!token) return;
    setSyncing(true);
    setStatusMessage(null);
    try {
      const payload =
        useCustomId && customTmdbId.trim()
          ? { tmdbId: parseInt(customTmdbId.trim(), 10), type: customType }
          : {};
      const res = await fetch('/api/admin/sync', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setStatusMessage(
          `TMDB Sync complete: +${json.log.added} added, ${json.log.updated} updated, ${json.log.episodesDiscovered} episodes discovered (Catalog: ${json.totalCatalog}).`
        );
        onCatalogUpdated();
        fetchOverview(token);
      } else {
        setStatusMessage(json?.error || 'TMDB Sync failed');
      }
    } catch {
      setStatusMessage('Network error during TMDB sync');
    } finally {
      setSyncing(false);
    }
  };

  const handleAddSource = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token) return;
    setAddingSource(true);
    setStatusMessage(null);
    try {
      const res = await fetch('/api/admin/sources', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({
          dramaSlug: srcSlug,
          season: Number(srcSeason) || 1,
          episode: Number(srcEpisode) || 1,
          label: srcLabel,
          url: srcUrl,
          format: srcFormat,
        }),
      });
      const json = await res.json();
      if (res.ok && json?.ok) {
        setStatusMessage(`Added authorized source "${json.source.label}" for ${json.source.dramaSlug}.`);
        setSrcSlug('');
        setSrcLabel('');
        setSrcUrl('');
        fetchOverview(token);
      } else {
        setStatusMessage(json?.error || 'Could not add source');
      }
    } catch {
      setStatusMessage('Network error saving source');
    } finally {
      setAddingSource(false);
    }
  };

  const handleToggleSource = async (id: string) => {
    if (!token) return;
    await fetch(`/api/admin/sources/${encodeURIComponent(id)}/toggle`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchOverview(token);
  };

  const handleDeleteSource = async (id: string) => {
    if (!token) return;
    await fetch(`/api/admin/sources/${encodeURIComponent(id)}`, {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${token}` },
    });
    fetchOverview(token);
  };

  if (!token) {
    return (
      <div className="max-w-md mx-auto px-4 py-16">
        <button
          type="button"
          onClick={onBack}
          className="text-xs font-semibold text-blue-400 hover:text-blue-300 inline-flex items-center gap-1 mb-5 cursor-pointer"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          <span>Back to Browse</span>
        </button>

        <div className="bg-slate-900 border border-slate-800 rounded-xl p-6">
          <div className="flex items-center gap-2.5 mb-4">
            <div className="w-9 h-9 rounded-lg bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Administrator Console</h1>
              <p className="text-xs text-slate-400">Server-verified authentication required</p>
            </div>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label htmlFor="admin-password" className="block text-xs font-semibold text-slate-300 mb-1.5">
                Admin Password
              </label>
              <input
                id="admin-password"
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="Enter server ADMIN_PASSWORD"
                required
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-blue-500"
              />
            </div>

            {authError && (
              <div className="p-2.5 rounded-lg bg-rose-950/60 border border-rose-800/70 text-xs text-rose-300">
                {authError}
              </div>
            )}

            <button
              type="submit"
              disabled={loggingIn || !password}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-semibold transition-colors disabled:opacity-50 cursor-pointer"
            >
              {loggingIn ? 'Verifying...' : 'Sign In to Dashboard'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-6">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <div className="flex items-center gap-2 text-xs text-slate-400 mb-1">
            <button
              type="button"
              onClick={onBack}
              className="text-blue-400 hover:underline cursor-pointer"
            >
              Home
            </button>
            <span>/</span>
            <span className="text-slate-200 font-medium">Admin Dashboard</span>
          </div>
          <h1 className="text-2xl font-bold text-white tracking-tight flex items-center gap-2">
            <ShieldCheck className="w-6 h-6 text-emerald-400" />
            <span>Platform Analytics & Automation Console</span>
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={() => fetchOverview(token)}
            disabled={loading}
            className="px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Data</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="px-3.5 py-2 rounded-lg bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-semibold border border-slate-800 inline-flex items-center gap-1.5 cursor-pointer whitespace-nowrap"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Sign Out</span>
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 rounded-lg bg-blue-950/60 border border-blue-800 text-xs text-blue-200">
          {statusMessage}
        </div>
      )}

      {/* Real KPI Grid (Visits & Poster Clicks counted strictly separately) */}
      {overview && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {[
            { label: 'Total Dramas', value: overview.catalog.totalDramas, sub: `${overview.catalog.totalEpisodes} total episodes` },
            { label: 'Total Movies', value: overview.catalog.totalMovies, sub: `${overview.catalog.totalTitles} total catalog` },
            { label: 'Real Page Visits', value: overview.traffic.totalVisits, sub: `${overview.traffic.uniqueVisitors} unique sessions` },
            { label: 'Poster Clicks', value: overview.traffic.totalPosterClicks, sub: 'Tracked separately from visits' },
            { label: 'Episode Plays', value: overview.traffic.totalEpisodePlays, sub: 'Verified playback starts' },
            { label: 'Failed Reports', value: overview.failedReports.length, sub: `${overview.sourceHealth.length} active monitors` },
          ].map(stat => (
            <div
              key={stat.label}
              className="bg-slate-900/70 border border-slate-800 rounded-xl p-4"
            >
              <span className="text-xs font-medium text-slate-400 block">{stat.label}</span>
              <span className="text-2xl font-bold text-white font-mono tabular-nums mt-1 block">
                {stat.value.toLocaleString()}
              </span>
              <span className="text-[11px] text-slate-500 mt-1 block truncate">{stat.sub}</span>
            </div>
          ))}
        </div>
      )}

      {/* Segmented Section Tabs */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
        {[
          { id: 'overview' as AdminTab, label: 'Most Watched & Diagnostics', icon: <BarChart3 className="w-4 h-4" /> },
          { id: 'health' as AdminTab, label: 'Source Health & Errors', icon: <Activity className="w-4 h-4" /> },
          { id: 'sources' as AdminTab, label: 'Manual Sources', icon: <Film className="w-4 h-4" /> },
          { id: 'sync' as AdminTab, label: 'TMDB Auto-Sync', icon: <Database className="w-4 h-4" /> },
        ].map(t => (
          <button
            key={t.id}
            type="button"
            onClick={() => setActiveTab(t.id)}
            className={`px-4 py-2 rounded-lg text-xs font-semibold inline-flex items-center gap-2 whitespace-nowrap shrink-0 cursor-pointer transition-colors ${
              activeTab === t.id
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800 border border-slate-800'
            }`}
          >
            {t.icon}
            <span>{t.label}</span>
          </button>
        ))}
      </div>

      {/* Tab 1: Overview Rankings */}
      {overview && activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Most Watched & Clicked Titles</h2>
              <span className="text-[11px] text-slate-400">Real event counts</span>
            </div>
            {overview.topTitles.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No title interactions recorded yet. Events populate as users browse and play episodes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Title</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Visits</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Poster Clicks</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Plays</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {overview.topTitles.map(row => (
                      <tr key={row.slug} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 text-slate-200 font-medium">{row.title}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">{row.visits}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">{row.posterClicks}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-blue-400 font-semibold">{row.episodePlays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Most Popular Episodes & Catalog Integrity</h2>
              <span className="text-[11px] font-mono tabular-nums text-slate-400">
                Missing meta: {overview.catalog.missingMetadataCount} · Dup TMDB: {overview.catalog.duplicateTmdbCount}
              </span>
            </div>
            {overview.popularEpisodes.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No episode playback counts logged yet.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Drama</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Episode</th>
                      <th className="py-2.5 px-4 text-right font-semibold">Plays</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {overview.popularEpisodes.map(ep => (
                      <tr key={ep.key} className="hover:bg-slate-800/30">
                        <td className="py-2.5 px-4 text-slate-200 font-medium">{ep.dramaTitle}</td>
                        <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">Ep {ep.episode}</td>
                        <td className="py-2.5 px-4 text-right font-mono tabular-nums text-emerald-400 font-semibold">{ep.plays}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 2: Source Health & Failed Playback */}
      {overview && activeTab === 'health' && (
        <div className="space-y-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">Streaming Server Health Telemetry</h2>
            </div>
            {overview.sourceHealth.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No server availability checks recorded yet. Open any Watch page to log real server probes.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-xs text-left">
                  <thead className="bg-slate-950/60 text-slate-400 border-b border-slate-800">
                    <tr>
                      <th className="py-2.5 px-4 font-semibold">Server</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Checks</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Success</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Failures</th>
                      <th className="py-2.5 px-3 text-right font-semibold">Avg Latency</th>
                      <th className="py-2.5 px-4 font-semibold">Health</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-800/70">
                    {overview.sourceHealth.map(srv => {
                      const rate = srv.checks > 0 ? Math.round((srv.successes / srv.checks) * 100) : 100;
                      return (
                        <tr key={`${srv.serverId}-${srv.serverName}`} className="hover:bg-slate-800/30">
                          <td className="py-2.5 px-4 text-slate-100 font-medium">{srv.serverName}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">{srv.checks}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-emerald-400">{srv.successes}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-rose-400">{srv.failures}</td>
                          <td className="py-2.5 px-3 text-right font-mono tabular-nums text-slate-300">{srv.avgLatencyMs}ms</td>
                          <td className="py-2.5 px-4 font-mono tabular-nums">
                            <span className={rate >= 70 ? 'text-emerald-400' : 'text-amber-400'}>
                              {rate}% Healthy
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-amber-400" />
              <h2 className="text-sm font-bold text-white">Failed Playback Reports</h2>
            </div>
            {overview.failedReports.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">Zero playback failure reports logged.</div>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {overview.failedReports.slice(0, 20).map(rep => (
                  <div key={rep.id} className="px-4 py-3 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <span className="font-semibold text-white">{rep.dramaSlug}</span>
                      <span className="text-slate-400"> · Ep {rep.episode} · {rep.serverName}</span>
                      <p className="text-rose-400 mt-0.5">{rep.reason}</p>
                    </div>
                    <span className="text-[11px] font-mono text-slate-500">{rep.timestamp.slice(0, 19).replace('T', ' ')}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Manual Authorized Source Management */}
      {overview && activeTab === 'sources' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <form onSubmit={handleAddSource} className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-3.5">
            <h2 className="text-sm font-bold text-white">Add Authorized Source Override</h2>
            <p className="text-xs text-slate-400">Attach a licensed HLS (.m3u8), MPEG-DASH (.mpd), MP4, or iframe stream URL to any drama/episode.</p>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Drama Slug</label>
              <input
                type="text"
                required
                value={srcSlug}
                onChange={e => setSrcSlug(e.target.value)}
                placeholder="e.g. squid-game"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Season</label>
                <input
                  type="number"
                  min={1}
                  value={srcSeason}
                  onChange={e => setSrcSeason(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Episode (0 = all)</label>
                <input
                  type="number"
                  min={0}
                  value={srcEpisode}
                  onChange={e => setSrcEpisode(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs text-slate-300 mb-1">Source Label</label>
                <input
                  type="text"
                  required
                  value={srcLabel}
                  onChange={e => setSrcLabel(e.target.value)}
                  placeholder="Official CDN Hindi"
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-300 mb-1">Format</label>
                <select
                  value={srcFormat}
                  onChange={e => setSrcFormat(e.target.value as any)}
                  className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
                >
                  <option value="hls">HLS (.m3u8)</option>
                  <option value="mp4">MP4 Direct</option>
                  <option value="dash">MPEG-DASH (.mpd)</option>
                  <option value="iframe">Authorized Iframe</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-xs text-slate-300 mb-1">Authorized Playback URL</label>
              <input
                type="url"
                required
                value={srcUrl}
                onChange={e => setSrcUrl(e.target.value)}
                placeholder="https://cdn.example.com/master.m3u8"
                className="w-full bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white"
              />
            </div>

            <button
              type="submit"
              disabled={addingSource}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>{addingSource ? 'Saving...' : 'Save Authorized Source'}</span>
            </button>
          </form>

          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800 flex items-center justify-between">
              <h2 className="text-sm font-bold text-white">Configured Manual Sources</h2>
              <span className="text-xs text-slate-400 font-mono tabular-nums">{overview.manualSources.length} total</span>
            </div>
            {overview.manualSources.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No manual sources added yet. Default multi-server resolvers remain active automatically.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {overview.manualSources.map(src => (
                  <div key={src.id} className="p-4 flex flex-wrap items-center justify-between gap-3 text-xs">
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-white">
                        {src.label} <span className="text-slate-400 font-normal">· {src.dramaSlug} Ep {src.episode || 'All'} ({src.format.toUpperCase()})</span>
                      </p>
                      <p className="text-slate-400 font-mono truncate mt-0.5">{src.url}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleToggleSource(src.id)}
                        className={`px-2.5 py-1.5 rounded-lg font-semibold inline-flex items-center gap-1 cursor-pointer border ${
                          src.active
                            ? 'bg-emerald-600/20 text-emerald-300 border-emerald-500/30'
                            : 'bg-slate-800 text-slate-400 border-slate-700'
                        }`}
                      >
                        <Power className="w-3 h-3" />
                        <span>{src.active ? 'Active' : 'Disabled'}</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteSource(src.id)}
                        aria-label="Delete source"
                        className="p-1.5 rounded-lg bg-slate-800 hover:bg-rose-600 text-slate-300 hover:text-white cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: TMDB Auto-Sync Controls & Audit Log */}
      {overview && activeTab === 'sync' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 space-y-4">
            <h2 className="text-sm font-bold text-white">TMDB Metadata Sync Controls</h2>
            <p className="text-xs text-slate-400">
              Discovers newly released K-Dramas, Korean Movies, Asian TV shows, and Anime from TMDB without downloading copyrighted video files.
            </p>

            <button
              type="button"
              disabled={syncing}
              onClick={() => handleRunSync(false)}
              className="w-full py-2.5 px-4 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold inline-flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
              <span>{syncing ? 'Syncing Catalog...' : 'Run Full Discover & Episode Sync'}</span>
            </button>

            <div className="pt-4 border-t border-slate-800 space-y-2.5">
              <label className="block text-xs font-semibold text-slate-300">Sync Specific TMDB ID</label>
              <div className="flex gap-2">
                <input
                  type="number"
                  value={customTmdbId}
                  onChange={e => setCustomTmdbId(e.target.value)}
                  placeholder="TMDB ID (e.g. 93405)"
                  className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white font-mono"
                />
                <select
                  value={customType}
                  onChange={e => setCustomType(e.target.value as 'tv' | 'movie')}
                  className="bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-2 text-xs text-white"
                >
                  <option value="tv">TV</option>
                  <option value="movie">Movie</option>
                </select>
              </div>
              <button
                type="button"
                disabled={syncing || !customTmdbId.trim()}
                onClick={() => handleRunSync(true)}
                className="w-full py-2 px-3 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 cursor-pointer disabled:opacity-50"
              >
                Sync Single Title
              </button>
            </div>
          </div>

          <div className="lg:col-span-2 bg-slate-900/60 border border-slate-800 rounded-xl overflow-hidden">
            <div className="px-4 py-3 border-b border-slate-800">
              <h2 className="text-sm font-bold text-white">Synchronization History & Error Audit</h2>
            </div>
            {overview.syncLogs.length === 0 ? (
              <div className="p-8 text-center text-xs text-slate-400">
                No manual dashboard syncs recorded in this session yet. Daily GitHub Actions cron also runs automatically.
              </div>
            ) : (
              <div className="divide-y divide-slate-800/70">
                {overview.syncLogs.map(log => (
                  <div key={log.id} className="p-4 text-xs flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <p className="font-semibold text-white font-mono tabular-nums">
                        +{log.added} Added · {log.updated} Updated · {log.episodesDiscovered} Episodes · {log.duplicatesSkipped} Duplicates Skipped
                      </p>
                      {log.errors.length > 0 && (
                        <p className="text-amber-400 mt-1">{log.errors[0]}</p>
                      )}
                    </div>
                    <span className="text-[11px] font-mono text-slate-400">
                      {log.timestamp.slice(0, 19).replace('T', ' ')}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
