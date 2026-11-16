import React, { useEffect, useState } from 'react';
import { Sparkles, Download, Zap, ExternalLink } from 'lucide-react';
import {
  ADSTERRA_NATIVE_CONTAINER_ID,
  ADSTERRA_NATIVE_SCRIPT_URL,
  ADSTERRA_SMARTLINKS,
  getNextAdsterraLink,
} from '../services/adsterra.ts';

interface AdsterraBannerProps {
  type?: 'top' | 'player' | 'download' | 'native';
  className?: string;
}

export const AdsterraBanner: React.FC<AdsterraBannerProps> = ({ type = 'native', className = '' }) => {
  const initialIdx = type === 'top' ? 0 : type === 'player' ? 1 : type === 'download' ? 2 : 2;
  const [activeHref, setActiveHref] = useState<string>(ADSTERRA_SMARTLINKS[initialIdx]);
  const [mountLiveNativeSlot, setMountLiveNativeSlot] = useState<boolean>(false);

  useEffect(() => {
    if (type !== 'native' || typeof document === 'undefined') return;
    // Ensure only one primary Adsterra Native Banner container ID mounts per active view
    const existing = document.getElementById(ADSTERRA_NATIVE_CONTAINER_ID);
    if (!existing) {
      setMountLiveNativeSlot(true);
    }
  }, [type]);

  useEffect(() => {
    if (!mountLiveNativeSlot || typeof document === 'undefined') return;
    const container = document.getElementById(ADSTERRA_NATIVE_CONTAINER_ID);
    if (!container) return;

    const existingScript = document.querySelector(`script[src="${ADSTERRA_NATIVE_SCRIPT_URL}"]`);
    if (existingScript) {
      existingScript.remove();
    }
    const script = document.createElement('script');
    script.async = true;
    script.setAttribute('data-cfasync', 'false');
    script.src = ADSTERRA_NATIVE_SCRIPT_URL;
    container.parentNode?.insertBefore(script, container);
  }, [mountLiveNativeSlot]);

  const handleLinkClick = () => {
    // Rotate smartlink URL for the next interaction while letting the native <a> open reliably
    setActiveHref(getNextAdsterraLink());
  };

  if (type === 'top') {
    return (
      <a
        href={activeHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className={`w-full bg-gradient-to-r from-blue-900/40 via-indigo-900/50 to-blue-900/40 border-y border-blue-500/20 py-2 px-4 cursor-pointer hover:bg-blue-900/60 transition-colors flex items-center justify-center gap-2 text-xs md:text-sm text-blue-200 ${className}`}
      >
        <span className="bg-blue-600 text-white font-bold px-2 py-0.5 rounded text-[11px] uppercase tracking-wider">
          FAST CDN
        </span>
        <span className="font-medium text-slate-100">
          ⚡ High Speed Hindi Dubbed Streaming Server Active • No Buffering 1080p Full HD
        </span>
        <ExternalLink className="w-3.5 h-3.5 text-blue-300 ml-1 inline shrink-0" />
      </a>
    );
  }

  if (type === 'player') {
    return (
      <a
        href={activeHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className={`w-full bg-slate-900/90 border border-slate-800 rounded-lg p-3 cursor-pointer hover:border-blue-500/50 transition-all group flex items-center justify-between gap-4 ${className}`}
      >
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600/20 text-blue-400 flex items-center justify-center shrink-0">
            <Zap className="w-4 h-4 text-blue-400 group-hover:scale-110 transition-transform" />
          </div>
          <div>
            <p className="text-xs md:text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors">
              Having buffering issues? Switch to High-Speed Premium VIP Server
            </p>
            <p className="text-[11px] text-slate-400">
              Instant load • Hindi Dubbed 5.1 Surround • Zero lag 60FPS
            </p>
          </div>
        </div>
        <span className="shrink-0 bg-blue-600 group-hover:bg-blue-500 text-white text-xs font-semibold px-3 py-1.5 rounded transition-colors whitespace-nowrap">
          Connect VIP
        </span>
      </a>
    );
  }

  if (type === 'download') {
    return (
      <a
        href={activeHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className={`block bg-gradient-to-r from-amber-950/40 via-slate-900 to-amber-950/40 border border-amber-500/20 rounded-lg p-3.5 cursor-pointer hover:border-amber-500/50 transition-all ${className}`}
      >
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Download className="w-4 h-4 text-amber-400 shrink-0" />
            <span className="text-xs md:text-sm font-medium text-amber-200">
              Download Full Season Zip [1080p Hindi Dubbed + English Subs] — High Speed Direct Link
            </span>
          </div>
          <span className="text-xs bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2.5 py-1 rounded font-medium shrink-0">
            Free Download
          </span>
        </div>
      </a>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {mountLiveNativeSlot && (
        <div className="rounded-xl border border-slate-800/80 bg-slate-900/50 p-2 overflow-hidden">
          <div id={ADSTERRA_NATIVE_CONTAINER_ID} />
        </div>
      )}

      <a
        href={activeHref}
        target="_blank"
        rel="noopener noreferrer"
        onClick={handleLinkClick}
        className="block relative overflow-hidden rounded-lg border border-slate-800 bg-slate-900/60 p-4 cursor-pointer hover:border-blue-500/40 transition-all"
      >
        <div className="flex items-center justify-between text-xs text-slate-500 mb-2">
          <span className="uppercase tracking-wider text-[10px] font-semibold text-slate-400">
            Sponsored Link
          </span>
          <span className="text-[10px]">AsiaFilm Ad Network</span>
        </div>
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded bg-gradient-to-br from-blue-600 to-indigo-700 flex items-center justify-center shrink-0 text-white font-bold">
            <Sparkles className="w-6 h-6" />
          </div>
          <div>
            <h4 className="text-sm font-semibold text-slate-100 hover:text-blue-400 transition-colors">
              Watch Latest Korean &amp; Chinese Dramas in Hindi Dubbed on Ultra HD
            </h4>
            <p className="text-xs text-slate-400 mt-0.5">
              Access unlimited HD Asian drama episodes, direct cloud downloads, and official Hindi audio tracks.
            </p>
          </div>
        </div>
      </a>
    </div>
  );
};
