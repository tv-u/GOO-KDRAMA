import React, { useEffect, useState } from 'react';
import { Play, Download, Star, Eye, Clock, Calendar, ArrowLeft, Tv, Users, HelpCircle, Bookmark, Heart, Check } from 'lucide-react';
import type { CastMember, Drama, EpisodeDetail, SeasonSummary } from '../types/drama.ts';
import { AdsterraBanner } from './AdsterraBanner.tsx';
import { triggerSmartlink } from '../services/adsterra.ts';
import { fetchDramaCredits, fetchTmdbSeasonEpisodes, fetchTmdbShowSeasons } from '../services/tmdb.ts';
import {
  addRecentlyViewed,
  getWatchedEpisodesForDrama,
  isFavorite,
  isInWatchlist,
  toggleFavorite,
  toggleWatchlist,
} from '../services/storage.ts';
import { getDramaFaqs, slugifyText } from '../services/seo.ts';
import { OptimizedImage } from './OptimizedImage.tsx';
import { DynamicMoviePlayer } from './DynamicMoviePlayer.tsx';

interface DramaDetailProps {
  drama: Drama;
  relatedDramas: Drama[];
  onWatchEpisode: (slug: string, ep: number) => void;
  onOpenDrama: (slug: string) => void;
  onOpenCast: (castSlug: string) => void;
  onOpenGenre: (genreSlug: string) => void;
  onSelectCategory: (cat: string) => void;
  onBack: () => void;
}

export const DramaDetail: React.FC<DramaDetailProps> = ({
  drama,
  relatedDramas,
  onWatchEpisode,
  onOpenDrama,
  onOpenCast,
  onOpenGenre,
  onSelectCategory,
  onBack,
}) => {
  const [castList, setCastList] = useState<CastMember[]>(drama.cast || []);
  const [seasons, setSeasons] = useState<SeasonSummary[]>(drama.seasons || []);
  const [selectedSeason, setSelectedSeason] = useState<number>(drama.season || 1);
  const [seasonEpisodes, setSeasonEpisodes] = useState<EpisodeDetail[]>([]);
  const [loadingEpisodes, setLoadingEpisodes] = useState<boolean>(false);
  const [watchedEpisodes, setWatchedEpisodes] = useState<number[]>([]);
  const [inWatchlist, setInWatchlist] = useState<boolean>(false);
  const [favorited, setFavorited] = useState<boolean>(false);

  useEffect(() => {
    setWatchedEpisodes(getWatchedEpisodesForDrama(drama.slug));
    setInWatchlist(isInWatchlist(drama.slug));
    setFavorited(isFavorite(drama.slug));
    addRecentlyViewed({
      slug: drama.slug,
      title: drama.title,
      poster: drama.poster,
      country: drama.country,
      year: drama.year,
      rating: drama.rating,
      totalEpisodes: drama.totalEpisodes,
      type: drama.type,
      genres: drama.genres,
    });
  }, [drama]);

  useEffect(() => {
    let active = true;
    if (drama.cast && drama.cast.length > 0) {
      setCastList(drama.cast);
    } else if (drama.tmdbId) {
      fetchDramaCredits(drama.tmdbId, drama.type || 'tv').then(list => {
        if (active && list.length > 0) setCastList(list);
      });
    }

    if (drama.type !== 'movie' && drama.tmdbId) {
      fetchTmdbShowSeasons(drama.tmdbId).then(list => {
        if (active && list.length > 0) {
          setSeasons(list);
        }
      });
    }
    return () => {
      active = false;
    };
  }, [drama.slug, drama.tmdbId, drama.type, drama.cast]);

  useEffect(() => {
    if (drama.type === 'movie' || !drama.tmdbId) return;
    let active = true;
    setLoadingEpisodes(true);
    fetchTmdbSeasonEpisodes(drama.tmdbId, selectedSeason)
      .then(list => {
        if (active) setSeasonEpisodes(list);
      })
      .finally(() => {
        if (active) setLoadingEpisodes(false);
      });
    return () => {
      active = false;
    };
  }, [drama.tmdbId, drama.type, selectedSeason]);

  const nextRecommendedEp =
    watchedEpisodes.length > 0
      ? Math.min(drama.totalEpisodes, Math.max(...watchedEpisodes) + 1)
      : 1;

  const faqs = getDramaFaqs(drama);

  return (
    <div className="min-h-screen">
      {/* Hero Backdrop */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden">
        <OptimizedImage
          src={drama.backdrop || drama.poster}
          alt={`${drama.title} (${drama.year}) Hindi Dubbed Official Backdrop`}
          width={1280}
          height={720}
          sizes="100vw"
          priority
          className="w-full h-full object-cover object-center filter blur-xs brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0b0f19] via-[#0b0f19]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0b0f19] via-transparent to-[#0b0f19]" />

        {/* Back button & Breadcrumb */}
        <div className="absolute top-6 left-6 z-10 flex items-center gap-3">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-black/60 backdrop-blur-md text-white text-xs sm:text-sm font-semibold border border-white/10 hover:bg-black/80 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Browse</span>
          </button>

          <nav aria-label="Breadcrumb" className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-black/50 px-3 py-1.5 rounded-lg border border-white/10">
            <a
              href="/"
              onClick={e => {
                e.preventDefault();
                onBack();
              }}
              className="text-blue-400 hover:underline"
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
              className="text-blue-400 hover:underline"
            >
              {drama.country} Drama
            </a>
            <span>/</span>
            <span className="text-white font-semibold">{drama.title}</span>
          </nav>
        </div>
      </div>

      {/* Main Content Info */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-36 sm:-mt-48 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          
          {/* Left: Poster & Action CTAs */}
          <div className="w-48 sm:w-64 shrink-0 mx-auto md:mx-0">
            <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-slate-700 bg-slate-800">
              <OptimizedImage
                src={drama.poster}
                alt={`${drama.title} (${drama.year}) Hindi Dubbed Poster`}
                width={500}
                height={750}
                priority
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-4 space-y-2.5">
              <a
                href={`/watch/${drama.slug}/episode-${nextRecommendedEp}`}
                onClick={e => {
                  e.preventDefault();
                  onWatchEpisode(drama.slug, nextRecommendedEp);
                }}
                className="w-full py-3 px-4 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-blue-600/30 transition-all hover:scale-[1.02]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>
                  {watchedEpisodes.length > 0
                    ? `Continue Episode ${nextRecommendedEp}`
                    : drama.type === 'movie'
                      ? 'Watch Movie'
                      : 'Watch Episode 1'}
                </span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const res = toggleWatchlist({
                      slug: drama.slug,
                      title: drama.title,
                      poster: drama.poster,
                      country: drama.country,
                      year: drama.year,
                      rating: drama.rating,
                      totalEpisodes: drama.totalEpisodes,
                      type: drama.type,
                      genres: drama.genres,
                    });
                    setInWatchlist(res.added);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    inWatchlist
                      ? 'bg-blue-600/20 border-blue-500/40 text-blue-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-current' : ''}`} />
                  <span>{inWatchlist ? 'In Watchlist' : 'Watchlist'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const res = toggleFavorite({
                      slug: drama.slug,
                      title: drama.title,
                      poster: drama.poster,
                      country: drama.country,
                      year: drama.year,
                      rating: drama.rating,
                      totalEpisodes: drama.totalEpisodes,
                      type: drama.type,
                      genres: drama.genres,
                    });
                    setFavorited(res.added);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    favorited
                      ? 'bg-rose-600/20 border-rose-500/40 text-rose-300'
                      : 'bg-slate-800 hover:bg-slate-700 border-slate-700 text-slate-200'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
                  <span>{favorited ? 'Favorited' : 'Favorite'}</span>
                </button>
              </div>

              <button
                onClick={() => triggerSmartlink()}
                className="w-full py-2.5 px-4 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 font-semibold text-xs sm:text-sm flex items-center justify-center gap-2 border border-slate-700 transition-colors cursor-pointer"
              >
                <Download className="w-4 h-4" />
                <span>Download Full Season</span>
              </button>
            </div>
          </div>

          {/* Right: Drama Details */}
          <div className="flex-1 text-slate-200">
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <a
                href={`/category/${drama.country.toLowerCase()}`}
                onClick={e => {
                  e.preventDefault();
                  onSelectCategory(drama.country.toLowerCase());
                }}
                className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded uppercase hover:bg-blue-500 transition-colors"
              >
                {drama.country} Drama
              </a>
              <span className="bg-emerald-600/20 text-emerald-400 border border-emerald-500/30 text-xs font-bold px-2 py-0.5 rounded">
                Hindi Dubbed
              </span>
              <span className="bg-slate-800 text-slate-300 text-xs px-2 py-0.5 rounded">
                {drama.status}
              </span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {drama.title}
            </h1>
            <p className="text-sm font-semibold text-blue-400 mt-1 mb-4">
              {drama.hindiTitle}
            </p>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-4 text-xs sm:text-sm text-slate-300 py-3 border-y border-slate-800/80 mb-5">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>{drama.rating} / 10</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{drama.year}</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-slate-400" />
                <span>{drama.views} views</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{drama.duration}</span>
              </div>
              <span>·</span>
              <div className="flex items-center gap-1">
                <Tv className="w-4 h-4 text-blue-400" />
                <span>{drama.totalEpisodes} Episodes</span>
              </div>
            </div>

            {/* Crawlable Genre Links */}
            <div className="flex flex-wrap gap-1.5 mb-5">
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
                    className="bg-slate-800/80 hover:bg-blue-600/30 text-slate-300 hover:text-blue-300 border border-slate-700/60 hover:border-blue-500/50 text-xs px-2.5 py-1 rounded-md transition-colors"
                  >
                    {g}
                  </a>
                );
              })}
            </div>

            {/* Overview */}
            <div className="mb-6">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2">
                Synopsis
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">
                {drama.overview}
              </p>
            </div>

            {/* Technical Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-slate-900/50 border border-slate-800 rounded-xl p-4 text-xs">
              <div>
                <span className="text-slate-500 block">Audio Track</span>
                <span className="text-slate-200 font-semibold">Hindi (Stereo / 5.1)</span>
              </div>
              <div>
                <span className="text-slate-500 block">Quality</span>
                <span className="text-slate-200 font-semibold">1080p FHD / 720p HD</span>
              </div>
              <div>
                <span className="text-slate-500 block">Language</span>
                <span className="text-slate-200 font-semibold">Hindi Dubbed</span>
              </div>
              <div>
                <span className="text-slate-500 block">TMDB ID</span>
                <span className="text-slate-200 font-semibold">{drama.tmdbId || 'Official'}</span>
              </div>
            </div>

          </div>
        </div>

        {/* Adsterra Banner */}
        <AdsterraBanner type="player" className="my-8" />

        {/* Cast Section (Crawlable Cast Links for SSR SEO) */}
        {castList.length > 0 && (
          <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-8">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-slate-800">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-blue-500" />
                <span>Main Cast of {drama.title}</span>
              </h2>
              <span className="text-xs text-slate-400">Synced from TMDB</span>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-3.5">
              {castList.slice(0, 6).map(actor => (
                <a
                  key={actor.id}
                  href={`/cast/${actor.slug}`}
                  onClick={e => {
                    e.preventDefault();
                    onOpenCast(actor.slug);
                  }}
                  className="group bg-slate-900/70 border border-slate-800 hover:border-blue-500/60 rounded-xl overflow-hidden transition-all"
                >
                  <div className="aspect-[3/4] bg-slate-800 overflow-hidden">
                    <OptimizedImage
                      src={actor.profilePath}
                      alt={`${actor.name} as ${actor.character} in ${drama.title}`}
                      width={342}
                      height={456}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-bold text-slate-100 group-hover:text-blue-400 line-clamp-1">
                      {actor.name}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">
                      {actor.character}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        )}

        {/* Season & Episode Management Section */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-8">
          <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-slate-800">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Tv className="w-5 h-5 text-blue-500" />
              <span>
                {drama.type === 'movie' ? 'HLX Dynamic Movie Player' : `All Episodes (${drama.totalEpisodes})`}
              </span>
            </h2>

            {seasons.length > 1 && (
              <div className="flex items-center gap-1.5 overflow-x-auto">
                {seasons.map(s => (
                  <button
                    key={s.seasonNumber}
                    type="button"
                    onClick={() => setSelectedSeason(s.seasonNumber)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer whitespace-nowrap transition-colors ${
                      selectedSeason === s.seasonNumber
                        ? 'bg-blue-600 text-white'
                        : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                    }`}
                  >
                    Season {s.seasonNumber} ({s.episodeCount})
                  </button>
                ))}
              </div>
            )}
          </div>

          {drama.type === 'movie' ? (
            <div className="my-2">
              <DynamicMoviePlayer
                tmdbId={drama.tmdbId || 129117}
                title={drama.title}
                mediaType="movie"
                initialLang="hi"
              />
            </div>
          ) : loadingEpisodes ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {Array.from({ length: 6 }).map((_, idx) => (
                <div key={idx} className="h-24 rounded-xl bg-slate-800/70 animate-pulse border border-slate-800" />
              ))}
            </div>
          ) : seasonEpisodes.length > 0 ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
              {seasonEpisodes.map(ep => {
                const isWatched = watchedEpisodes.includes(ep.episodeNumber);
                return (
                  <a
                    key={`s${ep.seasonNumber}-e${ep.episodeNumber}`}
                    href={`/watch/${drama.slug}/episode-${ep.episodeNumber}`}
                    onClick={e => {
                      e.preventDefault();
                      onWatchEpisode(drama.slug, ep.episodeNumber);
                    }}
                    className="group flex gap-3 p-2.5 rounded-xl bg-slate-900/70 hover:bg-slate-800/80 border border-slate-800 hover:border-blue-500/60 transition-colors cursor-pointer"
                  >
                    <div className="relative w-28 aspect-video rounded-lg overflow-hidden bg-slate-800 shrink-0">
                      <OptimizedImage
                        src={ep.stillUrl || drama.backdrop || drama.poster}
                        alt={`${drama.title} Ep ${ep.episodeNumber}`}
                        width={320}
                        height={180}
                        className="w-full h-full object-cover"
                      />
                      <span className="absolute bottom-1 left-1 bg-black/80 text-white text-[10px] font-mono tabular-nums px-1.5 py-0.5 rounded">
                        Ep {ep.episodeNumber}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-blue-400 truncate">
                          {ep.name}
                        </p>
                        {isWatched && (
                          <span className="text-[10px] text-emerald-400 font-semibold shrink-0 flex items-center gap-0.5">
                            <Check className="w-3 h-3" /> Watched
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-400 line-clamp-2 mt-0.5 leading-snug">
                        {ep.overview}
                      </p>
                      <div className="flex items-center gap-2 text-[10px] text-slate-500 mt-1 tabular-nums">
                        {ep.airDate && <span>{ep.airDate}</span>}
                        {ep.runtime && (
                          <>
                            <span aria-hidden="true">·</span>
                            <span>{ep.runtime} min</span>
                          </>
                        )}
                      </div>
                    </div>
                  </a>
                );
              })}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-6 lg:grid-cols-8 gap-3">
              {Array.from({ length: drama.totalEpisodes }, (_, i) => i + 1).map(ep => {
                const isWatched = watchedEpisodes.includes(ep);
                return (
                  <a
                    key={ep}
                    href={`/watch/${drama.slug}/episode-${ep}`}
                    onClick={e => {
                      e.preventDefault();
                      onWatchEpisode(drama.slug, ep);
                    }}
                    className={`flex items-center justify-center gap-1.5 py-3 px-2 rounded-xl font-semibold text-xs border transition-all cursor-pointer shadow-sm group ${
                      isWatched
                        ? 'bg-emerald-950/50 border-emerald-600/40 text-emerald-300 hover:bg-blue-600 hover:text-white'
                        : 'bg-slate-800/90 hover:bg-blue-600 text-slate-200 hover:text-white border-slate-700/60 hover:border-blue-500'
                    }`}
                  >
                    {isWatched ? <Check className="w-3 h-3" /> : <Play className="w-3 h-3 fill-current" />}
                    <span>Ep {ep}</span>
                  </a>
                );
              })}
            </div>
          )}
        </div>

        {/* SEO FAQ Section (Matches FAQPage JSON-LD) */}
        <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-blue-500" />
            <span>Frequently Asked Questions – {drama.title} Hindi Dubbed</span>
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-slate-900/70 border border-slate-800/80 rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-100 mb-1">
                  {faq.question}
                </h3>
                <p className="text-xs text-slate-400 leading-relaxed">
                  {faq.answer}
                </p>
              </div>
            ))}
          </div>
        </div>

        {/* Related Dramas */}
        {relatedDramas.length > 0 && (
          <div>
            <h2 className="text-xl font-bold text-white mb-4">
              More {drama.country} Dramas in Hindi Dubbed
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {relatedDramas.slice(0, 6).map(item => (
                <a
                  key={item.id}
                  href={`/drama/${item.slug}`}
                  onClick={e => {
                    e.preventDefault();
                    onOpenDrama(item.slug);
                  }}
                  className="group cursor-pointer block"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 border border-slate-800 group-hover:border-blue-500 transition-colors">
                    <OptimizedImage
                      src={item.poster}
                      alt={`${item.title} (${item.year}) Hindi Dubbed Poster`}
                      width={342}
                      height={513}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-blue-400 transition-colors line-clamp-1 mt-2">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400">
                    ★ {item.rating} • {item.totalEpisodes} Eps
                  </p>
                </a>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  );
};
