import React, { useEffect, useRef } from 'react';
import type Hls from 'hls.js';
import type Player from 'video.js/dist/types/player';
import type { AudioLanguageCode } from '../types/drama.ts';

export interface VideoJsSubtitleTrack {
  label: string;
  lang: string;
  url: string;
}

export interface VideoJsAudioTrack {
  id: number;
  name: string;
  lang?: string;
}

export interface VideoJsQualityLevel {
  index: number;
  height: number;
  bitrate: number;
}

interface VideoJsPlayerProps {
  src: string;
  sourceType: 'hls' | 'mp4' | 'webm' | 'ogg';
  poster?: string;
  effectiveLang: AudioLanguageCode;
  languageAliases: string[];
  autoEnableSubtitles?: boolean;
  playbackRate: number;
  tracks?: VideoJsSubtitleTrack[];
  videoElementRef?: React.MutableRefObject<HTMLVideoElement | null>;
  hlsInstanceRef?: React.MutableRefObject<Hls | null>;
  onAudioTracksReady?: (tracks: VideoJsAudioTrack[]) => void;
  onQualitiesReady?: (levels: VideoJsQualityLevel[]) => void;
  onSubtitlesReady?: (subs: { id: number; name: string; lang?: string }[]) => void;
  onManifestReady?: () => void;
  onLoadedMetadata?: (video: HTMLVideoElement) => void;
  onTimeUpdate?: (video: HTMLVideoElement) => void;
  onEnded?: () => void;
  onFatalError?: (reason: string) => void;
}

function getMimeType(sourceType: 'hls' | 'mp4' | 'webm' | 'ogg'): string {
  if (sourceType === 'hls') return 'application/x-mpegURL';
  if (sourceType === 'webm') return 'video/webm';
  if (sourceType === 'ogg') return 'video/ogg';
  return 'video/mp4';
}

export const VideoJsPlayer: React.FC<VideoJsPlayerProps> = ({
  src,
  sourceType,
  poster,
  effectiveLang,
  languageAliases,
  autoEnableSubtitles = false,
  playbackRate,
  tracks = [],
  videoElementRef,
  hlsInstanceRef,
  onAudioTracksReady,
  onQualitiesReady,
  onSubtitlesReady,
  onManifestReady,
  onLoadedMetadata,
  onTimeUpdate,
  onEnded,
  onFatalError,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const playerRef = useRef<Player | null>(null);
  const localHlsRef = useRef<Hls | null>(null);

  // Sync playback rate changes dynamically
  useEffect(() => {
    const p = playerRef.current;
    if (p && !p.isDisposed()) {
      p.playbackRate(playbackRate);
    }
  }, [playbackRate]);

  // Dynamically switch HLS audio & subtitle tracks when effectiveLang changes without tearing down player
  useEffect(() => {
    const hlsInstance = localHlsRef.current;
    if (!hlsInstance) return;
    const audioTracks = hlsInstance.audioTracks || [];
    if (audioTracks.length > 0) {
      const idx = audioTracks.findIndex(t => {
        const trackLang = (t.lang || '').toLowerCase();
        const trackName = (t.name || '').toLowerCase();
        return languageAliases.some(a => trackLang.includes(a) || trackName.includes(a));
      });
      if (idx !== -1) hlsInstance.audioTrack = idx;
    }
    if (autoEnableSubtitles && (hlsInstance.subtitleTracks || []).length > 0) {
      const subTracks = hlsInstance.subtitleTracks;
      const subMatch = subTracks.findIndex(s => {
        const sLang = (s.lang || '').toLowerCase();
        const sName = (s.name || '').toLowerCase();
        return languageAliases.some(a => sLang.includes(a) || sName.includes(a));
      });
      const enSub = subTracks.findIndex(s => (s.lang || '').toLowerCase().includes('en'));
      if (subMatch !== -1) hlsInstance.subtitleTrack = subMatch;
      else if (enSub !== -1) hlsInstance.subtitleTrack = enSub;
    }
  }, [effectiveLang, languageAliases, autoEnableSubtitles]);

  useEffect(() => {
    const hostEl = containerRef.current;
    if (!hostEl || !src) return;

    let cancelled = false;
    hostEl.innerHTML = '';

    const videoEl = document.createElement('video');
    videoEl.className = 'video-js vjs-big-play-centered vjs-fluid w-full h-full';
    videoEl.setAttribute('playsinline', '');
    videoEl.setAttribute('crossorigin', 'anonymous');
    if (poster) videoEl.poster = poster;

    const matchingSubIdx = tracks.findIndex(sub => {
      const sLang = (sub.lang || '').toLowerCase();
      const sLbl = (sub.label || '').toLowerCase();
      return languageAliases.some(a => sLang.includes(a) || sLbl.includes(a));
    });
    const fallbackEnSubIdx = tracks.findIndex(
      sub => (sub.lang || '').toLowerCase().includes('en') || (sub.label || '').toLowerCase().includes('english')
    );

    tracks.forEach((sub, idx) => {
      const trackEl = document.createElement('track');
      trackEl.kind = 'subtitles';
      trackEl.label = sub.label;
      trackEl.srclang = sub.lang || 'en';
      trackEl.src = sub.url;
      if (autoEnableSubtitles && idx === (matchingSubIdx !== -1 ? matchingSubIdx : fallbackEnSubIdx !== -1 ? fallbackEnSubIdx : 0)) {
        trackEl.default = true;
      }
      videoEl.appendChild(trackEl);
    });

    hostEl.appendChild(videoEl);
    if (videoElementRef) videoElementRef.current = videoEl;

    const selectTrackByLang = (hlsInstance: Hls) => {
      const audioTracks = hlsInstance.audioTracks || [];
      if (audioTracks.length > 0) {
        const idx = audioTracks.findIndex(t => {
          const trackLang = (t.lang || '').toLowerCase();
          const trackName = (t.name || '').toLowerCase();
          return languageAliases.some(a => trackLang.includes(a) || trackName.includes(a));
        });
        if (idx !== -1) {
          hlsInstance.audioTrack = idx;
        }
      }
      if (autoEnableSubtitles && (hlsInstance.subtitleTracks || []).length > 0) {
        const subTracks = hlsInstance.subtitleTracks;
        const subMatch = subTracks.findIndex(s => {
          const sLang = (s.lang || '').toLowerCase();
          const sName = (s.name || '').toLowerCase();
          return languageAliases.some(a => sLang.includes(a) || sName.includes(a));
        });
        const enSub = subTracks.findIndex(s => (s.lang || '').toLowerCase().includes('en'));
        if (subMatch !== -1) hlsInstance.subtitleTrack = subMatch;
        else if (enSub !== -1) hlsInstance.subtitleTrack = enSub;
      }
    };

    const handleLoaded = () => onLoadedMetadata?.(videoEl);
    const handleTime = () => onTimeUpdate?.(videoEl);
    const handleEnd = () => onEnded?.();
    const handleNativeErr = () => {
      if (sourceType !== 'hls') {
        onFatalError?.(`${sourceType.toUpperCase()} playback failed or stream unavailable`);
      }
    };

    videoEl.addEventListener('loadedmetadata', handleLoaded);
    videoEl.addEventListener('timeupdate', handleTime);
    videoEl.addEventListener('ended', handleEnd);
    videoEl.addEventListener('error', handleNativeErr);

    import('video.js')
      .then(async ({ default: videojs }) => {
        if (cancelled) return;

        const player = videojs(videoEl, {
          controls: true,
          autoplay: true,
          preload: 'auto',
          fluid: true,
          responsive: true,
          playbackRates: [0.5, 0.75, 1, 1.25, 1.5, 2],
          poster,
          html5: {
            vhs: { overrideNative: false },
          },
        });
        playerRef.current = player;
        player.playbackRate(playbackRate);

        if (sourceType === 'hls') {
          try {
            const { default: HlsEngine } = await import('hls.js');
            if (cancelled) return;
            if (HlsEngine.isSupported()) {
              const hls = new HlsEngine({
                enableWorker: true,
                lowLatencyMode: false,
                startLevel: -1,
                capLevelToPlayerSize: true,
                maxBufferLength: 12,
                maxMaxBufferLength: 30,
                backBufferLength: 30,
                manifestLoadingTimeOut: 6000,
                fragLoadingMaxRetry: 4,
              });
              localHlsRef.current = hls;
              if (hlsInstanceRef) hlsInstanceRef.current = hls;
              hls.loadSource(src);
              hls.attachMedia(videoEl);

              hls.on(HlsEngine.Events.MANIFEST_PARSED, () => {
                onAudioTracksReady?.(
                  (hls.audioTracks || []).map((t, i) => ({
                    id: i,
                    name: t.name || t.lang || `Audio ${i + 1}`,
                    lang: t.lang,
                  }))
                );
                onQualitiesReady?.(
                  (hls.levels || []).map((lvl, idx) => ({
                    index: idx,
                    height: lvl.height || Math.round((lvl.bitrate || 0) / 1000),
                    bitrate: lvl.bitrate || 0,
                  }))
                );
                onSubtitlesReady?.(
                  (hls.subtitleTracks || []).map((s, i) => ({
                    id: i,
                    name: s.name || s.lang || `Subtitle ${i + 1}`,
                    lang: s.lang,
                  }))
                );
                selectTrackByLang(hls);
                onManifestReady?.();
                videoEl.play().catch(() => {});
              });

              hls.on(HlsEngine.Events.AUDIO_TRACKS_UPDATED, (_evt, data) => {
                onAudioTracksReady?.(
                  (data.audioTracks || []).map((t, i) => ({
                    id: i,
                    name: t.name || t.lang || `Audio ${i + 1}`,
                    lang: t.lang,
                  }))
                );
                selectTrackByLang(hls);
              });

              hls.on(HlsEngine.Events.SUBTITLE_TRACKS_UPDATED, (_evt, data) => {
                onSubtitlesReady?.(
                  (data.subtitleTracks || []).map((s, i) => ({
                    id: i,
                    name: s.name || s.lang || `Subtitle ${i + 1}`,
                    lang: s.lang,
                  }))
                );
              });

              hls.on(HlsEngine.Events.ERROR, (_evt, data) => {
                if (data.fatal) {
                  if (data.type === HlsEngine.ErrorTypes.NETWORK_ERROR) {
                    hls.startLoad();
                  } else if (data.type === HlsEngine.ErrorTypes.MEDIA_ERROR) {
                    hls.recoverMediaError();
                  } else {
                    hls.destroy();
                    onFatalError?.(`HLS fatal error: ${data.details || 'stream failed'}`);
                  }
                }
              });
            } else if (videoEl.canPlayType('application/vnd.apple.mpegurl')) {
              player.src({ src, type: 'application/x-mpegURL' });
              onManifestReady?.();
              videoEl.play().catch(() => {});
            } else {
              onFatalError?.('HLS playback unsupported in this browser');
            }
          } catch {
            if (!cancelled) onFatalError?.('Failed to initialize HLS engine');
          }
        } else {
          player.src({ src, type: getMimeType(sourceType) });
          onQualitiesReady?.([]);
          onManifestReady?.();
          player.play()?.catch(() => {});
        }
      })
      .catch(() => {
        if (!cancelled) onFatalError?.('Failed to initialize Video.js player');
      });

    return () => {
      cancelled = true;
      videoEl.removeEventListener('loadedmetadata', handleLoaded);
      videoEl.removeEventListener('timeupdate', handleTime);
      videoEl.removeEventListener('ended', handleEnd);
      videoEl.removeEventListener('error', handleNativeErr);
      if (videoElementRef) videoElementRef.current = null;
      if (hlsInstanceRef) hlsInstanceRef.current = null;
      if (localHlsRef.current) {
        localHlsRef.current.destroy();
        localHlsRef.current = null;
      }
      if (playerRef.current && !playerRef.current.isDisposed()) {
        playerRef.current.dispose();
        playerRef.current = null;
      }
    };
  }, [src, sourceType, poster]);

  return (
    <div data-vjs-player className="w-full h-full bg-black flex items-center justify-center">
      <div ref={containerRef} className="w-full h-full" />
    </div>
  );
};
