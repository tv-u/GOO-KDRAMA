import React from 'react';
import { Play, Send } from 'lucide-react';
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
    <footer className="bg-[#07090f] border-t border-[#1e2638] pt-12 pb-8 text-slate-400">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-10 border-b border-[#1e2638]">
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
              <div className="w-8 h-8 rounded-lg bg-[#00c896] flex items-center justify-center text-slate-950">
                <Play className="w-4 h-4 fill-current ml-0.5" />
              </div>
              <span className="text-xl font-extrabold text-white">
                Hindi<span className="text-[#00c896]">Drama</span>
              </span>
            </a>
            <p className="text-xs text-slate-400 leading-relaxed">
              Watch Korean, Chinese, Japanese, and Indian dramas in Hindi dubbed &amp; original audio online for free in HD. High-speed servers, auto-sync with TMDB, and daily episode releases on kdrama-hindi.pages.dev.
            </p>
            <div className="pt-1">
              <a
                href="https://telegram.org"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#00c896]/15 hover:bg-[#00c896]/25 text-[#00c896] border border-[#00c896]/35 rounded-lg text-xs font-semibold transition-colors"
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
                  href="/category/hindi-dubbed"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('hindi-dubbed');
                  }}
                  className="hover:text-[#00c896] text-[#00c896] font-semibold transition-colors"
                >
                  Hindi Dubbed K-Drama (Hindi Only)
                </a>
              </li>
              <li>
                <a
                  href="/category/korean"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('korean');
                  }}
                  className="hover:text-[#00c896] transition-colors"
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
                  className="hover:text-[#00c896] transition-colors"
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
                  className="hover:text-[#00c896] transition-colors"
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
                  className="hover:text-[#00c896] transition-colors"
                >
                  Indian Web Series &amp; Dramas
                </a>
              </li>
              <li>
                <a
                  href="/category/trending"
                  onClick={e => {
                    e.preventDefault();
                    onSelectCategory('trending');
                  }}
                  className="hover:text-[#00c896] transition-colors"
                >
                  Trending Asian Dramas
                </a>
              </li>
            </ul>
          </div>

          {/* Quick Links & Services */}
          <div>
            <h4 className="text-xs font-bold text-slate-200 uppercase tracking-wider mb-3">
              Quick Links &amp; SEO
            </h4>
            <ul className="space-y-2 text-xs">
              <li>
                <button
                  type="button"
                  onClick={onOpenRequest}
                  className="hover:text-[#00c896] transition-colors cursor-pointer"
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
                  className="hover:text-[#00c896] transition-colors"
                >
                  Contact &amp; Support
                </a>
              </li>
              <li>
                <a
                  href="/dmca"
                  onClick={e => {
                    e.preventDefault();
                    onOpenPage('dmca');
                  }}
                  className="hover:text-[#00c896] transition-colors"
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
                  className="hover:text-[#00c896] transition-colors"
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
                  className="hover:text-[#00c896] transition-colors"
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
                  className="hover:text-[#00c896] transition-colors"
                >
                  Terms of Service
                </a>
              </li>
              <li>
                <a href="/sitemap.xml" className="hover:text-[#00c896] transition-colors">
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
              kdrama-hindi.pages.dev does not host any files on its servers. All videos and streams are embedded from third-party media hosting platforms (HLX Proxy, pkembed, Streamwish, Filemoon, Streamtape, Vidhide, Abyss, etc.).
            </p>
            <p className="leading-relaxed">
              For copyright issues, please submit an official takedown request via our DMCA page.
            </p>
          </div>
        </div>

        {/* Crawlable Genre SEO Internal Link Strip */}
        <div className="py-5 border-b border-[#1e2638] flex flex-wrap items-center gap-2 text-[11px]">
          <span className="text-slate-400 font-semibold uppercase tracking-wider mr-1">Popular Genres:</span>
          {[
            { slug: 'romance', label: 'Romance K-Dramas' },
            { slug: 'action', label: 'Action & Thriller' },
            { slug: 'historical', label: 'Historical C-Dramas' },
            { slug: 'fantasy', label: 'Fantasy Dramas' },
            { slug: 'comedy', label: 'Rom-Com Hindi' },
            { slug: 'mystery', label: 'Mystery & Crime' },
            { slug: 'drama', label: 'Family & Melodrama' },
            { slug: 'sci-fi-fantasy', label: 'Sci-Fi & Supernatural' },
          ].map(g => (
            <a
              key={g.slug}
              href={`/genre/${g.slug}`}
              className="px-2.5 py-1 rounded bg-[#111622] hover:bg-[#1a2234] border border-[#1e2638] text-slate-300 hover:text-[#00c896] transition-colors"
            >
              {g.label}
            </a>
          ))}
        </div>

        {/* Worldwide Top-50 Language & Long-Tail Hindi K-Drama Search Directory */}
        <div className="py-4 border-b border-[#1e2638] text-[11px] text-slate-500 leading-relaxed">
          <span className="text-slate-400 font-semibold uppercase tracking-wider mr-2">
            Worldwide K-Drama Index (50+ Languages):
          </span>
          <a
            href="/category/hindi-dubbed"
            onClick={e => {
              e.preventDefault();
              onSelectCategory('hindi-dubbed');
            }}
            className="text-[#00c896] hover:underline font-medium mr-2"
          >
            Watch Real Hindi Dubbed K-Drama Only
          </a>
          <span>
            • हिंदी डब के-ड्रामा ऑनलाइन • 힌디어 더빙 한국 드라마 • Ver K-Dramas Doblados al Hindi • Regarder K-Drama en Hindi • مسلسل كوري مدبلج هندي • Nonton Drama Korea Hindi • ดูซีรีส์เกาหลีพากย์ฮินดี • Phim Hàn Lồng Tiếng Hindi • हिन्‍दी डब के-ड्रामा HD
          </span>
        </div>

        {/* Bottom Copyright */}
        <div className="pt-6 flex flex-col sm:flex-row items-center justify-between text-xs text-slate-400 gap-3">
          <p className="text-center sm:text-left">
            © 2026 <strong className="text-slate-300">kdrama-hindi.pages.dev</strong> — Korean, Chinese, Japanese &amp; Indian dramas in Hindi dubbed.
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
