import React, { useState, useEffect, useRef, useCallback } from 'react';
import type Hls from 'hls.js';
import {
  Play, Download, Star, Eye, Clock, ChevronLeft, ChevronRight,
  MessageSquare, ThumbsUp, Send, Share2, Moon, Sun,
  RefreshCw, Tv, Shield, ExternalLink, Sparkles, HelpCircle, Activity, Volume2, Radio
} from 'lucide-react';
import type { AudioLanguageCode, Drama, DramaComment, TmdbEpisodeMeta } from '../types/drama.ts';
import {
  getCommentsForDrama,
  addComment,
  likeComment,
  saveWatchHistory,
  getPreferredAudioLang,
  savePreferredAudioLang,
} from '../services/storage.ts';
import { fetchTmdbEpisodeSync } from '../services/tmdb.ts';
import { triggerSmartlink, getNextAdsterraLink } from '../services/adsterra.ts';
import { getDramaFaqs, slugifyText } from '../services/seo.ts';
import { AdsterraBanner } from './AdsterraBanner.tsx';
import { OptimizedImage } from './OptimizedImage.tsx';

interface WatchPlayerProps {
  drama: Drama;
  currentEpisode: number;
  masterHlsUrl?: string;
  onSelectEpisode: (ep: number) => void;
  onNavigateHome: () => void;
  onSelectCategory: (country: string) => void;
  onOpenDramaDetail: (slug: string) => void;
  onOpenGenre: (genreSlug: string) => void;
}

interface ServerTemplate {
  id: number;
  name: string;
  tier: 'Primary' | 'Backup';
  template: string;
}

const AUDIO_LANGUAGES: { code: AudioLanguageCode; label: string; flag: string; aliases: string[] }[] = [
  { code: 'hi', label: 'Hindi', flag: '🇮🇳', aliases: ['hi', 'hin', 'hindi'] },
  { code: 'ko', label: 'Korean', flag: '🇰🇷', aliases: ['ko', 'kor', 'korean'] },
  { code: 'ta', label: 'Tamil', flag: '🇮🇳', aliases: ['ta', 'tam', 'tamil'] },
  { code: 'te', label: 'Telugu', flag: '🇮🇳', aliases: ['te', 'tel', 'telugu'] },
  { code: 'en', label: 'English', flag: '🇬🇧', aliases: ['en', 'eng', 'english'] },
];

const SERVER_TEMPLATES: ServerTemplate[] = [
  { id: 1, name: 'Abyss', tier: 'Primary', template: 'https://abyss.to/embed/{tmdbId}/{season}/{episode}?lang={lang}' },
  { id: 2, name: 'Filemoon', tier: 'Primary', template: 'https://filemoon.sx/e/{tmdbId}_s{season}e{episode}?lang={lang}' },
  { id: 3, name: 'StreamWish', tier: 'Primary', template: 'https://streamwish.to/embed/{tmdbId}_s{season}e{episode}?lang={lang}' },
  { id: 4, name: 'Byse', tier: 'Primary', template: 'https://byse.su/embed/{tmdbId}/{season}/{episode}?lang={lang}' },
  { id: 5, name: 'EarnVids', tier: 'Primary', template: 'https://earnvids.net/embed/{tmdbId}_{season}_{episode}?lang={lang}' },
  { id: 6, name: 'Streamtape', tier: 'Primary', template: 'https://streamtape.com/e/{tmdbId}/{season}/{episode}?lang={lang}' },
  { id: 7, name: 'Lulu', tier: 'Primary', template: 'https://lulustream.com/e/{tmdbId}/{season}/{episode}' },
  { id: 8, name: 'Bolt', tier: 'Primary', template: 'https://boltcnd.com/embed/{tmdbId}/{season}/{episode}?lang={lang}' },
  { id: 9, name: 'VidCloud', tier: 'Backup', template: 'https://vidsrc.cc/v2/embed/tv/{tmdbId}/{season}/{episode}?lang={lang}' },
  { id: 10, name: 'SuperEmbed', tier: 'Backup', template: 'https://multiembed.mov/?video_id={tmdbId}&tmdb=1&s={season}&e={episode}&lang={lang}' },
  { id: 11, name: 'AutoEmbed', tier: 'Backup', template: 'https://player.autoembed.cc/embed/tv/{tmdbId}/{season}/{episode}?lang={lang}' },
  { id: 12, name: 'Embed.su', tier: 'Backup', template: 'https://embed.su/embed/tv/{tmdbId}/{season}/{episode}' },
  { id: 13, name: '2Embed', tier: 'Backup', template: 'https://www.2embed.cc/embedtv/{tmdbId}&s={season}&e={episode}' },
  { id: 14, name: 'MovieApi', tier: 'Backup', template: 'https://movieapi.club/embed/tv/{tmdbId}/{season}/{episode}' },
  { id: 15, name: 'SmashyStream', tier: 'Backup', template: 'https://embed.smashystream.com/playere.php?tmdb={tmdbId}&season={season}&episode={episode}' },
  { id: 16, name: 'Vidsrc.me', tier: 'Backup', template: 'https://vidsrc.me/embed/tv?tmdb={tmdbId}&season={season}&episode={episode}' },
  { id: 17, name: 'Vidsrc.net', tier: 'Backup', template: 'https://vidsrc.net/embed/tv/{tmdbId}/{season}/{episode}' },
  { id: 18, name: 'Moviesapi', tier: 'Backup', template: 'https://moviesapi.club/tv/{tmdbId}-{season}-{episode}' },
  { id: 19, name: 'VidBinge', tier: 'Backup', template: 'https://vidbinge.dev/embed/tv/{tmdbId}/{season}/{episode}' },
  { id: 20, name: 'Vidsrc.pm', tier: 'Backup', template: 'https://vidsrc.pm/embed/tv/{tmdbId}/{season}/{episode}' },
];

function buildServerUrl(template: string, tmdbId: number, season: number, episode: number, lang: AudioLanguageCode): string {
  return template
    .replace('{tmdbId}', String(tmdbId))
    .replace('{season}', String(season))
    .replace('{episode}', String(episode))
    .replace('{lang}', lang);
}

export const WatchPlayer: React.FC<WatchPlayerProps> = ({
  drama,
  currentEpisode,
  masterHlsUrl,
  onSelectEpisode,
  onNavigateHome,
  onSelectCategory,
  onOpenDramaDetail,
  onOpenGenre,
}) => {
  const season = drama.season || 1;
  const tmdbId = drama.tmdbId || 129117;
  const activeHlsSource = masterHlsUrl || drama.masterHlsUrl || '';

  // Audio track state (persisted in localStorage, defaulting to Hindi 'hi')
  const [selectedLang, setSelectedLang] = useState<AudioLanguageCode>(() => getPreferredAudioLang());
  const [hlsAudioTracks, setHlsAudioTracks] = useState<{ id: number; name: string; lang?: string }[]>([]);
  const [hlsFailed, setHlsFailed] = useState<boolean>(false);

  // Playback mode: Mode A (HLS) when masterHlsUrl provided & not failed; otherwise Mode B (Multi-Server Embed)
  const useHlsMode = Boolean(activeHlsSource && !hlsFailed);

  // Server & Player UI State
  const [selectedServer, setSelectedServer] = useState<number>(9); // VidCloud default reliable server
  const [cinemaMode, setCinemaMode] = useState<boolean>(false);
  const [comments, setComments] = useState<DramaComment[]>([]);
  const [commentName, setCommentName] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [commentSubmitting, setCommentSubmitting] = useState<boolean>(false);
  const [showDownloadModal, setShowDownloadModal] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [serverReloadKey, setServerReloadKey] = useState<number>(0);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'switched'>('online');
  const [serverLatency, setServerLatency] = useState<number | null>(null);

  // TMDB Live Episode Metadata Sync
  const [tmdbMeta, setTmdbMeta] = useState<TmdbEpisodeMeta | null>(null);
  const [syncingMeta, setSyncingMeta] = useState<boolean>(false);

  const videoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const triedServersRef = useRef<Set<number>>(new Set());

  const currentProvider = SERVER_TEMPLATES.find(s => s.id === selectedServer) || SERVER_TEMPLATES[0];
  const embedUrl = buildServerUrl(currentProvider.template, tmdbId, season, currentEpisode, selectedLang);
  const activeLangMeta = AUDIO_LANGUAGES.find(l => l.code === selectedLang) || AUDIO_LANGUAGES[0];

  // 1. Live TMDB Metadata Auto-Sync per Drama / Season / Episode
  useEffect(() => {
    let active = true;
    setSyncingMeta(true);
    fetchTmdbEpisodeSync(tmdbId, season, currentEpisode, drama.type || 'tv')
      .then(meta => {
        if (active) {
          setTmdbMeta(meta);
          setSyncingMeta(false);
        }
      })
      .catch(() => {
        if (active) setSyncingMeta(false);
      });
    return () => {
      active = false;
    };
  }, [tmdbId, season, currentEpisode, drama.type]);

  // 2. Mode A: Hotstar-Style Single-Video Multi-Audio HLS Engine (`hls.js`)
  useEffect(() => {
    setHlsFailed(false);
  }, [activeHlsSource, currentEpisode, drama.slug]);

  useEffect(() => {
    if (!useHlsMode || !activeHlsSource) return;
    const video = videoRef.current;
    if (!video) return;

    let cancelled = false;

    if (hlsRef.current) {
      hlsRef.current.destroy();
      hlsRef.current = null;
    }

    const selectTrackByLang = (hlsInstance: Hls, langCode: AudioLanguageCode) => {
      const tracks = hlsInstance.audioTracks || [];
      const targetMeta = AUDIO_LANGUAGES.find(l => l.code === langCode);
      const aliases = targetMeta?.aliases || [langCode];
      const idx = tracks.findIndex(t => {
        const trackLang = (t.lang || '').toLowerCase();
        const trackName = (t.name || '').toLowerCase();
        return aliases.some(a => trackLang.includes(a) || trackName.includes(a));
      });
      if (idx !== -1) {
        hlsInstance.audioTrack = idx;
      } else {
        const hindiIdx = tracks.findIndex(t => (t.lang || '').toLowerCase().includes('hi'));
        if (hindiIdx !== -1) hlsInstance.audioTrack = hindiIdx;
      }
    };

    import('hls.js')
      .then(({ default: HlsEngine }) => {
        if (cancelled) return;
        if (HlsEngine.isSupported()) {
          const hls = new HlsEngine({
            enableWorker: true,
            lowLatencyMode: true,
            backBufferLength: 60,
          });
          hlsRef.current = hls;
          hls.loadSource(activeHlsSource);
          hls.attachMedia(video);

          hls.on(HlsEngine.Events.MANIFEST_PARSED, () => {
            const mapped = (hls.audioTracks || []).map((t, i) => ({
              id: i,
              name: t.name || t.lang || `Audio ${i + 1}`,
              lang: t.lang,
            }));
            setHlsAudioTracks(mapped);
            selectTrackByLang(hls, selectedLang);
            video.play().catch(() => {});
          });

          hls.on(HlsEngine.Events.AUDIO_TRACKS_UPDATED, (_evt, data) => {
            const mapped = (data.audioTracks || []).map((t, i) => ({
              id: i,
              name: t.name || t.lang || `Audio ${i + 1}`,
              lang: t.lang,
            }));
            setHlsAudioTracks(mapped);
            selectTrackByLang(hls, selectedLang);
          });

          hls.on(HlsEngine.Events.ERROR, (_evt, data) => {
            if (data.fatal) {
              if (data.type === HlsEngine.ErrorTypes.NETWORK_ERROR) {
                hls.startLoad();
              } else if (data.type === HlsEngine.ErrorTypes.MEDIA_ERROR) {
                hls.recoverMediaError();
              } else {
                hls.destroy();
                setHlsFailed(true);
                setFallbackMessage('HLS stream unavailable • Auto-switched to Multi-Server Embed Fallback');
                setTimeout(() => setFallbackMessage(null), 4000);
              }
            }
          });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
          video.src = activeHlsSource;
          video.play().catch(() => {});
        } else {
          setHlsFailed(true);
        }
      })
      .catch(() => {
        if (!cancelled) setHlsFailed(true);
      });

    return () => {
      cancelled = true;
      if (hlsRef.current) {
        hlsRef.current.destroy();
        hlsRef.current = null;
      }
    };
  }, [useHlsMode, activeHlsSource]);

  // Zero-Reload Mid-Playback Audio Language Switcher + localStorage Persistence
  const handleSelectAudioLanguage = (lang: AudioLanguageCode) => {
    setSelectedLang(lang);
    savePreferredAudioLang(lang);

    if (useHlsMode && hlsRef.current) {
      const tracks = hlsRef.current.audioTracks || [];
      const targetMeta = AUDIO_LANGUAGES.find(l => l.code === lang);
      const aliases = targetMeta?.aliases || [lang];
      const matchIndex = tracks.findIndex(t => {
        const tLang = (t.lang || '').toLowerCase();
        const tName = (t.name || '').toLowerCase();
        return aliases.some(a => tLang.includes(a) || tName.includes(a));
      });
      if (matchIndex !== -1) {
        hlsRef.current.audioTrack = matchIndex;
        setFallbackMessage(`Audio switched mid-playback to ${targetMeta?.label || lang} (Zero Reload)`);
        setTimeout(() => setFallbackMessage(null), 2500);
      }
    } else {
      setServerReloadKey(prev => prev + 1);
      const targetMeta = AUDIO_LANGUAGES.find(l => l.code === lang);
      setFallbackMessage(`Switched Embed Audio Preference to ${targetMeta?.label || lang}`);
      setTimeout(() => setFallbackMessage(null), 2500);
    }
  };

  // 3. Mode B: Server Availability Ping & Automatic Primary/Fallback Failover
  const pingAndSelectServer = useCallback(async (serverId: number, autoFailoverOnFail = true) => {
    const provider = SERVER_TEMPLATES.find(s => s.id === serverId) || SERVER_TEMPLATES[0];
    setSelectedServer(provider.id);
    setServerReloadKey(prev => prev + 1);
    setServerStatus('checking');

    try {
      const targetUrl = buildServerUrl(provider.template, tmdbId, season, currentEpisode, selectedLang);
      const res = await fetch('/api/server-ping', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: targetUrl }),
      });

      if (res.ok) {
        const data = await res.json();
        if (data.ok) {
          setServerStatus('online');
          setServerLatency(data.latencyMs || 42);
          return;
        }
      }
    } catch {
      // Fallback gracefully
    }

    if (autoFailoverOnFail && triedServersRef.current.size < 3) {
      triedServersRef.current.add(provider.id);
      const next = SERVER_TEMPLATES.find(s => !triedServersRef.current.has(s.id) && s.id !== provider.id);
      if (next) {
        setSelectedServer(next.id);
        setServerReloadKey(prev => prev + 1);
        setServerStatus('switched');
        setFallbackMessage(`Auto-Failover: ${provider.name} unavailable • Switched to ${next.name}`);
        setTimeout(() => setFallbackMessage(null), 4000);
        return;
      }
    }

    setServerStatus('online');
  }, [tmdbId, season, currentEpisode, selectedLang]);

  const handleAutoFallback = () => {
    const nextServer = (selectedServer % SERVER_TEMPLATES.length) + 1;
    const nextProvider = SERVER_TEMPLATES.find(s => s.id === nextServer) || SERVER_TEMPLATES[0];
    setServerStatus('switched');
    setFallbackMessage(`Auto-switched to Server ${nextProvider.id} (${nextProvider.name})`);
    pingAndSelectServer(nextProvider.id, false);
    setTimeout(() => setFallbackMessage(null), 3500);
  };

  useEffect(() => {
    triedServersRef.current.clear();
  }, [drama.slug, currentEpisode]);

  useEffect(() => {
    setComments(getCommentsForDrama(drama.slug));
  }, [drama.slug]);

  useEffect(() => {
    saveWatchHistory({
      dramaSlug: drama.slug,
      dramaTitle: drama.title,
      episode: currentEpisode,
      poster: drama.poster,
    });
  }, [drama.slug, drama.title, drama.poster, currentEpisode]);

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;

    setCommentSubmitting(true);
    const newComment = addComment({
      dramaSlug: drama.slug,
      episodeNumber: currentEpisode,
      userName: commentName.trim() || 'DramaFan' + Math.floor(100 + Math.random() * 900),
      content: commentText.trim(),
    });

    setComments(prev => [newComment, ...prev]);
    setCommentText('');
    setCommentSubmitting(false);
  };

  const handleLikeComment = (id: string) => {
    const newCount = likeComment(id);
    setComments(prev =>
      prev.map(c => (c.id === id ? { ...c, likes: newCount } : c))
    );
  };

  const handleShare = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2000);
    }
  };

  const faqs = getDramaFaqs(drama, currentEpisode);

  return (
    <div className={`relative transition-colors duration-300 ${cinemaMode ? 'bg-black min-h-screen' : ''}`}>
      {cinemaMode && (
        <div
          onClick={() => setCinemaMode(false)}
          className="fixed inset-0 bg-black/90 z-40 cursor-pointer flex items-start justify-center pt-6"
        >
          <span className="bg-slate-800 text-slate-300 text-xs px-3 py-1 rounded-full border border-slate-700 pointer-events-none">
            Cinema Mode Active • Click anywhere to exit
          </span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        
        {/* Crawlable Breadcrumb Navigation */}
        <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mb-4 overflow-x-auto whitespace-nowrap">
          <a
            href="/"
            onClick={e => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="hover:text-blue-400 text-blue-500 font-medium transition-colors"
          >
            Home
          </a>
          <span>/</span>
          <a
            href={`/category/${drama.country.toLowerCase()}`}
            onClick={e => {
              e.preventDefault();
              onSelectCategory(drama.country.toLowerCase());
            }}
            className="hover:text-blue-400 text-blue-500 font-medium transition-colors"
          >
            {drama.country} Drama
          </a>
          <span>/</span>
          <a
            href={`/drama/${drama.slug}`}
            onClick={e => {
              e.preventDefault();
              onOpenDramaDetail(drama.slug);
            }}
            className="hover:text-blue-400 text-blue-500 font-medium transition-colors"
          >
            {drama.title}
          </a>
          <span>/</span>
          <span className="text-slate-200 font-semibold">
            Episode {currentEpisode}
          </span>
        </nav>

        {/* OTT Video Player Shell (Hotstar / Netflix Style) */}
        <div className={`relative z-40 mb-6 bg-black rounded-2xl overflow-hidden border border-slate-800 shadow-2xl shadow-black/80 ${cinemaMode ? 'ring-2 ring-blue-500 scale-[1.02] transition-transform' : ''}`}>
          
          {/* 1. OTT Header Bar with Live TMDB Sync + Active Audio Language Badge */}
          <div className="bg-gradient-to-r from-slate-950 via-slate-900 to-slate-950 border-b border-slate-800 px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white truncate">
                  {tmdbMeta?.title || drama.title}
                </span>
                <span className="px-2 py-0.5 rounded bg-blue-600/20 text-blue-400 border border-blue-500/30 text-[11px] font-bold">
                  S{season} · E{currentEpisode}
                </span>
                <span className="px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 text-[11px] font-semibold flex items-center gap-1">
                  <Radio className="w-3 h-3 animate-pulse" />
                  <span>{activeLangMeta.flag} Audio: {activeLangMeta.label}</span>
                </span>
                <span className="px-2 py-0.5 rounded bg-slate-800 text-slate-300 text-[10px] font-semibold uppercase tracking-wider">
                  {useHlsMode ? 'HLS Multi-Audio' : `Server: ${currentProvider.name}`}
                </span>
              </div>
              {syncingMeta ? (
                <div className="h-3.5 w-64 bg-slate-800 animate-pulse rounded mt-1.5" />
              ) : (
                <p className="text-xs text-slate-400 truncate mt-1">
                  {tmdbMeta?.episodeName ? `${tmdbMeta.episodeName} — ` : ''}
                  {tmdbMeta?.overview || drama.overview}
                </p>
              )}
            </div>

            {/* Utility Controls */}
            <div className="flex items-center gap-2 shrink-0 text-xs">
              <button
                onClick={() => setCinemaMode(!cinemaMode)}
                className={`p-1.5 rounded text-xs flex items-center gap-1 transition-colors cursor-pointer ${
                  cinemaMode ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white bg-slate-800'
                }`}
                title="Toggle Lights (Cinema Mode)"
              >
                {cinemaMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span className="hidden sm:inline">{cinemaMode ? 'Light On' : 'Light Off'}</span>
              </button>

              <button
                onClick={handleAutoFallback}
                className="px-2.5 py-1.5 rounded text-xs font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white shadow-md flex items-center gap-1 transition-all cursor-pointer"
                title="Automatically switch to next high-speed server if buffering"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-300" />
                <span>Auto-Fallback</span>
              </button>

              <button
                onClick={() => setServerReloadKey(prev => prev + 1)}
                className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800 flex items-center gap-1 cursor-pointer"
                title="Reload Player Stream"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">Reload</span>
              </button>

              <button
                onClick={handleShare}
                className="p-1.5 text-slate-400 hover:text-white rounded bg-slate-800 flex items-center gap-1 cursor-pointer"
                title="Share Episode"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden sm:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>

          {/* Fallback / Audio Switch Notification Banner */}
          {fallbackMessage && (
            <div className="bg-blue-600 text-white text-xs px-4 py-2 font-medium flex items-center justify-between">
              <span>{fallbackMessage}</span>
              <span className="text-[10px] bg-black/30 px-2 py-0.5 rounded">Live OTT Sync</span>
            </div>
          )}

          {/* 2. Hybrid Dual-Mode Viewport (Mode A: HLS.js Video OR Mode B: Responsive Multi-Server Iframe) */}
          <div className="relative aspect-video w-full bg-slate-950 flex items-center justify-center">
            {useHlsMode ? (
              <video
                ref={videoRef}
                controls
                playsInline
                poster={tmdbMeta?.backdrop || drama.backdrop || drama.poster}
                className="w-full h-full bg-black object-contain"
              />
            ) : (
              <iframe
                key={`${selectedServer}-${currentEpisode}-${selectedLang}-${serverReloadKey}`}
                src={embedUrl}
                frameBorder="0"
                allowFullScreen
                allow="autoplay; fullscreen; picture-in-picture"
                referrerPolicy="origin"
                onError={handleAutoFallback}
                title={`Watch ${drama.title} Episode ${currentEpisode} ${activeLangMeta.label}`}
                className="w-full h-full border-0"
              />
            )}

            {serverStatus === 'checking' && !useHlsMode && (
              <div className="absolute inset-0 bg-slate-950/75 backdrop-blur-xs flex flex-col items-center justify-center gap-2 pointer-events-none">
                <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-blue-200">
                  Verifying {currentProvider.name} stream availability...
                </span>
              </div>
            )}
          </div>

          {/* 3. Sleek Dark-Mode Control Bar Below Player: Audio Language Pills & Server Switcher */}
          <div className="bg-slate-900/95 border-t border-slate-800 px-4 py-3 space-y-2.5">
            {/* Audio Language Pills Row */}
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-slate-400 flex items-center gap-1.5 mr-1">
                  <Volume2 className="w-3.5 h-3.5 text-blue-400" />
                  <span>Audio Language:</span>
                </span>
                {AUDIO_LANGUAGES.map(lang => {
                  const isActive = selectedLang === lang.code;
                  return (
                    <button
                      key={lang.code}
                      onClick={() => handleSelectAudioLanguage(lang.code)}
                      className={`px-3 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/40 ring-1 ring-blue-400'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/60'
                      }`}
                    >
                      <span>{lang.flag}</span>
                      <span>{lang.label}</span>
                    </button>
                  );
                })}
                {useHlsMode && hlsAudioTracks.length > 0 && (
                  <span className="text-[11px] text-emerald-400 ml-1">
                    ({hlsAudioTracks.length} HLS tracks detected)
                  </span>
                )}
              </div>

              <span className="flex items-center gap-1.5 text-[11px] text-emerald-400 font-medium">
                <Activity className="w-3.5 h-3.5" />
                <span>
                  {serverStatus === 'checking'
                    ? 'Checking...'
                    : serverLatency
                      ? `Online (${serverLatency}ms)`
                      : 'HD Auto-Sync Ready'}
                </span>
              </span>
            </div>

            {/* Server Switcher Row */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-2 border-t border-slate-800/80 text-xs">
              <span className="text-slate-400 font-medium mr-1 flex items-center gap-1 shrink-0">
                <Tv className="w-3.5 h-3.5 text-blue-400" />
                <span>Servers:</span>
              </span>
              {SERVER_TEMPLATES.map(srv => (
                <button
                  key={srv.id}
                  onClick={() => {
                    setHlsFailed(true);
                    pingAndSelectServer(srv.id, true);
                  }}
                  className={`px-2.5 py-1 rounded font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    !useHlsMode && selectedServer === srv.id
                      ? 'bg-blue-600 text-white font-semibold shadow-sm'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                  }`}
                >
                  Server {srv.id} ({srv.name})
                </button>
              ))}
            </div>

            {/* TMDB Spoken Languages & Quick Notice */}
            <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-400 pt-1">
              <span className="flex items-center gap-1.5">
                <Shield className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>
                  Preferred audio is saved automatically • TMDB Languages:{' '}
                  <strong className="text-slate-300">
                    {tmdbMeta?.spokenLanguages?.length
                      ? tmdbMeta.spokenLanguages.map(l => l.english_name).join(', ')
                      : `${drama.country}, Hindi Dubbed`}
                  </strong>
                </span>
              </span>
              <span className="text-slate-500 hidden sm:inline">1080p Ultra HD Streaming</span>
            </div>
          </div>
        </div>

        {/* Adsterra High-Speed VIP Server Banner right under player */}
        <AdsterraBanner type="player" className="mb-6" />

        {/* Title and Dubbing Subtitle */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-slate-800">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                Watch Online {drama.title} · Episode {currentEpisode}
              </h1>
              <p className="text-sm font-semibold text-blue-400 mt-1">
                {drama.country} Drama · Hindi Dubbed ({activeLangMeta.label} Track Active)
              </p>
            </div>

            <div className="flex items-center gap-2 self-start md:self-auto">
              {currentEpisode > 1 && (
                <a
                  href={`/watch/${drama.slug}/episode-${currentEpisode - 1}`}
                  onClick={e => {
                    e.preventDefault();
                    onSelectEpisode(currentEpisode - 1);
                  }}
                  className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs sm:text-sm font-semibold border border-slate-700 transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                  <span>Episode {currentEpisode - 1}</span>
                </a>
              )}
              {currentEpisode < drama.totalEpisodes && (
                <a
                  href={`/watch/${drama.slug}/episode-${currentEpisode + 1}`}
                  onClick={e => {
                    e.preventDefault();
                    onSelectEpisode(currentEpisode + 1);
                  }}
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-colors shadow-sm shadow-blue-500/20"
                >
                  <span>Next</span>
                  <ChevronRight className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        </div>

        {/* Download Section */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-xl p-5 mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                {drama.title} – Episode {currentEpisode}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300">
                <span className="flex items-center gap-1 text-amber-400 font-bold">
                  <Star className="w-4 h-4 fill-amber-400" />
                  {drama.rating}
                </span>
                <span className="text-slate-500">·</span>
                <span>{drama.year}</span>
                <span className="text-slate-500">·</span>
                <span className="flex items-center gap-1 text-slate-300">
                  <Eye className="w-3.5 h-3.5 text-slate-400" />
                  {drama.views} views
                </span>
                <span className="text-slate-500">·</span>
                <span className="flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-400" />
                  {tmdbMeta?.runtime ? `${tmdbMeta.runtime} min` : drama.duration}
                </span>
                <span className="text-slate-500">·</span>
                <span className="flex flex-wrap gap-1.5">
                  {(drama.genres || []).map(g => {
                    const gSlug = slugifyText(g);
                    return (
                      <a
                        key={g}
                        href={`/genre/${gSlug}`}
                        onClick={e => {
                          e.preventDefault();
                          onOpenGenre(gSlug);
                        }}
                        className="text-blue-400 hover:text-blue-300 font-medium"
                      >
                        {g}
                      </a>
                    );
                  })}
                </span>
              </div>
            </div>

            <div className="shrink-0">
              <button
                onClick={() => setShowDownloadModal(true)}
                className="w-full sm:w-auto flex items-center justify-center gap-2.5 px-6 py-3.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-sm sm:text-base shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02] cursor-pointer"
              >
                <Download className="w-5 h-5 stroke-[2.5]" />
                <span>Download Episode {currentEpisode}</span>
              </button>
            </div>
          </div>
        </div>

        {/* Adsterra Download Banner */}
        <AdsterraBanner type="download" className="mb-8" />

        {/* Two-Column Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
                About {drama.title}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed font-normal">
                {tmdbMeta?.overview || drama.overview}
              </p>
              
              <div className="mt-4 pt-4 border-t border-slate-800/70 text-xs text-slate-400 italic">
                Watch <strong className="text-slate-200 font-semibold">{drama.title} Episode {currentEpisode}</strong> Hindi Dubbed online for free in HD on HindiDrama.net.
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-blue-400" />
                <span>Episode {currentEpisode} Streaming FAQs</span>
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="bg-slate-900/70 border border-slate-800 rounded-lg p-3.5">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-100 mb-1">
                      {faq.question}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">
                      {faq.answer}
                    </p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-blue-400" />
                  <span>Comments ({comments.length})</span>
                </h2>
                <span className="text-xs text-slate-400">
                  Shared for all episodes of this drama.
                </span>
              </div>

              <form onSubmit={handlePostComment} className="mb-6 space-y-3">
                <input
                  type="text"
                  value={commentName}
                  onChange={e => setCommentName(e.target.value)}
                  placeholder="Your Name (Optional)"
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500"
                />
                <textarea
                  rows={3}
                  value={commentText}
                  onChange={e => setCommentText(e.target.value)}
                  placeholder="Write your review or comment for this episode..."
                  required
                  className="w-full bg-slate-900 border border-slate-700/80 rounded-lg p-3 text-xs sm:text-sm text-slate-100 placeholder-slate-400 focus:outline-none focus:border-blue-500 resize-none"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={commentSubmitting || !commentText.trim()}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs sm:text-sm font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed shadow-sm"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post comment</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3 divide-y divide-slate-800/60">
                {comments.length === 0 ? (
                  <div className="text-center py-6 text-xs text-slate-400">
                    No comments yet. Be the first to comment!
                  </div>
                ) : (
                  comments.map(cmt => (
                    <div key={cmt.id} className="pt-3 first:pt-0">
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-gradient-to-tr from-blue-700 to-indigo-600 flex items-center justify-center text-xs font-bold text-white uppercase">
                            {cmt.userName.charAt(0)}
                          </div>
                          <span className="text-xs sm:text-sm font-semibold text-slate-200">
                            {cmt.userName}
                          </span>
                          {cmt.episodeNumber && (
                            <span className="text-[10px] bg-slate-800 text-slate-400 px-1.5 py-0.5 rounded">
                              Ep {cmt.episodeNumber}
                            </span>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-400">
                          {cmt.createdAt}
                        </span>
                      </div>
                      <p className="text-xs sm:text-sm text-slate-300 pl-9 mb-2">
                        {cmt.content}
                      </p>
                      <div className="pl-9 flex items-center gap-4 text-xs text-slate-400">
                        <button
                          onClick={() => handleLikeComment(cmt.id)}
                          className="flex items-center gap-1 hover:text-blue-400 transition-colors"
                        >
                          <ThumbsUp className="w-3 h-3" />
                          <span>{cmt.likes || 0}</span>
                        </button>
                        <button
                          onClick={() => setCommentText(`@${cmt.userName} `)}
                          className="hover:text-blue-400 transition-colors"
                        >
                          Reply
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <a
              href={`/drama/${drama.slug}`}
              onClick={e => {
                e.preventDefault();
                onOpenDramaDetail(drama.slug);
              }}
              className="bg-slate-900/60 border border-slate-800 rounded-xl p-4 flex gap-4 cursor-pointer hover:border-blue-500/50 transition-colors group"
            >
              <OptimizedImage
                src={drama.poster}
                alt={`${drama.title} Hindi Dubbed Poster`}
                width={128}
                height={192}
                className="w-16 h-24 object-cover rounded-lg bg-slate-800 shrink-0"
              />
              <div className="flex flex-col justify-between">
                <div>
                  <h3 className="text-sm font-bold text-white group-hover:text-blue-400 transition-colors">
                    {drama.title}
                  </h3>
                  <p className="text-xs text-slate-400 mt-1">
                    {drama.year} · {drama.country} {(drama.genres || []).slice(0, 2).join(', ')}
                  </p>
                </div>
                <span className="text-xs text-blue-400 font-semibold underline">
                  All details & cast »
                </span>
              </div>
            </a>

            <div className="bg-slate-900/40 border border-slate-800/80 rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-800">
                <h2 className="text-base font-bold text-white">
                  Episodes <span className="text-blue-400 font-normal">({drama.totalEpisodes} total)</span>
                </h2>
                <span className="text-xs text-slate-400">
                  Hindi Dubbed
                </span>
              </div>

              <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2 max-h-[460px] overflow-y-auto pr-1">
                {Array.from({ length: drama.totalEpisodes }, (_, i) => i + 1).map(ep => {
                  const isActive = ep === currentEpisode;
                  return (
                    <a
                      key={ep}
                      href={`/watch/${drama.slug}/episode-${ep}`}
                      onClick={e => {
                        e.preventDefault();
                        onSelectEpisode(ep);
                      }}
                      className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer ${
                        isActive
                          ? 'bg-blue-600 text-white shadow-md shadow-blue-600/30 ring-2 ring-blue-400'
                          : 'bg-slate-800/80 text-slate-300 hover:bg-slate-700 hover:text-white border border-slate-700/50'
                      }`}
                    >
                      {isActive && <Play className="w-2.5 h-2.5 fill-current" />}
                      <span>Episode {ep}</span>
                    </a>
                  );
                })}
              </div>
            </div>

            <AdsterraBanner type="native" />
          </div>
        </div>

      </div>

      {/* Download Resolution Modal with Direct Adsterra Smartlink Anchors */}
      {showDownloadModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-md w-full p-6 shadow-2xl relative">
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div className="flex items-center gap-2">
                <Download className="w-5 h-5 text-blue-400" />
                <h3 className="text-lg font-bold text-white">
                  Download Episode {currentEpisode}
                </h3>
              </div>
              <button
                onClick={() => setShowDownloadModal(false)}
                className="text-slate-400 hover:text-white text-lg font-bold p-1 cursor-pointer"
              >
                ✕
              </button>
            </div>

            <p className="text-xs text-slate-300 mt-3 mb-4">
              Select your desired video quality to download <strong className="text-white">{drama.title} Ep {currentEpisode}</strong> with crystal clear Hindi Dubbed audio:
            </p>

            <div className="space-y-3">
              {[
                { quality: '1080p Full HD [Hindi Dubbed]', size: '1.2 GB', audio: 'Pure Hindi 5.1 + English Subs' },
                { quality: '720p HD [Dual Audio]', size: '650 MB', audio: 'Hindi Clean Stereo' },
                { quality: '480p Mobile Fast', size: '280 MB', audio: 'Hindi Optimized Audio' },
              ].map((opt, idx) => (
                <a
                  key={opt.quality}
                  href={getNextAdsterraLink()}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => {
                    triggerSmartlink(() => setShowDownloadModal(false));
                  }}
                  className="w-full flex items-center justify-between p-3.5 rounded-xl bg-slate-800 hover:bg-blue-600/30 border border-slate-700 hover:border-blue-500 text-left transition-all group cursor-pointer"
                >
                  <div>
                    <p className="text-sm font-bold text-white group-hover:text-blue-400">
                      {opt.quality}
                    </p>
                    <p className="text-xs text-slate-400">
                      {opt.audio} • {opt.size} • Mirror #{idx + 1}
                    </p>
                  </div>
                  <span className="flex items-center gap-1 text-xs font-semibold text-blue-400 group-hover:text-blue-300 bg-slate-900 px-2.5 py-1 rounded-lg border border-slate-700">
                    <Download className="w-3.5 h-3.5" />
                    Download
                  </span>
                </a>
              ))}
            </div>

            <div className="mt-5 p-3 rounded-lg bg-blue-950/40 border border-blue-900/60 text-[11px] text-blue-200 flex items-center gap-2">
              <ExternalLink className="w-4 h-4 shrink-0 text-blue-400" />
              <span>Downloads are secured and delivered via AsiaFilm cloud mirrors with no waiting queue.</span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
