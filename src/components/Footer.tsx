import React from 'react';
import { Film, Send } from 'lucide-react';
import type { DramaCategory } from '../types/drama.ts';

interface FooterProps {
  onSelectCategory: (cat: DramaCategory) => void;
  onNavigateHome: () => void;
  onOpenPage: (page: string) => void;
  onOpenRequest: () => void;
}

export const Footer: React.FC<FooterProps> = ({
  onSelectCategory,
  onNavigateHome,
  onOpenPage,
  onOpenRequest,
}) => {
  return (
    <footer className="bg-[#080c14] border-t border-slate-800/80 pt-12 pb-8 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-slate-800/70">
          
          {/* Brand Info */}
          <div className="md:col-span-1 space-y-3">
            <a
              href="/"
              className="flex items-center gap-2 cursor-pointer"
              onClick={e => {
                e.preventDefault();
                onNavigateHome();
              }}
            >
              <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white">
                <Film className="w-4 h-4" />
              </div>
              <span className="text-xl font-extrabold text-white">
                Hindi<span className="text-blue-500">Drama</span>
              </span>
            </a>
            <p className="text-xs text-slate-400 leading-relaxed">
              Watch Korean, Chinese, Japanese, and Indian dramas in Hindi dubbed online for free in HD. High speed servers, auto-sync with TMDB, and daily episode releases on HindiDrama.net.
            </p>
            <div className="pt-1">
              <a
                href="https://telegram.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#229ED9]/20 hover:bg-[#229ED9]/30 text-[#229ED9] border border-[#229ED9]/40 rounded-lg text-xs font-semibold transition-colors"
              >
                <Send className="w-3.5 h-3.5" />
                <span>Join Telegram Channel</span>
              </a>
            </div>
          </div>

          {/* Drama Categories */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
              Categories
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <a
                  href="/category/korean"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('korean');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Korean Dramas (Kdrama Hindi)
                </a>
              </li>
              <li>
                <a
                  href="/category/chinese"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('chinese');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Chinese Dramas (C-Drama Hindi)
                </a>
              </li>
              <li>
                <a
                  href="/category/japanese"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('japanese');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Japanese Dramas (J-Drama Hindi)
                </a>
              </li>
              <li>
                <a
                  href="/category/indian"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('indian');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Indian Web Series & Dramas
                </a>
              </li>
              <li>
                <a
                  href="/category/trending"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('trending');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Trending Asian Dramas
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Links & Services */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
              Quick Links & SEO
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  onClick={onOpenRequest}
                  className="hover:text-blue-400 transition-colors cursor-pointer"
                >
                  Request Drama
                </button>
              </li>
              <li>
                <a
                  href="/contact"
                  onClick={e => {
                    e.preventDefault();
                    onOpenPage('contact');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Contact & Support
                </a>
              </li>
              <li>
                <a
                  href="/dmca"
                  onClick={e => {
                    e.preventDefault();
                    onOpenPage('dmca');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  DMCA Notice
                </a>
              </li>
              <li>
                <a
                  href="/disclaimer"
                  onClick={e => {
                    e.preventDefault();
                    onOpenPage('disclaimer');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Disclaimer Policy
                </a>
              </li>
              <li>
                <a
                  href="/privacy-policy"
                  onClick={e => {
                    e.preventDefault();
                    onOpenPage('privacy');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Privacy Policy
                </a>
              </li>
              <li>
                <a
                  href="/terms"
                  onClick={e => {
                    e.preventDefault();
                    onOpenPage('terms');
                  }}
                  className="hover:text-blue-400 transition-colors"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/sitemap.xml" className="hover:text-blue-400 transition-colors">
                  XML Sitemap
                </a>
              </li>
            </ul>
          </div>

          {/* Disclaimer text */}
          <div className="space-y-2 text-xs text-slate-400">
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
              Disclaimer
            </h4>
            <p className="leading-relaxed">
              HindiDrama.net does not host any files on its servers. All videos and streams are embedded from third-party media hosting platforms (StreamWish, Abyss, Byse, VidCloud, SuperEmbed, etc.).
            </p>
            <p className="leading-relaxed">
              For copyright issues, please submit an official takedown request via our DMCA page.
            </p>
          </div>

        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <p className="text-center sm:text-left">
            © 2026 <strong className="text-slate-300">HindiDrama.net</strong> — Korean, Chinese, Japanese & Indian dramas in Hindi dubbed.
          </p>
          <div className="flex items-center gap-4 text-slate-400">
            <a href="/dmca" onClick={e => { e.preventDefault(); onOpenPage('dmca'); }} className="hover:text-slate-200">DMCA</a>
            <a href="/disclaimer" onClick={e => { e.preventDefault(); onOpenPage('disclaimer'); }} className="hover:text-slate-200">Disclaimer</a>
            <a href="/privacy-policy" onClick={e => { e.preventDefault(); onOpenPage('privacy'); }} className="hover:text-slate-200">Privacy Policy</a>
            <a href="/terms" onClick={e => { e.preventDefault(); onOpenPage('terms'); }} className="hover:text-slate-200">Terms</a>
          </div>
        </div>
      </div>
    </footer>
  );
};
