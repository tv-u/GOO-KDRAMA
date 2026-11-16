import React, { useState, useEffect, useRef, useMemo } from 'react';
import type Hls from 'hls.js';
import { ExternalLink, RefreshCw, Shield, Tv, Volume2, Check, Sparkles } from 'lucide-react';
import type { AudioLanguageCode } from '../types/drama.ts';
import {
  HLX_SERVERS,
  HLX_AUDIO_LANGUAGES,
  buildHlxDirectUrl,
  buildHlxSyncedIframeSrc,
  getAudioLanguageMeta,
} from '../services/hlxPlayerEngine.ts';
import { VideoJsPlayer } from './VideoJsPlayer.tsx';
import { getMp4StreamPath, slugifyText } from '../services/seo.ts';
import { triggerSmartlinkWithCooldown } from '../services/adsterra.ts';

export type HlxLanguage = AudioLanguageCode;

export interface DynamicMoviePlayerProps {
  tmdbId: number | string;
  slug?: string;
  title?: string;
  poster?: string;
  mediaType?: 'movie' | 'tv';
  season?: number;
  episode?: number;
  initialLang?: HlxLanguage;
  className?: string;
  onOpenNewWindow?: (url: string) => void;
}

export const DynamicMoviePlayer: React.FC<DynamicMoviePlayerProps> = ({
  tmdbId,
  slug,
  title = 'Featured Title',
  poster,
  mediaType = 'movie',
  season = 1,
  episode = 1,
  initialLang = 'ko',
  className = '',
  onOpenNewWindow,
}) => {
  const [selectedLang, setSelectedLang] = useState<AudioLanguageCode>(initialLang);
  const [selectedServerId, setSelectedServerId] = useState<number>(HLX_SERVERS[0].id);
  const [relayShield, setRelayShield] = useState<boolean>(true);
  const [reloadKey, setReloadKey] = useState<number>(0);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [copied, setCopied] = useState<boolean>(false);
  const [isStaticHost, setIsStaticHost] = useState<boolean>(false);

  // Direct HLS + real multi-audio resolution states
  const [resolvedHlsUrl, setResolvedHlsUrl] = useState<string>('');
  const [resolvedHlsSubs, setResolvedHlsSubs] = useState<{ label: string; lang: string; url: string }[]>([]);
  const [dubbedEmbedUrl, setDubbedEmbedUrl] = useState<string | null>(null);
  const [preferOriginalStream, setPreferOriginalStream] = useState<boolean>(false);
  const [audioStatus, setAudioStatus] = useState<{
    matched: boolean;
    actualLabel: string;
    viaDubbedSource?: boolean;
  } | null>(null);
  const [hlsFailed, setHlsFailed] = useState<boolean>(false);

  const iframeRef = useRef<HTMLIFrameElement>(null);
  const hlsRef = useRef<Hls | null>(null);
  const triedServersRef = useRef<Set<number>>(new Set());

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setIsStaticHost(window.location.hostname.endsWith('.github.io'));
    }
    triedServersRef.current.clear();
  }, [tmdbId, mediaType]);

  const activeServer = useMemo(
    () => HLX_SERVERS.find(s => s.id === selectedServerId) || HLX_SERVERS[0],
    [selectedServerId]
  );
  const activeLangMeta = useMemo(() => getAudioLanguageMeta(selectedLang), [selectedLang]);

  // Resolve real HLS stream & genuine multi-audio tracks when HLS.proxy is selected
  useEffect(() => {
    let active = true;
    setResolvedHlsUrl('');
    setResolvedHlsSubs([]);
    setDubbedEmbedUrl(null);
    setAudioStatus(null);
    setHlsFailed(false);

    if (activeServer.mode !== 'hlx-direct' || isStaticHost) {
      return;
    }

    setIsLoading(true);
    fetch('/api/hls-resolve', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        tmdbId,
        type: mediaType,
        season,
        episode,
        lang: selectedLang,
        title,
      }),
    })
      .then(res => (res.ok ? res.json() : null))
      .then(data => {
        if (!active) return;
        if (data?.ok && data?.streamUrl) {
          if (data.dubbedEmbedUrl && !data.matchedRequestedAudio && !preferOriginalStream) {
            setDubbedEmbedUrl(data.dubbedEmbedUrl);
            setAudioStatus({
              matched: true,
              actualLabel: `${activeLangMeta.label} (Verified Dub)`,
              viaDubbedSource: true,
            });
            setIsLoading(false);
            return;
          }
          setResolvedHlsUrl(data.streamUrl);
          setResolvedHlsSubs(Array.isArray(data.subs) ? data.subs : []);
          if (data.dubbedEmbedUrl) setDubbedEmbedUrl(data.dubbedEmbedUrl);
          setAudioStatus({
            matched: Boolean(data.matchedRequestedAudio),
            actualLabel: data.actualAudioLabel || activeLangMeta.label,
          });
          setIsLoading(false);
          return;
        }
        setHlsFailed(true);
      })
      .catch(() => {
        if (active) setHlsFailed(true);
      });

    return () => {
      active = false;
    };
  }, [
    activeServer.mode,
    tmdbId,
    mediaType,
    season,
    episode,
    selectedLang,
    title,
    reloadKey,
    isStaticHost,
    preferOriginalStream,
    activeLangMeta.label,
  ]);

  const directUrl = useMemo(
    () =>
      dubbedEmbedUrl && !preferOriginalStream
        ? dubbedEmbedUrl
        : buildHlxDirectUrl(activeServer, {
            tmdbId,
            season,
            episode,
            lang: selectedLang,
            mediaType,
            title,
          }),
    [dubbedEmbedUrl, preferOriginalStream, activeServer, tmdbId, season, episode, selectedLang, mediaType, title]
  );

  const iframeSrc = useMemo(() => {
    if (dubbedEmbedUrl && !preferOriginalStream) return dubbedEmbedUrl;
    return buildHlxSyncedIframeSrc(directUrl, activeServer, relayShield, isStaticHost);
  }, [dubbedEmbedUrl, preferOriginalStream, directUrl, activeServer, relayShield, isStaticHost]);

  const useDirectHlsPlayer = Boolean(
    activeServer.mode === 'hlx-direct' &&
      resolvedHlsUrl &&
      !hlsFailed &&
      !(dubbedEmbedUrl && !preferOriginalStream)
  );

  const cleanNewWindowUrl = useMemo(() => {
    if (slug) {
      const base = mediaType === 'movie' ? `/watch/${slug}` : `/watch/${slug}/episode-${episode}`;
      const params = new URLSearchParams({
        window: '1',
        server: String(selectedServerId),
        lang: selectedLang,
      });
      if (mediaType === 'tv' && season > 1) params.set('season', String(season));
      return `${base}?${params.toString()}`;
    }
    return directUrl;
  }, [slug, mediaType, episode, season, selectedServerId, selectedLang, directUrl]);

  const mp4StreamPath = useMemo(
    () => getMp4StreamPath({ slug: slug || slugifyText(title), type: mediaType }, episode, season),
    [slug, title, mediaType, episode, season]
  );

  const advanceNextServer = useMemo(
    () => () => {
      triedServersRef.current.add(selectedServerId);
      const next = HLX_SERVERS.find(
        s => !triedServersRef.current.has(s.id) && s.id !== selectedServerId
      );
      if (next) {
        setIsLoading(true);
        setSelectedServerId(next.id);
        setReloadKey(prev => prev + 1);
      } else if (relayShield && !isStaticHost) {
        triedServersRef.current.clear();
        setRelayShield(false);
        setIsLoading(true);
        setSelectedServerId(HLX_SERVERS[0].id);
        setReloadKey(prev => prev + 1);
      } else {
        setIsLoading(false);
      }
    },
    [selectedServerId, relayShield, isStaticHost]
  );

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const onMessage = (ev: MessageEvent) => {
      if (ev?.data?.type === 'HLX_RELAY_ERROR') {
        advanceNextServer();
      }
    };
    window.addEventListener('message', onMessage);
    return () => window.removeEventListener('message', onMessage);
  }, [advanceNextServer]);

  useEffect(() => {
    if (!isLoading || useDirectHlsPlayer) return;
    const timer = setTimeout(() => {
      advanceNextServer();
    }, 9000);
    return () => clearTimeout(timer);
  }, [isLoading, useDirectHlsPlayer, advanceNextServer]);

  const handleLanguageChange = (lang: AudioLanguageCode) => {
    triedServersRef.current.clear();
    setPreferOriginalStream(false);
    setSelectedLang(lang);

    if (useDirectHlsPlayer && hlsRef.current) {
      const targetMeta = getAudioLanguageMeta(lang);
      const tracks = hlsRef.current.audioTracks || [];
      const matchIndex = tracks.findIndex(t => {
        const tLang = (t.lang || '').toLowerCase();
        const tName = (t.name || '').toLowerCase();
        return targetMeta.aliases.some(a => tLang.includes(a) || tName.includes(a));
      });
      if (matchIndex !== -1) {
        hlsRef.current.audioTrack = matchIndex;
        setAudioStatus({ matched: true, actualLabel: targetMeta.label });
        return;
      }
    }

    setIsLoading(true);
    setReloadKey(prev => prev + 1);
  };

  const handleLanguageChangeWithAds = (lang: AudioLanguageCode) => {
    triggerSmartlinkWithCooldown(45000);
    handleLanguageChange(lang);
  };

  const handleServerChange = (serverId: number) => {
    triggerSmartlinkWithCooldown(45000);
    setPreferOriginalStream(false);
    setIsLoading(true);
    setSelectedServerId(serverId);
    setReloadKey(prev => prev + 1);
  };

  const handleManualReload = () => {
    setIsLoading(true);
    setReloadKey(prev => prev + 1);
  };

  const handleCopyLink = () => {
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined') {
      const fullMp4 = `${window.location.origin}${mp4StreamPath}?lang=${encodeURIComponent(selectedLang)}`;
      navigator.clipboard.writeText(fullMp4);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  return (
    <div
      className={`w-full bg-[#0a0d14] rounded-2xl border border-[#1e2638] overflow-hidden shadow-2xl flex flex-col ${className}`}
    >
      {/* Top Bar: Title + PLAY NOW (New Clean Window) */}
      <div className="bg-[#111622] border-b border-[#1e2638] px-3 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-bold text-white truncate max-w-[200px] sm:max-w-md">
              {title}
            </span>
            <span className="text-[11px] font-bold text-[#00c896]">
              {activeServer.name} · {activeServer.qualityTag}
            </span>
          </div>
          <p className="text-[11px] text-slate-400 truncate mt-0.5 tabular-nums">
            {audioStatus
              ? audioStatus.matched
                ? `✓ Playing Real ${audioStatus.actualLabel} Audio`
                : `Source Audio: ${audioStatus.actualLabel} · ${activeLangMeta.shortLabel} Subtitles Enabled`
              : `${activeServer.name} · ${activeLangMeta.flag} ${activeLangMeta.label}`}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isStaticHost && activeServer.supportsRelay && !useDirectHlsPlayer && (
            <button
              type="button"
              onClick={() => {
                setIsLoading(true);
                setRelayShield(prev => !prev);
                setReloadKey(prev => prev + 1);
              }}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 cursor-pointer border transition-colors ${
                relayShield
                  ? 'bg-[#00c896]/15 text-[#00c896] border-[#00c896]/40'
                  : 'bg-[#0a0d14] text-slate-400 border-[#1e2638]'
              }`}
              title="HLS.proxy Sandbox Shield"
            >
              <Shield className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">{relayShield ? 'Shield ON' : 'Direct'}</span>
            </button>
          )}

          <button
            onClick={handleManualReload}
            type="button"
            className="p-1.5 text-slate-300 hover:text-white rounded-lg bg-[#0a0d14] border border-[#1e2638] hover:bg-[#1a2234] transition-colors cursor-pointer"
            title="Reload Stream"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin text-[#00c896]' : ''}`} />
          </button>

          <button
            onClick={handleCopyLink}
            type="button"
            className="px-2.5 py-1.5 text-[11px] font-semibold text-slate-300 hover:text-white rounded-lg bg-[#0a0d14] border border-[#1e2638] hover:bg-[#1a2234] transition-colors cursor-pointer hidden md:flex items-center gap-1"
            title="Copy Direct .MP4 Stream URL"
          >
            {copied ? 'Copied .MP4!' : 'Copy .MP4'}
          </button>

          <a
            href={cleanNewWindowUrl}
            target="_blank"
            rel="noopener noreferrer"
            onClick={e => {
              if (onOpenNewWindow) {
                e.preventDefault();
                onOpenNewWindow(cleanNewWindowUrl);
              }
            }}
            className="px-3.5 py-1.5 rounded-lg bg-[#00c896] hover:bg-[#00b084] text-slate-950 font-extrabold text-xs flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap shrink-0 shadow-md shadow-emerald-500/20"
            title="PLAY NOW"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            <span>PLAY NOW</span>
          </a>
        </div>
      </div>

      {/* Dual Bar: All 9 Servers + Real Multi-Audio Selector */}
      <div className="bg-[#0e131e] border-b border-[#1e2638] px-3 sm:px-5 py-2.5 space-y-2">
        <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar">
          <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0 mr-1">
            <Tv className="w-3.5 h-3.5 text-[#00c896]" />
            <span>Servers:</span>
          </span>
          {HLX_SERVERS.map(srv => {
            const active = selectedServerId === srv.id;
            return (
              <button
                key={srv.id}
                type="button"
                onClick={() => handleServerChange(srv.id)}
                className={`px-2.5 py-1 rounded-md text-xs font-semibold whitespace-nowrap shrink-0 cursor-pointer border transition-colors flex items-center gap-1.5 ${
                  active
                    ? 'bg-[#00c896] text-slate-950 border-[#00c896] font-bold'
                    : 'bg-[#111622] hover:bg-[#1a2234] text-slate-300 border-[#1e2638]'
                }`}
              >
                <span>{srv.name}</span>
                <span
                  className={`text-[10px] px-1 rounded font-mono ${
                    active ? 'bg-black/20 text-slate-950' : 'bg-[#1e2638] text-[#00c896]'
                  }`}
                >
                  {srv.qualityTag}
                </span>
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1.5 border-t border-[#1e2638]/70">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-xs font-bold text-slate-300 flex items-center gap-1 shrink-0 mr-1">
              <Volume2 className="w-3.5 h-3.5 text-[#00c896]" />
              <span>Audio Track:</span>
            </span>
            {HLX_AUDIO_LANGUAGES.map(lang => {
              const isActive = selectedLang === lang.code;
              return (
                <button
                  key={lang.code}
                  onClick={() => handleLanguageChangeWithAds(lang.code)}
                  type="button"
                  className={`px-2.5 py-1 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 cursor-pointer border whitespace-nowrap shrink-0 ${
                    isActive
                      ? 'bg-[#00c896] text-slate-950 border-[#00c896] font-bold'
                      : 'bg-[#111622] hover:bg-[#1a2234] text-slate-300 border-[#1e2638]'
                  }`}
                >
                  <span>{lang.flag}</span>
                  <span>{lang.shortLabel}</span>
                  {isActive && <Check className="w-3 h-3" />}
                </button>
              );
            })}
          </div>

          {dubbedEmbedUrl && (
            <button
              type="button"
              onClick={() => {
                setPreferOriginalStream(prev => !prev);
                setReloadKey(prev => prev + 1);
              }}
              className="text-[11px] font-semibold px-2.5 py-1 rounded bg-[#111622] hover:bg-[#1a2234] text-[#00c896] border border-[#00c896]/40 flex items-center gap-1 cursor-pointer"
            >
              <Sparkles className="w-3 h-3" />
              <span>
                {preferOriginalStream
                  ? `Switch to ${activeLangMeta.shortLabel} Dub`
                  : 'Switch to HD Original + Subs'}
              </span>
            </button>
          )}
        </div>
      </div>

      {/* Video Player Viewport */}
      <div className="relative aspect-video w-full bg-black flex items-center justify-center overflow-hidden">
        {useDirectHlsPlayer ? (
          <VideoJsPlayer
            src={resolvedHlsUrl}
            sourceType="hls"
            poster={poster}
            effectiveLang={selectedLang}
            languageAliases={activeLangMeta.aliases}
            autoEnableSubtitles={Boolean(audioStatus && !audioStatus.matched)}
            playbackRate={1}
            tracks={resolvedHlsSubs}
            hlsInstanceRef={hlsRef}
            onManifestReady={() => setIsLoading(false)}
            onFatalError={() => {
              setHlsFailed(true);
              setIsLoading(true);
            }}
          />
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 z-20 bg-[#0a0d14]/85 backdrop-blur-xs flex flex-col items-center justify-center gap-3">
                <div className="w-10 h-10 border-3 border-[#00c896] border-t-transparent rounded-full animate-spin" />
                <div className="text-center px-4">
                  <p className="text-xs sm:text-sm font-bold text-white">
                    Loading {activeServer.name} · {activeLangMeta.label}...
                  </p>
                </div>
              </div>
            )}

            <iframe
              ref={iframeRef}
              key={`hlx-movie-${tmdbId}-${mediaType}-${selectedServerId}-${selectedLang}-${relayShield ? 'relay' : 'direct'}-${dubbedEmbedUrl && !preferOriginalStream ? 'dub' : 'std'}-${reloadKey}`}
              src={iframeSrc}
              className="w-full h-full border-0"
              allow="autoplay *; fullscreen *; picture-in-picture *; encrypted-media *; accelerometer; gyroscope; clipboard-write *"
              allowFullScreen
              referrerPolicy="no-referrer-when-downgrade"
              onLoad={() => setIsLoading(false)}
              title={`${title} - ${activeServer.name} (${activeLangMeta.label})`}
            />
          </>
        )}
      </div>
    </div>
  );
};
