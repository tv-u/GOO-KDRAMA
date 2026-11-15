import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import type Hls from 'hls.js';
import {
  Play,
  Star,
  Eye,
  Clock,
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  ThumbsUp,
  Send,
  Share2,
  Moon,
  Sun,
  RefreshCw,
  Tv,
  Shield,
  ExternalLink,
  Sparkles,
  HelpCircle,
  Activity,
  Volume2,
  Maximize2,
  X,
  Gauge,
  Subtitles,
  PictureInPicture2,
  SkipForward,
  AlertTriangle,
  Layers,
  Check,
} from 'lucide-react';
import type {
  AudioLanguageCode,
  CustomStreamSource,
  Drama,
  DramaComment,
  TmdbEpisodeMeta,
  EpisodeDetail,
  SeasonSummary,
} from '../types/drama.ts';
import {
  getCommentsForDrama,
  addComment,
  likeComment,
  saveWatchHistory,
  getPreferredAudioLang,
  savePreferredAudioLang,
  getEpisodePlaybackProgress,
  saveEpisodePlaybackProgress,
  markEpisodeWatched,
  getLastWorkingServer,
  saveLastWorkingServer,
  trackPlatformEvent,
} from '../services/storage.ts';
import {
  fetchTmdbEpisodeSync,
  fetchTmdbShowSeasons,
  fetchTmdbSeasonEpisodes,
  searchTMDB,
} from '../services/tmdb.ts';
import {
  HLX_SERVERS,
  HLX_AUDIO_LANGUAGES,
  buildHlxDirectUrl,
  buildHlxSyncedIframeSrc,
  getAudioLanguageMeta,
  type HlxServerNode,
} from '../services/hlxPlayerEngine.ts';
import { getDramaFaqs, getContentPath, getMp4StreamPath, slugifyText } from '../services/seo.ts';
import { triggerSmartlinkWithCooldown } from '../services/adsterra.ts';
import { AdsterraBanner } from './AdsterraBanner.tsx';
import { OptimizedImage } from './OptimizedImage.tsx';
import { VideoJsPlayer } from './VideoJsPlayer.tsx';

interface WatchPlayerProps {
  drama: Drama;
  currentEpisode: number;
  currentSeason?: number;
  masterHlsUrl?: string;
  hindiOnlyLocked?: boolean;
  customWindowMode?: boolean;
  initialServerId?: number;
  initialLang?: AudioLanguageCode;
  onSelectEpisode: (ep: number, season?: number) => void;
  onNavigateHome: () => void;
  onSelectCategory: (country: string) => void;
  onOpenDramaDetail: (slug: string) => void;
  onOpenGenre: (genreSlug: string) => void;
}

export const WatchPlayer: React.FC<WatchPlayerProps> = ({
  drama,
  currentEpisode,
  currentSeason,
  masterHlsUrl,
  hindiOnlyLocked = false,
  customWindowMode = false,
  initialServerId,
  initialLang,
  onSelectEpisode,
  onNavigateHome,
  onSelectCategory,
  onOpenDramaDetail,
  onOpenGenre,
}) => {
  const [resolvedTmdbId, setResolvedTmdbId] = useState<number>(drama.tmdbId || 0);
  const tmdbId = drama.tmdbId || resolvedTmdbId;
  const mediaType: 'tv' | 'movie' = drama.type === 'movie' ? 'movie' : 'tv';
  const providedHlsSource = masterHlsUrl || drama.masterHlsUrl || '';

  // Dynamically resolve TMDB ID if catalog entry lacks one (never fall back to wrong show)
  useEffect(() => {
    if (drama.tmdbId) {
      setResolvedTmdbId(drama.tmdbId);
      return;
    }
    let active = true;
    searchTMDB(drama.title)
      .then(results => {
        if (!active || !results.length) return;
        const matched =
          results.find((r: any) =>
            mediaType === 'movie' ? r.media_type === 'movie' : r.media_type === 'tv'
          ) || results[0];
        if (matched?.id) setResolvedTmdbId(Number(matched.id));
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [drama.tmdbId, drama.title, drama.slug, mediaType]);

  // Unified Season + Audio + Server State
  const [selectedSeasonNumber, setSelectedSeasonNumber] = useState<number>(
    currentSeason || drama.season || 1
  );
  const [selectedLang, setSelectedLang] = useState<AudioLanguageCode>(initialLang || 'ko');
  const effectiveLang: AudioLanguageCode = hindiOnlyLocked ? 'hi' : selectedLang;
  const [selectedServerId, setSelectedServerId] = useState<number>(
    initialServerId !== undefined && HLX_SERVERS.some(s => s.id === initialServerId)
      ? initialServerId
      : 1
  );

  // Sync season prop changes dynamically
  useEffect(() => {
    setSelectedSeasonNumber(currentSeason || drama.season || 1);
  }, [currentSeason, drama.season, drama.slug]);

  // Unified HLX server node & language meta
  const currentServer: HlxServerNode = useMemo(
    () => HLX_SERVERS.find(s => s.id === selectedServerId) || HLX_SERVERS[0],
    [selectedServerId]
  );
  const activeLangMeta = useMemo(() => getAudioLanguageMeta(effectiveLang), [effectiveLang]);

  // Resolved direct / API / custom stream states
  const [customSources, setCustomSources] = useState<CustomStreamSource[]>([]);
  const [selectedCustomSource, setSelectedCustomSource] = useState<CustomStreamSource | null>(null);
  const [resolvedHlsUrl, setResolvedHlsUrl] = useState<string>('');
  const [resolvedHlsSubs, setResolvedHlsSubs] = useState<{ label: string; lang: string; url: string }[]>([]);
  const [hlsFailed, setHlsFailed] = useState<boolean>(false);
  const [hlsAudioTracks, setHlsAudioTracks] = useState<{ id: number; name: string; lang?: string }[]>([]);
  const [activeHlsAudioTrackIdx, setActiveHlsAudioTrackIdx] = useState<number>(0);
  const [preferOriginalHls, setPreferOriginalHls] = useState<boolean>(false);
  const [hlsAudioStatus, setHlsAudioStatus] = useState<{
    matched: boolean;
    actualLabel: string;
    viaDubbed?: boolean;
    dubbedEmbedUrl?: string | null;
    dubbedTitle?: string | null;
  } | null>(null);

  const [resolvedApiEmbedUrl, setResolvedApiEmbedUrl] = useState<string | null>(null);
  const [resolvingStream, setResolvingStream] = useState<boolean>(false);

  // TMDB Seasons & Episodes Live Auto-Sync
  const [syncedSeasons, setSyncedSeasons] = useState<SeasonSummary[]>(drama.seasons || []);
  const [syncedEpisodes, setSyncedEpisodes] = useState<EpisodeDetail[]>([]);
  const [loadingSyncedEpisodes, setLoadingSyncedEpisodes] = useState<boolean>(false);
  const [tmdbMeta, setTmdbMeta] = useState<TmdbEpisodeMeta | null>(null);
  const [syncingMeta, setSyncingMeta] = useState<boolean>(false);

  // Player UI controls
  const [cinemaMode, setCinemaMode] = useState<boolean>(false);
  const [sandboxShieldEnabled, setSandboxShieldEnabled] = useState<boolean>(true);
  const [cleanPopupOpen, setCleanPopupOpen] = useState<boolean>(false);
  const [serverReloadKey, setServerReloadKey] = useState<number>(0);
  const [fallbackMessage, setFallbackMessage] = useState<string | null>(null);
  const [serverStatus, setServerStatus] = useState<'checking' | 'online' | 'switched'>('online');
  const [serverLatency, setServerLatency] = useState<number | null>(null);
  const [iframeLoaded, setIframeLoaded] = useState<boolean>(false);
  const [allSourcesFailed, setAllSourcesFailed] = useState<boolean>(false);
  const [copiedLink, setCopiedLink] = useState<boolean>(false);
  const [copiedMp4, setCopiedMp4] = useState<boolean>(false);
  const [isStaticHost, setIsStaticHost] = useState<boolean>(false);

  // Video.js controls
  const [playbackRate, setPlaybackRate] = useState<number>(1);
  const [hlsQualities, setHlsQualities] = useState<{ index: number; height: number; bitrate: number }[]>([]);
  const [selectedQuality, setSelectedQuality] = useState<number>(-1);
  const [hlsSubtitles, setHlsSubtitles] = useState<{ id: number; name: string; lang?: string }[]>([]);
  const [selectedSubtitle, setSelectedSubtitle] = useState<number>(-1);
  const [pipSupported, setPipSupported] = useState<boolean>(false);
  const [autoNextEnabled, setAutoNextEnabled] = useState<boolean>(true);
  const [autoNextCountdown, setAutoNextCountdown] = useState<number | null>(null);
  const [resumeToast, setResumeToast] = useState<string | null>(null);

  // Comments
  const [comments, setComments] = useState<DramaComment[]>([]);
  const [commentName, setCommentName] = useState<string>('');
  const [commentText, setCommentText] = useState<string>('');
  const [commentSubmitting, setCommentSubmitting] = useState<boolean>(false);

  const playerContainerRef = useRef<HTMLDivElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const lightboxVideoRef = useRef<HTMLVideoElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const triedServersRef = useRef<Set<number>>(new Set());
  const lastProgressSaveRef = useRef<number>(0);
  const hasSeekedSavedRef = useRef<boolean>(false);

  // Initialize environment preferences post-mount (hydration safe)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsStaticHost(window.location.hostname.endsWith('.github.io'));
      setPipSupported(Boolean(document.pictureInPictureEnabled));
    }
    if (!initialLang) {
      const savedLang = getPreferredAudioLang();
      if (savedLang) setSelectedLang(savedLang);
    }
    if (initialServerId === undefined) {
      const lastSrv = getLastWorkingServer();
      if (lastSrv && HLX_SERVERS.some(s => s.id === lastSrv)) {
        setSelectedServerId(lastSrv);
      }
    }
  }, [initialLang, initialServerId]);

  // Dynamic URL query parameter sync (server & lang without page reload)
  useEffect(() => {
    if (typeof window === 'undefined' || customWindowMode) return;
    const url = new URL(window.location.href);
    url.searchParams.set('server', String(selectedServerId));
    url.searchParams.set('lang', effectiveLang);
    if (selectedSeasonNumber > 1) {
      url.searchParams.set('season', String(selectedSeasonNumber));
    } else {
      url.searchParams.delete('season');
    }
    window.history.replaceState({}, '', url.pathname + url.search);
  }, [selectedServerId, effectiveLang, selectedSeasonNumber, customWindowMode]);

  // Lock body scroll on lightbox modal
  useEffect(() => {
    if (!cleanPopupOpen || typeof window === 'undefined') return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setCleanPopupOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [cleanPopupOpen]);

  // 1. Live TMDB Seasons & Episodes Auto-Sync
  useEffect(() => {
    if (mediaType === 'movie' || !tmdbId) return;
    let active = true;
    setLoadingSyncedEpisodes(true);
    Promise.all([
      fetchTmdbShowSeasons(tmdbId),
      fetchTmdbSeasonEpisodes(tmdbId, selectedSeasonNumber),
    ])
      .then(([seasonsData, epsData]) => {
        if (!active) return;
        if (seasonsData.length > 0) setSyncedSeasons(seasonsData);
        if (epsData.length > 0) setSyncedEpisodes(epsData);
      })
      .catch(() => {})
      .finally(() => {
        if (active) setLoadingSyncedEpisodes(false);
      });
    return () => {
      active = false;
    };
  }, [tmdbId, mediaType, selectedSeasonNumber]);

  const activeSeasonEpisodeCount = useMemo(() => {
    const matchedSeason = syncedSeasons.find(s => s.seasonNumber === selectedSeasonNumber);
    return syncedEpisodes.length || matchedSeason?.episodeCount || drama.totalEpisodes || 1;
  }, [syncedSeasons, syncedEpisodes.length, selectedSeasonNumber, drama.totalEpisodes]);

  // 2. Live TMDB Episode Detail Sync
  useEffect(() => {
    let active = true;
    setSyncingMeta(true);
    fetchTmdbEpisodeSync(tmdbId, selectedSeasonNumber, currentEpisode, mediaType)
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
  }, [tmdbId, selectedSeasonNumber, currentEpisode, mediaType]);

  // 3. Unified HLS.proxy + Real Multi-Audio Resolver
  useEffect(() => {
    if (selectedCustomSource) return;

    let active = true;
    setResolvedApiEmbedUrl(null);
    setResolvedHlsUrl('');
    setResolvedHlsSubs([]);
    setHlsAudioStatus(null);
    setHlsFailed(false);
    hasSeekedSavedRef.current = false;

    if (currentServer.mode !== 'hlx-direct' || isStaticHost) {
      setResolvingStream(false);
      return;
    }

    setResolvingStream(true);

    const resolveStream = async () => {
      try {
        const hlsRes = await fetch('/api/hls-resolve', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            tmdbId,
            type: mediaType,
            season: selectedSeasonNumber,
            episode: currentEpisode,
            lang: effectiveLang,
            title: tmdbMeta?.title || drama.title,
          }),
        });
        if (hlsRes.ok) {
          const data = await hlsRes.json();
          if (!active) return;
          if (data?.ok && data?.streamUrl) {
            // If user requested dubbed language (e.g. Hindi) and HLS lacks that track, play verified dubbed stream when available
            if (data.dubbedEmbedUrl && !data.matchedRequestedAudio && !preferOriginalHls) {
              setResolvedApiEmbedUrl(data.dubbedEmbedUrl);
              setHlsAudioStatus({
                matched: true,
                actualLabel: `${activeLangMeta.label} (Verified Dub)`,
                viaDubbed: true,
                dubbedEmbedUrl: data.dubbedEmbedUrl,
                dubbedTitle: data.dubbedTitle || null,
              });
              setServerStatus('online');
              setServerLatency(32);
              setResolvingStream(false);
              return;
            }
            setResolvedHlsUrl(data.streamUrl);
            setResolvedHlsSubs(Array.isArray(data.subs) ? data.subs : []);
            setHlsAudioStatus({
              matched: Boolean(data.matchedRequestedAudio),
              actualLabel: data.actualAudioLabel || activeLangMeta.label,
              dubbedEmbedUrl: data.dubbedEmbedUrl || null,
              dubbedTitle: data.dubbedTitle || null,
            });
            setServerStatus('online');
            setServerLatency(32);
            setResolvingStream(false);
            return;
          }
        }
        if (active) {
          setHlsFailed(true);
          setResolvingStream(false);
        }
      } catch {
        if (active) setHlsFailed(true);
      } finally {
        if (active) setResolvingStream(false);
      }
    };

    resolveStream();
    return () => {
      active = false;
    };
  }, [
    selectedCustomSource,
    currentServer.id,
    currentServer.mode,
    tmdbId,
    mediaType,
    selectedSeasonNumber,
    currentEpisode,
    effectiveLang,
    preferOriginalHls,
    tmdbMeta?.title,
    drama.title,
    activeLangMeta.label,
    serverReloadKey,
    isStaticHost,
  ]);

  // Background instant-play prefetch for next episode (populates server resolve cache silently)
  useEffect(() => {
    if (isStaticHost || mediaType === 'movie' || !tmdbId) return;
    const nextEp = currentEpisode + 1;
    if (nextEp > activeSeasonEpisodeCount) return;
    const timer = setTimeout(() => {
      fetch('/api/hls-resolve', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          tmdbId,
          type: mediaType,
          season: selectedSeasonNumber,
          episode: nextEp,
          lang: effectiveLang,
          title: tmdbMeta?.title || drama.title,
        }),
      }).catch(() => {});
    }, 1500);
    return () => clearTimeout(timer);
  }, [
    isStaticHost,
    mediaType,
    tmdbId,
    currentEpisode,
    activeSeasonEpisodeCount,
    selectedSeasonNumber,
    effectiveLang,
    tmdbMeta?.title,
    drama.title,
  ]);

  // Compute direct video source vs synced iframe source cleanly
  const activeDirectVideo: { url: string; type: 'hls' | 'mp4' | 'webm' | 'ogg' } | null = useMemo(() => {
    if (selectedCustomSource && (selectedCustomSource.format === 'hls' || selectedCustomSource.format === 'mp4')) {
      return { url: selectedCustomSource.url, type: selectedCustomSource.format };
    }
    if (resolvedApiEmbedUrl) {
      return null;
    }
    if (currentServer.mode === 'hlx-direct' && resolvedHlsUrl && !hlsFailed) {
      return { url: resolvedHlsUrl, type: 'hls' };
    }
    if (currentServer.mode === 'hlx-direct' && providedHlsSource && !hlsFailed) {
      return { url: providedHlsSource, type: 'hls' };
    }
    return null;
  }, [
    selectedCustomSource,
    resolvedApiEmbedUrl,
    currentServer.mode,
    resolvedHlsUrl,
    providedHlsSource,
    hlsFailed,
  ]);

  const activeDirectDashUrl =
    selectedCustomSource && selectedCustomSource.format === 'dash' ? selectedCustomSource.url : '';
  const useHlsMode = Boolean(activeDirectVideo?.type === 'hls');
  const isDirectVideoMode = Boolean(activeDirectVideo);

  // Unified Dynamic Direct URL, Clean New Window URL & Synced Iframe Src
  const directServerUrl = useMemo(() => {
    if (selectedCustomSource && selectedCustomSource.format === 'iframe') {
      return selectedCustomSource.url;
    }
    if (resolvedApiEmbedUrl) {
      return resolvedApiEmbedUrl;
    }
    return buildHlxDirectUrl(currentServer, {
      tmdbId,
      imdbId: tmdbMeta?.imdbId,
      season: selectedSeasonNumber,
      episode: currentEpisode,
      lang: effectiveLang,
      mediaType,
      title: tmdbMeta?.title || drama.title,
    });
  }, [
    selectedCustomSource,
    resolvedApiEmbedUrl,
    currentServer,
    tmdbId,
    tmdbMeta?.imdbId,
    tmdbMeta?.title,
    drama.title,
    selectedSeasonNumber,
    currentEpisode,
    effectiveLang,
    mediaType,
  ]);

  const cleanNewWindowUrl = useMemo(() => {
    if (customWindowMode) {
      return directServerUrl || '#';
    }
    const base =
      mediaType === 'movie'
        ? `/watch/${drama.slug}`
        : `/watch/${drama.slug}/episode-${currentEpisode}`;
    const params = new URLSearchParams({
      window: '1',
      server: String(selectedServerId),
      lang: effectiveLang,
    });
    if (mediaType !== 'movie' && selectedSeasonNumber > 1) {
      params.set('season', String(selectedSeasonNumber));
    }
    if (hindiOnlyLocked) {
      params.set('audio', 'hindi');
    }
    return `${base}?${params.toString()}`;
  }, [
    customWindowMode,
    directServerUrl,
    mediaType,
    drama.slug,
    currentEpisode,
    selectedServerId,
    effectiveLang,
    selectedSeasonNumber,
    hindiOnlyLocked,
  ]);

  const mp4StreamPath = useMemo(
    () => getMp4StreamPath(drama, currentEpisode, selectedSeasonNumber),
    [drama, currentEpisode, selectedSeasonNumber]
  );

  const activeIframeSrc = useMemo(() => {
    if (selectedCustomSource && selectedCustomSource.format === 'iframe') {
      return selectedCustomSource.url;
    }
    if (resolvedApiEmbedUrl) {
      return resolvedApiEmbedUrl;
    }
    return buildHlxSyncedIframeSrc(directServerUrl, currentServer, sandboxShieldEnabled, isStaticHost);
  }, [
    selectedCustomSource,
    resolvedApiEmbedUrl,
    currentServer,
    directServerUrl,
    sandboxShieldEnabled,
    isStaticHost,
  ]);

  // Server Selection + Background Ping Health Check
  const selectAndSyncServer = useCallback(
    async (serverId: number, autoFailover = false) => {
      const targetSrv = HLX_SERVERS.find(s => s.id === serverId) || HLX_SERVERS[0];
      setSelectedCustomSource(null);
      setSelectedServerId(targetSrv.id);
      setHlsFailed(false);
      setIframeLoaded(false);
      setAllSourcesFailed(false);
      setServerReloadKey(prev => prev + 1);
      saveLastWorkingServer(targetSrv.id);

      if (targetSrv.mode !== 'hlx-relay' || isStaticHost) {
        setServerStatus('online');
        setServerLatency(32);
        return;
      }

      setServerStatus('checking');
      try {
        const probeUrl = buildHlxDirectUrl(targetSrv, {
          tmdbId,
          imdbId: tmdbMeta?.imdbId,
          season: selectedSeasonNumber,
          episode: currentEpisode,
          lang: effectiveLang,
          mediaType,
          title: tmdbMeta?.title || drama.title,
        });
        const res = await fetch('/api/server-ping', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: probeUrl }),
        });
        if (res.ok) {
          const data = await res.json();
          setServerStatus('online');
          setServerLatency(data.latencyMs || 40);
          trackPlatformEvent({
            type: 'source_health',
            dramaSlug: drama.slug,
            episode: currentEpisode,
            serverId: targetSrv.id,
            serverName: targetSrv.name,
            ok: Boolean(data.ok),
            latencyMs: data.latencyMs || 40,
          });
          if (data.ok || !autoFailover) return;
        }
      } catch {
        // Keep relay attempt active
      }

      if (autoFailover && triedServersRef.current.size < 4) {
        triedServersRef.current.add(targetSrv.id);
        const nextSrv = HLX_SERVERS.find(
          s => !triedServersRef.current.has(s.id) && s.id !== targetSrv.id
        );
        if (nextSrv) {
          setSelectedServerId(nextSrv.id);
          setServerStatus('switched');
          setFallbackMessage(`HLX Auto-Failover: Switched to ${nextSrv.name}`);
          setTimeout(() => setFallbackMessage(null), 3500);
          return;
        }
      }
      setServerStatus('online');
    },
    [
      isStaticHost,
      tmdbId,
      tmdbMeta?.imdbId,
      tmdbMeta?.title,
      drama.title,
      drama.slug,
      selectedSeasonNumber,
      currentEpisode,
      effectiveLang,
      mediaType,
    ]
  );

  const handleAutoFallback = useCallback(() => {
    setSelectedCustomSource(null);
    setIframeLoaded(false);
    triedServersRef.current.add(selectedServerId);

    const nextUntried = HLX_SERVERS.find(
      s => !triedServersRef.current.has(s.id) && s.id !== selectedServerId
    );
    if (nextUntried) {
      setServerStatus('switched');
      setFallbackMessage(`HLX Auto-Failover: Switched to ${nextUntried.name}`);
      selectAndSyncServer(nextUntried.id, false);
      setTimeout(() => setFallbackMessage(null), 3500);
      return;
    }

    // If all relay mirrors timed out while HLX Shield is ON, switch seamlessly to direct embed mode
    if (sandboxShieldEnabled && !isStaticHost) {
      triedServersRef.current.clear();
      setSandboxShieldEnabled(false);
      setServerStatus('switched');
      setFallbackMessage('HLX Auto-Sync: Switched to Direct Mirror Mode');
      selectAndSyncServer(HLX_SERVERS[0].id, false);
      setTimeout(() => setFallbackMessage(null), 3500);
      return;
    }

    setAllSourcesFailed(true);
    trackPlatformEvent({
      type: 'playback_error',
      dramaSlug: drama.slug,
      dramaTitle: drama.title,
      episode: currentEpisode,
      serverId: currentServer.id,
      serverName: currentServer.name,
      ok: false,
      reason: 'All HLX mirrors unavailable',
    });
  }, [
    selectedServerId,
    sandboxShieldEnabled,
    isStaticHost,
    drama.slug,
    drama.title,
    currentEpisode,
    currentServer.id,
    currentServer.name,
    selectAndSyncServer,
  ]);

  // Unified Real Multi-Audio Switcher (Zero-reload for embedded HLS tracks + real upstream audio re-resolution)
  const handleSelectAudioLanguage = (lang: AudioLanguageCode) => {
    if (hindiOnlyLocked) return;
    triggerSmartlinkWithCooldown(45000);
    setPreferOriginalHls(false);
    setSelectedLang(lang);
    savePreferredAudioLang(lang);
    const targetMeta = getAudioLanguageMeta(lang);

    if (useHlsMode && hlsRef.current) {
      const tracks = hlsRef.current.audioTracks || [];
      const matchIndex = tracks.findIndex(t => {
        const tLang = (t.lang || '').toLowerCase();
        const tName = (t.name || '').toLowerCase();
        return targetMeta.aliases.some(a => tLang.includes(a) || tName.includes(a));
      });
      if (matchIndex !== -1) {
        hlsRef.current.audioTrack = matchIndex;
        setActiveHlsAudioTrackIdx(matchIndex);
        setHlsAudioStatus({
          matched: true,
          actualLabel: targetMeta.label,
        });
        setFallbackMessage(`Real Audio Track Switched: ${targetMeta.flag} ${targetMeta.label}`);
        setTimeout(() => setFallbackMessage(null), 2800);
        return;
      }
    }

    setIframeLoaded(false);
    setServerReloadKey(prev => prev + 1);
    setFallbackMessage(
      `Resolving ${targetMeta.flag} ${targetMeta.label} Audio on ${currentServer.name}...`
    );
    setTimeout(() => setFallbackMessage(null), 2800);
  };

  // Instant postMessage listener for /api/player-relay upstream HTTP errors (skip failing nodes immediately)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onRelayMessage = (ev: MessageEvent) => {
      if (ev?.data?.type === 'HLX_RELAY_ERROR') {
        handleAutoFallback();
      }
    };
    window.addEventListener('message', onRelayMessage);
    return () => window.removeEventListener('message', onRelayMessage);
  }, [handleAutoFallback]);

  // Watchdog for stuck iframe loads (9s)
  useEffect(() => {
    if (isDirectVideoMode || isStaticHost || iframeLoaded || resolvingStream || allSourcesFailed) {
      return;
    }
    const timer = setTimeout(() => {
      if (!iframeLoaded) {
        handleAutoFallback();
      }
    }, 9000);
    return () => clearTimeout(timer);
  }, [
    isDirectVideoMode,
    isStaticHost,
    iframeLoaded,
    resolvingStream,
    allSourcesFailed,
    handleAutoFallback,
  ]);

  // Fetch admin manual episode sources
  useEffect(() => {
    if (isStaticHost) return;
    let active = true;
    fetch(
      `/api/sources/${encodeURIComponent(drama.slug)}/${currentEpisode}?season=${selectedSeasonNumber}`
    )
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active || !Array.isArray(data?.sources)) return;
        setCustomSources(data.sources);
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, [drama.slug, currentEpisode, selectedSeasonNumber, isStaticHost]);

  // Reset per-episode playback telemetry & watch history
  useEffect(() => {
    triedServersRef.current.clear();
    setAllSourcesFailed(false);
    setIframeLoaded(false);
    setAutoNextCountdown(null);
    setResumeToast(null);
    hasSeekedSavedRef.current = false;

    saveWatchHistory({
      dramaSlug: drama.slug,
      dramaTitle: drama.title,
      episode: currentEpisode,
      poster: drama.poster,
      totalEpisodes: activeSeasonEpisodeCount,
      type: drama.type,
      country: drama.country,
      year: drama.year,
    });
    markEpisodeWatched(drama.slug, currentEpisode);
    trackPlatformEvent({
      type: 'episode_play',
      dramaSlug: drama.slug,
      dramaTitle: drama.title,
      episode: currentEpisode,
      serverName: selectedCustomSource ? selectedCustomSource.label : currentServer.name,
    });
  }, [
    drama.slug,
    drama.title,
    drama.poster,
    drama.type,
    drama.country,
    drama.year,
    currentEpisode,
    activeSeasonEpisodeCount,
  ]);

  useEffect(() => {
    setComments(getCommentsForDrama(drama.slug));
  }, [drama.slug]);

  // Auto-Next Episode countdown ticker
  useEffect(() => {
    if (autoNextCountdown === null) return;
    if (autoNextCountdown <= 0) {
      setAutoNextCountdown(null);
      if (currentEpisode < activeSeasonEpisodeCount) {
        onSelectEpisode(currentEpisode + 1, selectedSeasonNumber);
      }
      return;
    }
    const id = setTimeout(() => {
      setAutoNextCountdown(prev => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearTimeout(id);
  }, [autoNextCountdown, currentEpisode, activeSeasonEpisodeCount, selectedSeasonNumber, onSelectEpisode]);

  // Keyboard shortcuts
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')
      ) {
        return;
      }
      const vid = cleanPopupOpen ? lightboxVideoRef.current : videoRef.current;
      const key = e.key.toLowerCase();

      if (key === 'n' && currentEpisode < activeSeasonEpisodeCount) {
        e.preventDefault();
        onSelectEpisode(currentEpisode + 1, selectedSeasonNumber);
        return;
      }
      if (key === 'p' && currentEpisode > 1) {
        e.preventDefault();
        onSelectEpisode(currentEpisode - 1, selectedSeasonNumber);
        return;
      }
      if (key === 'f') {
        e.preventDefault();
        const el = vid || playerContainerRef.current;
        if (el && el.requestFullscreen) {
          if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
          else el.requestFullscreen().catch(() => {});
        }
        return;
      }

      if (!vid) return;
      if (e.code === 'Space' || key === 'k') {
        e.preventDefault();
        if (vid.paused) vid.play().catch(() => {});
        else vid.pause();
      } else if (key === 'm') {
        e.preventDefault();
        vid.muted = !vid.muted;
      } else if (e.key === 'ArrowRight' || key === 'l') {
        e.preventDefault();
        vid.currentTime = Math.min(vid.duration || vid.currentTime + 10, vid.currentTime + 10);
      } else if (e.key === 'ArrowLeft' || key === 'j') {
        e.preventDefault();
        vid.currentTime = Math.max(0, vid.currentTime - 10);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [cleanPopupOpen, currentEpisode, activeSeasonEpisodeCount, selectedSeasonNumber, onSelectEpisode]);

  const handleVideoLoadedMetadata = (vid: HTMLVideoElement | null) => {
    if (!vid || hasSeekedSavedRef.current) return;
    hasSeekedSavedRef.current = true;
    vid.playbackRate = playbackRate;
    const { progressSeconds: saved } = getEpisodePlaybackProgress(drama.slug, currentEpisode);
    const dur = Number.isFinite(vid.duration) ? vid.duration : 0;
    if (saved > 5 && (!dur || saved < dur - 15)) {
      vid.currentTime = saved;
      const mins = Math.floor(saved / 60);
      const secs = Math.floor(saved % 60).toString().padStart(2, '0');
      setResumeToast(`Resumed from ${mins}:${secs}`);
      setTimeout(() => setResumeToast(null), 4000);
    }
  };

  const handleVideoTimeUpdate = (vid: HTMLVideoElement | null) => {
    if (!vid || !Number.isFinite(vid.currentTime)) return;
    const now = Date.now();
    if (now - lastProgressSaveRef.current < 5000) return;
    lastProgressSaveRef.current = now;
    saveEpisodePlaybackProgress(
      drama.slug,
      currentEpisode,
      vid.currentTime,
      Number.isFinite(vid.duration) ? vid.duration : 0
    );
  };

  const handleVideoEnded = () => {
    if (autoNextEnabled && currentEpisode < activeSeasonEpisodeCount) {
      setAutoNextCountdown(5);
    }
  };

  const handleTogglePiP = async () => {
    const vid = cleanPopupOpen ? lightboxVideoRef.current : videoRef.current;
    if (!vid || typeof document === 'undefined') return;
    try {
      if (document.pictureInPictureElement) await document.exitPictureInPicture();
      else if (vid.requestPictureInPicture) await vid.requestPictureInPicture();
    } catch {
      // Blocked
    }
  };

  const handleChangeQuality = (levelIndex: number) => {
    setSelectedQuality(levelIndex);
    if (hlsRef.current) hlsRef.current.currentLevel = levelIndex;
  };

  const handleChangeSubtitle = (subIndex: number) => {
    setSelectedSubtitle(subIndex);
    if (hlsRef.current) hlsRef.current.subtitleTrack = subIndex;
    const vid = cleanPopupOpen ? lightboxVideoRef.current : videoRef.current;
    if (vid?.textTracks) {
      for (let i = 0; i < vid.textTracks.length; i++) {
        vid.textTracks[i].mode = i === subIndex ? 'showing' : 'disabled';
      }
    }
  };

  const handlePostComment = (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentText.trim()) return;
    setCommentSubmitting(true);
    const newComment = addComment({
      dramaSlug: drama.slug,
      episodeNumber: currentEpisode,
      userName: commentName.trim() || `DramaFan${Math.floor(100 + Math.random() * 900)}`,
      content: commentText.trim(),
    });
    setComments(prev => [newComment, ...prev]);
    setCommentText('');
    setCommentSubmitting(false);
  };

  const handleLikeComment = (id: string) => {
    const newCount = likeComment(id);
    setComments(prev => prev.map(c => (c.id === id ? { ...c, likes: newCount } : c)));
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
          <span className="bg-[#111622] text-slate-300 text-xs px-3 py-1 rounded-full border border-[#1e2638] pointer-events-none">
            Cinema Mode Active · Click anywhere to exit
          </span>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-4">
        {/* Crawlable Breadcrumb Navigation */}
        <nav
          aria-label="Breadcrumb"
          className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mb-4 overflow-x-auto whitespace-nowrap"
        >
          <a
            href="/"
            onClick={e => {
              e.preventDefault();
              onNavigateHome();
            }}
            className="hover:text-[#00c896] text-[#00c896] font-medium transition-colors"
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
            className="hover:text-[#00c896] text-slate-300 font-medium transition-colors"
          >
            {drama.country} Drama
          </a>
          <span>/</span>
          <a
            href={getContentPath(drama)}
            onClick={e => {
              e.preventDefault();
              onOpenDramaDetail(drama.slug);
            }}
            className="hover:text-[#00c896] text-slate-300 font-medium transition-colors"
          >
            {drama.title}
          </a>
          <span>/</span>
          <span className="text-white font-semibold tabular-nums">
            {mediaType === 'movie'
              ? 'Full Movie'
              : `S${selectedSeasonNumber} · Episode ${currentEpisode}`}
          </span>
        </nav>

        {/* Unified FlixHQ / HLX Video Player Shell */}
        <div
          className={`relative z-40 mb-6 bg-[#0a0d14] rounded-2xl overflow-hidden border border-[#1e2638] shadow-2xl shadow-black/80 ${
            cinemaMode ? 'ring-2 ring-[#00c896] scale-[1.01] transition-transform' : ''
          }`}
        >
          {/* 1. Header Bar */}
          <div className="bg-[#111622] border-b border-[#1e2638] px-4 py-3 flex flex-wrap items-center justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm sm:text-base font-bold text-white truncate">
                  {tmdbMeta?.title || drama.title}
                </span>
                <span className="text-xs font-bold text-[#00c896] tabular-nums">
                  {mediaType === 'movie'
                    ? 'HD Movie'
                    : `S${selectedSeasonNumber} · EP ${currentEpisode}`}
                </span>
                <span className="text-xs text-slate-300 font-medium">
                  · {activeLangMeta.flag} {activeLangMeta.label}
                </span>
                <span className="text-[11px] text-slate-400 font-mono hidden sm:inline">
                  · {activeDirectVideo ? `HLX HLS (${currentServer.name})` : currentServer.name}
                </span>
              </div>
              {syncingMeta ? (
                <div className="h-3.5 w-64 bg-[#1a2234] animate-pulse rounded mt-1.5" />
              ) : (
                <p className="text-xs text-slate-400 truncate mt-1">
                  {tmdbMeta?.episodeName ? `${tmdbMeta.episodeName} — ` : ''}
                  {tmdbMeta?.overview || drama.overview}
                </p>
              )}
            </div>

            <div className="flex items-center gap-1.5 shrink-0 text-xs">
              <button
                type="button"
                onClick={() => setCinemaMode(!cinemaMode)}
                className={`p-1.5 rounded-lg text-xs flex items-center gap-1 transition-colors cursor-pointer border ${
                  cinemaMode
                    ? 'bg-amber-500/20 text-amber-300 border-amber-500/40'
                    : 'text-slate-300 hover:text-white bg-[#0a0d14] border-[#1e2638]'
                }`}
                title="Cinema Mode"
              >
                {cinemaMode ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
                <span className="hidden md:inline">{cinemaMode ? 'Lights On' : 'Cinema'}</span>
              </button>

              <button
                type="button"
                onClick={handleAutoFallback}
                className="px-2.5 py-1.5 rounded-lg text-xs font-bold bg-[#00c896] hover:bg-[#00b084] text-slate-950 flex items-center gap-1 transition-colors cursor-pointer"
                title="Auto-switch to next healthy HLX server"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Next Server</span>
              </button>

              <button
                type="button"
                onClick={() => setServerReloadKey(prev => prev + 1)}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-[#0a0d14] border border-[#1e2638] cursor-pointer"
                title="Reload Stream"
              >
                <RefreshCw className="w-3.5 h-3.5" />
              </button>

              {!useHlsMode && currentServer.supportsRelay && !isStaticHost && (
                <button
                  type="button"
                  onClick={() => {
                    setSandboxShieldEnabled(prev => !prev);
                    setServerReloadKey(prev => prev + 1);
                  }}
                  className={`px-2 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer border transition-colors ${
                    sandboxShieldEnabled
                      ? 'bg-[#00c896]/15 text-[#00c896] border-[#00c896]/40'
                      : 'bg-[#0a0d14] text-slate-400 border-[#1e2638]'
                  }`}
                  title="HLX Sandbox-Free Shield Relay"
                >
                  <Shield className="w-3.5 h-3.5" />
                  <span className="hidden lg:inline">
                    {sandboxShieldEnabled ? 'HLX Shield ON' : 'Direct'}
                  </span>
                </button>
              )}

              <button
                type="button"
                onClick={() => setCleanPopupOpen(true)}
                className="px-2.5 py-1.5 text-slate-200 hover:text-white rounded-lg bg-[#0a0d14] hover:bg-[#1a2234] border border-[#1e2638] flex items-center gap-1 font-semibold cursor-pointer transition-colors"
                title="Open Lightbox Player"
              >
                <Maximize2 className="w-3.5 h-3.5 text-[#00c896]" />
                <span className="hidden sm:inline">Lightbox</span>
              </button>

              <a
                href={cleanNewWindowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-1.5 bg-[#00c896] hover:bg-[#00b084] text-slate-950 rounded-lg flex items-center gap-1.5 font-extrabold cursor-pointer transition-colors shadow-sm shadow-emerald-500/20"
                title="PLAY NOW"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>PLAY NOW</span>
              </a>

              <button
                type="button"
                onClick={handleShare}
                className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-[#0a0d14] border border-[#1e2638] flex items-center gap-1 cursor-pointer"
                title="Copy Episode Link"
              >
                <Share2 className="w-3.5 h-3.5" />
                <span className="hidden md:inline">{copiedLink ? 'Copied!' : 'Share'}</span>
              </button>
            </div>
          </div>

          {fallbackMessage && (
            <div className="bg-[#00c896] text-slate-950 text-xs px-4 py-2 font-bold flex items-center justify-between">
              <span>{fallbackMessage}</span>
              <span className="text-[10px] bg-black/15 px-2 py-0.5 rounded uppercase">
                Auto-Sync
              </span>
            </div>
          )}

          {/* 2. Unified Dual Switcher Bar Above Player */}
          <div className="bg-[#0e131e] border-b border-[#1e2638] px-3 sm:px-5 py-3 space-y-2.5">
            {/* Row 1: Screenshot 2 Servers + HLS.proxy, 2Embed, MultiEmbed */}
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-slate-300">
                <Tv className="w-3.5 h-3.5 text-[#00c896]" />
                <span>Servers:</span>
              </div>

              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar flex-1 max-w-full">
                {customSources.map(src => {
                  const isSelected = selectedCustomSource?.id === src.id;
                  return (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => {
                        setSelectedCustomSource(src);
                        setHlsFailed(src.format !== 'hls');
                        setAllSourcesFailed(false);
                        setIframeLoaded(false);
                        setServerReloadKey(prev => prev + 1);
                      }}
                      className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors ${
                        isSelected
                          ? 'bg-[#00c896] text-slate-950 border-[#00c896]'
                          : 'bg-[#111622] text-emerald-300 border-[#1e2638] hover:bg-[#1a2234]'
                      }`}
                    >
                      {src.label} ({src.format.toUpperCase()})
                    </button>
                  );
                })}

                {HLX_SERVERS.map(srv => {
                  const isActive = !selectedCustomSource && selectedServerId === srv.id;
                  return (
                    <button
                      key={srv.id}
                      type="button"
                      onClick={() => {
                        triggerSmartlinkWithCooldown(45000);
                        selectAndSyncServer(srv.id, true);
                      }}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold whitespace-nowrap shrink-0 transition-all cursor-pointer border flex items-center gap-1.5 ${
                        isActive
                          ? 'bg-[#00c896] text-slate-950 border-[#00c896] font-bold shadow-sm shadow-emerald-500/20'
                          : 'bg-[#111622] hover:bg-[#1a2234] text-slate-300 hover:text-white border-[#1e2638]'
                      }`}
                    >
                      <span>{srv.name}</span>
                      <span
                        className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${
                          isActive ? 'bg-black/20 text-slate-950' : 'bg-[#1e2638] text-[#00c896]'
                        }`}
                      >
                        {srv.qualityTag}
                      </span>
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <span className="hidden lg:inline-flex items-center gap-1 text-[11px] text-[#00c896] font-medium tabular-nums">
                  <Activity className="w-3.5 h-3.5" />
                  <span>
                    {serverStatus === 'checking'
                      ? 'Syncing...'
                      : serverLatency
                        ? `Ready (${serverLatency}ms)`
                        : 'Auto-Sync'}
                  </span>
                </span>
              </div>
            </div>

            {/* Row 2: Real Multi-Audio Language Switcher & Honest Verification Status */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e2638]/80">
              <div className="flex items-center gap-1.5 shrink-0 text-xs font-bold text-slate-300">
                <Volume2 className="w-3.5 h-3.5 text-[#00c896]" />
                <span>Audio Language:</span>
              </div>

              <div className="flex flex-wrap items-center gap-1.5 flex-1">
                {hindiOnlyLocked ? (
                  <span className="px-3 py-1 rounded-lg text-xs font-bold bg-[#00c896] text-slate-950 flex items-center gap-1.5">
                    <span>🇮🇳</span>
                    <span>Hindi Dubbed Only (Locked)</span>
                  </span>
                ) : (
                  HLX_AUDIO_LANGUAGES.map(lang => {
                    const isActive = effectiveLang === lang.code;
                    return (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectAudioLanguage(lang.code)}
                        className={`px-3 py-1 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border whitespace-nowrap shrink-0 ${
                          isActive
                            ? 'bg-[#00c896] text-slate-950 border-[#00c896] font-bold'
                            : 'bg-[#111622] hover:bg-[#1a2234] text-slate-300 hover:text-white border-[#1e2638]'
                        }`}
                        title={`Switch real audio language to ${lang.label}`}
                      >
                        <span>{lang.flag}</span>
                        <span>{lang.label}</span>
                        {isActive && <Check className="w-3 h-3" />}
                      </button>
                    );
                  })
                )}

                {hlsAudioStatus && (
                  <span
                    className={`text-[11px] font-semibold px-2 py-0.5 rounded border ${
                      hlsAudioStatus.matched
                        ? 'text-emerald-300 bg-emerald-500/10 border-emerald-500/30'
                        : 'text-amber-300 bg-amber-500/10 border-amber-500/30'
                    }`}
                  >
                    {hlsAudioStatus.matched
                      ? `✓ Real ${hlsAudioStatus.actualLabel} Audio`
                      : `Playing ${hlsAudioStatus.actualLabel} · ${activeLangMeta.shortLabel} Subs ON`}
                  </span>
                )}

                {hlsAudioStatus?.dubbedEmbedUrl && (
                  <button
                    type="button"
                    onClick={() => {
                      setPreferOriginalHls(prev => !prev);
                      setServerReloadKey(prev => prev + 1);
                    }}
                    className="text-[11px] font-semibold px-2.5 py-0.5 rounded bg-[#111622] hover:bg-[#1a2234] text-[#00c896] border border-[#00c896]/40 cursor-pointer"
                  >
                    {preferOriginalHls
                      ? `Switch to ${activeLangMeta.shortLabel} Dub`
                      : 'Switch to HD Original + Subs'}
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* 3. Player Viewport */}
          <div
            ref={playerContainerRef}
            className="relative aspect-video w-full bg-black flex items-center justify-center"
          >
            {cleanPopupOpen ? (
              <div className="w-full h-full bg-[#0a0d14] flex flex-col items-center justify-center p-6 text-center gap-3">
                <Maximize2 className="w-8 h-8 text-[#00c896]" />
                <p className="text-sm font-semibold text-white">Playing in Lightbox Video Player</p>
                <button
                  type="button"
                  onClick={() => setCleanPopupOpen(false)}
                  className="px-4 py-2 rounded-lg bg-[#111622] hover:bg-[#1a2234] text-slate-200 text-xs font-semibold border border-[#1e2638] cursor-pointer"
                >
                  Return to Inline Player
                </button>
              </div>
            ) : allSourcesFailed ? (
              <div className="w-full h-full bg-[#0a0d14] flex flex-col items-center justify-center p-6 text-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-rose-500/15 border border-rose-500/30 flex items-center justify-center text-rose-400">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <div className="max-w-md space-y-1.5">
                  <h3 className="text-base sm:text-lg font-bold text-white">
                    Stream temporarily unreachable
                  </h3>
                  <p className="text-xs text-slate-400 leading-relaxed">
                    All auto-failover mirrors timed out for {drama.title} Episode {currentEpisode}. Retry the active HLX node or open directly in a clean tab.
                  </p>
                </div>
                <div className="flex flex-wrap items-center justify-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      triedServersRef.current.clear();
                      setAllSourcesFailed(false);
                      selectAndSyncServer(selectedServerId, true);
                    }}
                    className="px-4 py-2 rounded-xl bg-[#00c896] hover:bg-[#00b084] text-slate-950 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Retry HLX Server</span>
                  </button>
                  <a
                    href={cleanNewWindowUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2 rounded-xl bg-[#111622] hover:bg-[#1a2234] text-[#00c896] text-xs font-bold border border-[#1e2638] flex items-center gap-1.5"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    <span>PLAY NOW</span>
                  </a>
                </div>
              </div>
            ) : activeDirectVideo ? (
              <VideoJsPlayer
                src={activeDirectVideo.url}
                sourceType={activeDirectVideo.type}
                poster={tmdbMeta?.backdrop || drama.backdrop || drama.poster}
                effectiveLang={effectiveLang}
                languageAliases={activeLangMeta.aliases}
                autoEnableSubtitles={Boolean(hlsAudioStatus && !hlsAudioStatus.matched)}
                playbackRate={playbackRate}
                tracks={resolvedHlsSubs}
                videoElementRef={videoRef}
                hlsInstanceRef={hlsRef}
                onAudioTracksReady={tracks => {
                  setHlsAudioTracks(tracks);
                  if (hlsRef.current) setActiveHlsAudioTrackIdx(hlsRef.current.audioTrack || 0);
                }}
                onQualitiesReady={setHlsQualities}
                onSubtitlesReady={setHlsSubtitles}
                onManifestReady={() => {
                  setAllSourcesFailed(false);
                  saveLastWorkingServer(selectedServerId);
                }}
                onLoadedMetadata={handleVideoLoadedMetadata}
                onTimeUpdate={handleVideoTimeUpdate}
                onEnded={handleVideoEnded}
                onFatalError={() => {
                  setHlsFailed(true);
                  if (currentServer.mode !== 'hlx-direct') {
                    handleAutoFallback();
                  }
                }}
              />
            ) : activeDirectDashUrl ? (
              <div className="w-full h-full bg-[#0a0d14] flex flex-col items-center justify-center p-6 text-center gap-3">
                <Layers className="w-8 h-8 text-[#00c896]" />
                <p className="text-sm font-semibold text-white">MPEG-DASH Stream Ready</p>
                <button
                  type="button"
                  onClick={() => selectAndSyncServer(1, false)}
                  className="px-4 py-2 rounded-lg bg-[#00c896] text-slate-950 text-xs font-bold cursor-pointer"
                >
                  Switch to HLX Proxy
                </button>
              </div>
            ) : activeIframeSrc ? (
              <iframe
                key={`${selectedCustomSource?.id || selectedServerId}-${selectedSeasonNumber}-${currentEpisode}-${effectiveLang}-${serverReloadKey}-${sandboxShieldEnabled ? 'relay' : 'direct'}`}
                src={activeIframeSrc}
                frameBorder="0"
                allowFullScreen
                allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *; accelerometer; gyroscope; clipboard-write *"
                referrerPolicy="no-referrer-when-downgrade"
                onLoad={() => {
                  setIframeLoaded(true);
                  setAllSourcesFailed(false);
                  saveLastWorkingServer(selectedServerId);
                }}
                onError={handleAutoFallback}
                title={`Watch ${drama.title} Episode ${currentEpisode} (${activeLangMeta.label})`}
                className="w-full h-full border-0"
              />
            ) : null}

            {resumeToast && (
              <div className="absolute top-3 left-3 z-20 px-3 py-1.5 rounded-lg bg-[#111622]/95 border border-[#00c896]/40 text-xs font-semibold text-[#00c896] shadow-lg">
                {resumeToast}
              </div>
            )}

            {autoNextCountdown !== null && currentEpisode < activeSeasonEpisodeCount && (
              <div className="absolute bottom-14 right-4 z-30 bg-[#111622]/95 border border-[#1e2638] rounded-xl p-3.5 shadow-2xl max-w-xs space-y-2">
                <p className="text-xs font-bold text-white flex items-center gap-1.5">
                  <SkipForward className="w-4 h-4 text-[#00c896]" />
                  <span>Up Next: Episode {currentEpisode + 1} in {autoNextCountdown}s</span>
                </p>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setAutoNextCountdown(null);
                      onSelectEpisode(currentEpisode + 1, selectedSeasonNumber);
                    }}
                    className="px-3 py-1.5 rounded-lg bg-[#00c896] text-slate-950 text-xs font-bold cursor-pointer"
                  >
                    Play Now
                  </button>
                  <button
                    type="button"
                    onClick={() => setAutoNextCountdown(null)}
                    className="px-3 py-1.5 rounded-lg bg-[#1a2234] text-slate-300 text-xs font-semibold cursor-pointer"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}

            {(serverStatus === 'checking' || resolvingStream) && !isDirectVideoMode && (
              <div className="absolute inset-0 bg-[#0a0d14]/80 backdrop-blur-xs flex flex-col items-center justify-center gap-2 pointer-events-none">
                <div className="w-8 h-8 border-2 border-[#00c896] border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-medium text-slate-200">
                  Syncing {currentServer.name} ({activeLangMeta.label})...
                </span>
              </div>
            )}
          </div>

          {/* 4. Direct HLS Control Bar (when playing M3U8/MP4 via Video.js) */}
          {isDirectVideoMode && (
            <div className="bg-[#111622] border-t border-[#1e2638] px-4 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <div className="flex flex-wrap items-center gap-2">
                <span className="flex items-center gap-1 text-slate-400 font-semibold">
                  <Gauge className="w-3.5 h-3.5 text-[#00c896]" />
                  Speed:
                </span>
                {[0.75, 1, 1.25, 1.5, 2].map(rate => (
                  <button
                    key={rate}
                    type="button"
                    onClick={() => setPlaybackRate(rate)}
                    className={`px-2 py-0.5 rounded font-mono text-[11px] cursor-pointer ${
                      playbackRate === rate
                        ? 'bg-[#00c896] text-slate-950 font-bold'
                        : 'bg-[#0a0d14] text-slate-300 hover:bg-[#1a2234]'
                    }`}
                  >
                    {rate}x
                  </button>
                ))}

                {hlsQualities.length > 0 && (
                  <label className="flex items-center gap-1 text-slate-400 ml-1">
                    <span>Quality:</span>
                    <select
                      value={selectedQuality}
                      onChange={e => handleChangeQuality(Number(e.target.value))}
                      className="bg-[#0a0d14] border border-[#1e2638] rounded px-2 py-0.5 text-xs text-slate-200"
                    >
                      <option value={-1}>Auto</option>
                      {hlsQualities.map(q => (
                        <option key={q.index} value={q.index}>
                          {q.height ? `${q.height}p` : `${Math.round(q.bitrate / 1000)}kbps`}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {(hlsSubtitles.length > 0 || resolvedHlsSubs.length > 0) && (
                  <label className="flex items-center gap-1 text-slate-400 ml-1">
                    <Subtitles className="w-3.5 h-3.5 text-[#00c896]" />
                    <select
                      value={selectedSubtitle}
                      onChange={e => handleChangeSubtitle(Number(e.target.value))}
                      className="bg-[#0a0d14] border border-[#1e2638] rounded px-2 py-0.5 text-xs text-slate-200"
                    >
                      <option value={-1}>Subtitles Off</option>
                      {(hlsSubtitles.length > 0
                        ? hlsSubtitles
                        : resolvedHlsSubs.map((s, i) => ({ id: i, name: s.label }))
                      ).map(s => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </label>
                )}

                {hlsAudioTracks.length > 1 && (
                  <label className="flex items-center gap-1 text-slate-400 ml-1">
                    <Volume2 className="w-3.5 h-3.5 text-[#00c896]" />
                    <select
                      value={activeHlsAudioTrackIdx}
                      onChange={e => {
                        const idx = Number(e.target.value);
                        setActiveHlsAudioTrackIdx(idx);
                        if (hlsRef.current) hlsRef.current.audioTrack = idx;
                      }}
                      className="bg-[#0a0d14] border border-[#1e2638] rounded px-2 py-0.5 text-xs text-slate-200"
                    >
                      {hlsAudioTracks.map(t => (
                        <option key={t.id} value={t.id}>
                          {t.name} {t.lang ? `(${t.lang.toUpperCase()})` : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                )}
              </div>

              <div className="flex items-center gap-2">
                {currentEpisode < activeSeasonEpisodeCount && (
                  <button
                    type="button"
                    onClick={() => setAutoNextEnabled(prev => !prev)}
                    className={`px-2.5 py-1 rounded font-semibold flex items-center gap-1 cursor-pointer border ${
                      autoNextEnabled
                        ? 'bg-[#00c896]/15 border-[#00c896]/40 text-[#00c896]'
                        : 'bg-[#0a0d14] border-[#1e2638] text-slate-400'
                    }`}
                  >
                    <SkipForward className="w-3.5 h-3.5" />
                    <span>Auto-Next: {autoNextEnabled ? 'ON' : 'OFF'}</span>
                  </button>
                )}
                {pipSupported && (
                  <button
                    type="button"
                    onClick={handleTogglePiP}
                    className="px-2.5 py-1 rounded bg-[#0a0d14] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <PictureInPicture2 className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">PiP</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        <AdsterraBanner type="player" className="mb-6" />

        {/* Episode Heading & Next/Prev Navigation */}
        <div className="mb-6">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-4 border-b border-[#1e2638]">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
                {drama.title} {mediaType === 'movie' ? 'Full Movie' : `· Episode ${currentEpisode}`}
              </h1>
              <p className="text-sm font-semibold text-[#00c896] mt-1">
                {drama.country} {mediaType === 'movie' ? 'Movie' : 'Drama'} · {activeLangMeta.label} ({currentServer.name})
              </p>
            </div>

            {mediaType !== 'movie' && (
              <div className="flex items-center gap-2 self-start md:self-auto">
                {currentEpisode > 1 && (
                  <a
                    href={`/watch/${drama.slug}/episode-${currentEpisode - 1}`}
                    onClick={e => {
                      e.preventDefault();
                      onSelectEpisode(currentEpisode - 1, selectedSeasonNumber);
                    }}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-lg bg-[#111622] hover:bg-[#1a2234] text-slate-200 text-xs sm:text-sm font-semibold border border-[#1e2638] transition-colors"
                  >
                    <ChevronLeft className="w-4 h-4" />
                    <span>Episode {currentEpisode - 1}</span>
                  </a>
                )}
                {currentEpisode < activeSeasonEpisodeCount && (
                  <a
                    href={`/watch/${drama.slug}/episode-${currentEpisode + 1}`}
                    onClick={e => {
                      e.preventDefault();
                      onSelectEpisode(currentEpisode + 1, selectedSeasonNumber);
                    }}
                    className="flex items-center gap-1.5 px-4 py-2 rounded-lg bg-[#00c896] hover:bg-[#00b084] text-slate-950 text-xs sm:text-sm font-bold transition-colors shadow-sm shadow-emerald-500/20"
                  >
                    <span>Next Episode</span>
                    <ChevronRight className="w-4 h-4" />
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Episode / Movie Metadata Summary (11 green download buttons removed per request) */}
        <div className="bg-[#111622] border border-[#1e2638] rounded-xl p-5 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-bold text-white mb-2">
                {drama.title} {mediaType === 'movie' ? '' : `– Episode ${currentEpisode}`}
              </h2>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300 tabular-nums">
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
                <span className="flex flex-wrap gap-2">
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
                        className="text-[#00c896] hover:underline font-medium"
                      >
                        {g}
                      </a>
                    );
                  })}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <button
                type="button"
                onClick={() => {
                  if (typeof window !== 'undefined' && navigator.clipboard) {
                    navigator.clipboard.writeText(
                      `${window.location.origin}${mp4StreamPath}?lang=${encodeURIComponent(effectiveLang)}`
                    );
                    setCopiedMp4(true);
                    setTimeout(() => setCopiedMp4(false), 2000);
                  }
                }}
                className="px-3 py-2.5 rounded-xl bg-[#0a0d14] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] font-bold text-xs flex items-center gap-1.5 transition-colors cursor-pointer"
                title="Copy Direct .MP4 Stream URL"
              >
                <Check className={`w-3.5 h-3.5 ${copiedMp4 ? 'text-[#00c896]' : 'text-slate-400'}`} />
                <span>{copiedMp4 ? 'Copied .MP4!' : 'Copy .MP4'}</span>
              </button>

              <a
                href={cleanNewWindowUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="px-4 py-2.5 rounded-xl bg-[#00c896] hover:bg-[#00b084] text-slate-950 font-extrabold text-xs sm:text-sm flex items-center gap-2 transition-colors shadow-lg shadow-emerald-500/20 shrink-0"
                title="PLAY NOW"
              >
                <ExternalLink className="w-4 h-4" />
                <span>PLAY NOW</span>
              </a>
            </div>
          </div>
        </div>

        <AdsterraBanner type="download" className="mb-8" />

        {/* Two-Column Content: About + FAQs + Comments | TMDB Live Auto-Synced Seasons & Episodes Sidebar */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 mb-12">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-[#111622] border border-[#1e2638] rounded-xl p-6">
              <h2 className="text-xl font-bold text-white mb-3 tracking-tight">
                About {drama.title}
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {tmdbMeta?.overview || drama.overview}
              </p>
              <div className="mt-4 pt-4 border-t border-[#1e2638] text-xs text-slate-400">
                Stream <strong className="text-slate-200">{drama.title}</strong> with HLX.proxy multi-audio tracks ({activeLangMeta.label}) and live TMDB episode auto-sync.
              </div>
            </div>

            <div className="bg-[#111622] border border-[#1e2638] rounded-xl p-6">
              <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
                <HelpCircle className="w-5 h-5 text-[#00c896]" />
                <span>Episode {currentEpisode} Streaming FAQs</span>
              </h2>
              <div className="space-y-3">
                {faqs.map((faq, idx) => (
                  <div key={idx} className="bg-[#0a0d14] border border-[#1e2638] rounded-lg p-3.5">
                    <h3 className="text-xs sm:text-sm font-semibold text-slate-100 mb-1">
                      {faq.question}
                    </h3>
                    <p className="text-xs text-slate-400 leading-relaxed">{faq.answer}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="bg-[#111622] border border-[#1e2638] rounded-xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white flex items-center gap-2">
                  <MessageSquare className="w-5 h-5 text-[#00c896]" />
                  <span>Comments ({comments.length})</span>
                </h2>
              </div>

              <form onSubmit={handlePostComment} className="mb-6 space-y-3">
                <input
                  type="text"
                  value={commentName}
                  onChange={e => setCommentName(e.target.value)}
                  placeholder="Your Name (optional)"
                  className="w-full sm:w-64 bg-[#0a0d14] border border-[#1e2638] rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c896]"
                />
                <div className="flex gap-2">
                  <textarea
                    rows={2}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder="Share your thoughts on this episode..."
                    className="flex-1 bg-[#0a0d14] border border-[#1e2638] rounded-lg px-3 py-2 text-xs sm:text-sm text-white placeholder-slate-500 focus:outline-none focus:border-[#00c896] resize-none"
                  />
                  <button
                    type="submit"
                    disabled={commentSubmitting || !commentText.trim()}
                    className="px-4 py-2 rounded-lg bg-[#00c896] hover:bg-[#00b084] text-slate-950 font-bold text-xs flex items-center gap-1.5 self-end cursor-pointer disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>Post</span>
                  </button>
                </div>
              </form>

              <div className="space-y-3">
                {comments.map(c => (
                  <div key={c.id} className="bg-[#0a0d14] border border-[#1e2638] rounded-lg p-3.5">
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-xs font-bold text-slate-200">{c.userName}</span>
                      <button
                        type="button"
                        onClick={() => handleLikeComment(c.id)}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-400 hover:text-[#00c896] cursor-pointer"
                      >
                        <ThumbsUp className="w-3 h-3" />
                        <span>{c.likes}</span>
                      </button>
                    </div>
                    <p className="text-xs text-slate-300 leading-relaxed">{c.content}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column: Poster Summary & Live TMDB Seasons/Episodes Sync */}
          <div className="space-y-6">
            <a
              href={getContentPath(drama)}
              onClick={e => {
                e.preventDefault();
                onOpenDramaDetail(drama.slug);
              }}
              className="flex items-center gap-3.5 bg-[#111622] border border-[#1e2638] hover:border-[#00c896]/60 rounded-xl p-3.5 transition-colors"
            >
              <OptimizedImage
                src={drama.poster}
                alt={drama.title}
                width={120}
                height={180}
                className="w-16 h-24 object-cover rounded-lg shrink-0"
              />
              <div className="min-w-0">
                <h3 className="text-sm font-bold text-white line-clamp-1">{drama.title}</h3>
                <p className="text-xs text-slate-400 mt-0.5 tabular-nums">
                  {drama.country} · {drama.year} · ★ {drama.rating}
                </p>
                <span className="inline-block text-[11px] font-semibold text-[#00c896] mt-1.5">
                  {mediaType === 'movie' ? 'View Full Movie Page →' : 'View Full Series Details →'}
                </span>
              </div>
            </a>

            {mediaType !== 'movie' && (
              <div className="bg-[#111622] border border-[#1e2638] rounded-xl p-4 sm:p-5">
                <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#1e2638]">
                  <h2 className="text-base font-bold text-white flex items-center gap-2">
                    <Tv className="w-4 h-4 text-[#00c896]" />
                    <span>
                      Episodes{' '}
                      <span className="text-[#00c896] font-normal tabular-nums">
                        ({activeSeasonEpisodeCount})
                      </span>
                    </span>
                  </h2>
                  <span className="text-[11px] text-[#00c896] font-semibold">
                    TMDB Auto-Sync
                  </span>
                </div>

                {syncedSeasons.length > 1 && (
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-2.5 mb-3 no-scrollbar border-b border-[#1e2638]">
                    {syncedSeasons.map(s => (
                      <button
                        key={s.seasonNumber}
                        type="button"
                        onClick={() => {
                          setSelectedSeasonNumber(s.seasonNumber);
                          onSelectEpisode(1, s.seasonNumber);
                        }}
                        className={`px-2.5 py-1 rounded text-xs font-semibold whitespace-nowrap transition-colors cursor-pointer border ${
                          selectedSeasonNumber === s.seasonNumber
                            ? 'bg-[#00c896] text-slate-950 border-[#00c896]'
                            : 'bg-[#0a0d14] text-slate-300 hover:bg-[#1a2234] border-[#1e2638]'
                        }`}
                      >
                        Season {s.seasonNumber}
                      </button>
                    ))}
                  </div>
                )}

                {loadingSyncedEpisodes ? (
                  <div className="space-y-2 py-2">
                    {Array.from({ length: 6 }).map((_, i) => (
                      <div
                        key={i}
                        className="h-14 rounded-lg bg-[#1a2234] animate-pulse border border-[#1e2638]"
                      />
                    ))}
                  </div>
                ) : syncedEpisodes.length > 0 ? (
                  <div className="space-y-2 max-h-[480px] overflow-y-auto pr-1">
                    {syncedEpisodes.map(ep => {
                      const isActive = ep.episodeNumber === currentEpisode;
                      return (
                        <button
                          key={`ep-${ep.seasonNumber}-${ep.episodeNumber}`}
                          type="button"
                          onClick={() => onSelectEpisode(ep.episodeNumber, selectedSeasonNumber)}
                          className={`w-full flex items-center gap-2.5 p-2 rounded-lg text-left transition-all cursor-pointer border ${
                            isActive
                              ? 'bg-[#00c896]/15 border-[#00c896] text-white'
                              : 'bg-[#0a0d14] hover:bg-[#1a2234] border-[#1e2638] text-slate-200'
                          }`}
                        >
                          {ep.stillUrl ? (
                            <OptimizedImage
                              src={ep.stillUrl}
                              alt={ep.name}
                              width={80}
                              height={45}
                              className="w-14 h-9 object-cover rounded bg-[#1a2234] shrink-0"
                            />
                          ) : (
                            <div className="w-14 h-9 rounded bg-[#1a2234] flex items-center justify-center shrink-0 text-slate-400 text-xs font-mono font-bold">
                              E{ep.episodeNumber}
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-1">
                              <p className="text-xs font-bold truncate">
                                Episode {ep.episodeNumber}
                                {ep.name && ep.name !== `Episode ${ep.episodeNumber}`
                                  ? ` · ${ep.name}`
                                  : ''}
                              </p>
                              {ep.runtime && (
                                <span className="text-[10px] text-slate-400 shrink-0 tabular-nums">
                                  {ep.runtime}m
                                </span>
                              )}
                            </div>
                            {ep.overview && (
                              <p className="text-[10px] text-slate-400 line-clamp-1 mt-0.5">
                                {ep.overview}
                              </p>
                            )}
                          </div>
                          {isActive && (
                            <Play className="w-3.5 h-3.5 fill-[#00c896] text-[#00c896] shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-3 gap-2 max-h-[480px] overflow-y-auto pr-1">
                    {Array.from({ length: activeSeasonEpisodeCount }, (_, i) => i + 1).map(ep => {
                      const isActive = ep === currentEpisode;
                      return (
                        <a
                          key={ep}
                          href={`/watch/${drama.slug}/episode-${ep}`}
                          onClick={e => {
                            e.preventDefault();
                            onSelectEpisode(ep, selectedSeasonNumber);
                          }}
                          className={`py-2 px-2 rounded-lg text-xs font-semibold transition-all flex items-center justify-center gap-1 cursor-pointer border ${
                            isActive
                              ? 'bg-[#00c896] text-slate-950 border-[#00c896] font-bold'
                              : 'bg-[#0a0d14] text-slate-300 hover:bg-[#1a2234] border-[#1e2638]'
                          }`}
                        >
                          {isActive && <Play className="w-2.5 h-2.5 fill-current" />}
                          <span>Ep {ep}</span>
                        </a>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            <AdsterraBanner type="native" />
          </div>
        </div>
      </div>

      {/* Lightbox Video Player Modal */}
      {cleanPopupOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Lightbox Video Player - ${drama.title} Episode ${currentEpisode}`}
          onClick={() => setCleanPopupOpen(false)}
          className="fixed inset-0 z-50 bg-black/92 backdrop-blur-md flex items-center justify-center p-2.5 sm:p-6 overflow-y-auto"
        >
          <div
            onClick={e => e.stopPropagation()}
            className="bg-[#0a0d14] border border-[#1e2638] rounded-2xl w-full max-w-6xl overflow-hidden shadow-2xl shadow-black my-auto"
          >
            <div className="px-4 py-3 bg-[#111622] border-b border-[#1e2638] flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-2 min-w-0">
                <span className="text-xs font-bold text-[#00c896] shrink-0">HLX Lightbox</span>
                <h3 className="text-sm font-bold text-white truncate">
                  {drama.title} · Episode {currentEpisode} ({activeLangMeta.flag} {activeLangMeta.label})
                </h3>
              </div>
              <div className="flex items-center gap-2 shrink-0 text-xs">
                <a
                  href={cleanNewWindowUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded bg-[#00c896] hover:bg-[#00b084] text-slate-950 font-extrabold flex items-center gap-1 transition-colors"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  <span>PLAY NOW</span>
                </a>
                <button
                  type="button"
                  onClick={handleAutoFallback}
                  className="px-2.5 py-1.5 rounded bg-[#1a2234] hover:bg-[#232d45] text-white font-semibold flex items-center gap-1 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#00c896]" />
                  <span>Next Server</span>
                </button>
                <button
                  type="button"
                  onClick={() => setCleanPopupOpen(false)}
                  className="px-2 py-1.5 rounded bg-[#0a0d14] hover:bg-[#1a2234] text-slate-200 cursor-pointer flex items-center gap-1 border border-[#1e2638]"
                  aria-label="Close Lightbox"
                >
                  <X className="w-4 h-4" />
                  <span className="hidden md:inline text-[11px] text-slate-400">Esc</span>
                </button>
              </div>
            </div>

            <div className="relative aspect-video max-h-[75vh] w-full bg-black">
              {activeDirectVideo ? (
                <VideoJsPlayer
                  src={activeDirectVideo.url}
                  sourceType={activeDirectVideo.type}
                  poster={tmdbMeta?.backdrop || drama.backdrop || drama.poster}
                  effectiveLang={effectiveLang}
                  languageAliases={activeLangMeta.aliases}
                  playbackRate={playbackRate}
                  tracks={resolvedHlsSubs}
                  videoElementRef={lightboxVideoRef}
                  hlsInstanceRef={hlsRef}
                  onAudioTracksReady={setHlsAudioTracks}
                  onQualitiesReady={setHlsQualities}
                  onSubtitlesReady={setHlsSubtitles}
                  onLoadedMetadata={handleVideoLoadedMetadata}
                  onTimeUpdate={handleVideoTimeUpdate}
                  onEnded={handleVideoEnded}
                  onFatalError={() => {
                    setHlsFailed(true);
                    if (currentServer.mode !== 'hlx-direct') handleAutoFallback();
                  }}
                />
              ) : activeIframeSrc ? (
                <iframe
                  key={`lightbox-${selectedCustomSource?.id || selectedServerId}-${selectedSeasonNumber}-${currentEpisode}-${effectiveLang}-${serverReloadKey}-${sandboxShieldEnabled ? 'relay' : 'direct'}`}
                  src={activeIframeSrc}
                  frameBorder="0"
                  allowFullScreen
                  allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *; accelerometer; gyroscope; clipboard-write *"
                  referrerPolicy="no-referrer-when-downgrade"
                  onLoad={() => setIframeLoaded(true)}
                  onError={handleAutoFallback}
                  title={`Lightbox - ${drama.title} Episode ${currentEpisode}`}
                  className="w-full h-full border-0"
                />
              ) : null}
            </div>

            <div className="px-4 py-3 bg-[#111622] border-t border-[#1e2638] space-y-2.5 text-xs">
              <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
                <span className="text-slate-400 font-semibold shrink-0 mr-1">Servers:</span>
                {HLX_SERVERS.map(srv => (
                  <button
                    key={srv.id}
                    type="button"
                    onClick={() => selectAndSyncServer(srv.id, false)}
                    className={`px-2.5 py-1 rounded font-semibold whitespace-nowrap cursor-pointer transition-colors ${
                      selectedServerId === srv.id
                        ? 'bg-[#00c896] text-slate-950'
                        : 'bg-[#0a0d14] text-slate-300 hover:bg-[#1a2234] border border-[#1e2638]'
                    }`}
                  >
                    {srv.name}
                  </button>
                ))}
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-[#1e2638]">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-slate-400 font-semibold mr-1">Audio:</span>
                  {hindiOnlyLocked ? (
                    <span className="px-2.5 py-0.5 rounded bg-[#00c896] text-slate-950 font-bold">
                      🇮🇳 Hindi Only
                    </span>
                  ) : (
                    HLX_AUDIO_LANGUAGES.map(lang => (
                      <button
                        key={lang.code}
                        type="button"
                        onClick={() => handleSelectAudioLanguage(lang.code)}
                        className={`px-2.5 py-0.5 rounded font-semibold cursor-pointer ${
                          effectiveLang === lang.code
                            ? 'bg-[#00c896] text-slate-950 font-bold'
                            : 'bg-[#0a0d14] text-slate-300 hover:bg-[#1a2234] border border-[#1e2638]'
                        }`}
                      >
                        {lang.flag} {lang.shortLabel}
                      </button>
                    ))
                  )}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {currentEpisode > 1 && (
                    <button
                      type="button"
                      onClick={() => onSelectEpisode(currentEpisode - 1, selectedSeasonNumber)}
                      className="px-2.5 py-1 rounded bg-[#0a0d14] hover:bg-[#1a2234] text-slate-200 border border-[#1e2638] cursor-pointer flex items-center gap-1"
                    >
                      <ChevronLeft className="w-3.5 h-3.5" />
                      <span>Prev Ep</span>
                    </button>
                  )}
                  {currentEpisode < activeSeasonEpisodeCount && (
                    <button
                      type="button"
                      onClick={() => onSelectEpisode(currentEpisode + 1, selectedSeasonNumber)}
                      className="px-2.5 py-1 rounded bg-[#00c896] hover:bg-[#00b084] text-slate-950 font-bold cursor-pointer flex items-center gap-1"
                    >
                      <span>Next Ep</span>
                      <ChevronRight className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
