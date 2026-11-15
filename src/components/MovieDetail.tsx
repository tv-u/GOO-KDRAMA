import React, { useEffect, useState } from 'react';
import {
  Play,
  Star,
  Eye,
  Clock,
  Calendar,
  ArrowLeft,
  Film,
  Users,
  HelpCircle,
  Bookmark,
  Heart,
  ExternalLink,
} from 'lucide-react';
import type { CastMember, Drama } from '../types/drama.ts';
import { AdsterraBanner } from './AdsterraBanner.tsx';
import { fetchDramaCredits } from '../services/tmdb.ts';
import {
  addRecentlyViewed,
  isFavorite,
  isInWatchlist,
  toggleFavorite,
  toggleWatchlist,
} from '../services/storage.ts';
import { getDramaFaqs, slugifyText } from '../services/seo.ts';
import { OptimizedImage } from './OptimizedImage.tsx';
import { DynamicMoviePlayer } from './DynamicMoviePlayer.tsx';

interface MovieDetailProps {
  movie: Drama;
  relatedMovies: Drama[];
  onWatchMovie: (slug: string) => void;
  onOpenMovie: (slug: string) => void;
  onOpenCast: (castSlug: string) => void;
  onOpenGenre: (genreSlug: string) => void;
  onOpenMoviesDirectory: () => void;
  onBack: () => void;
}

export const MovieDetail: React.FC<MovieDetailProps> = ({
  movie,
  relatedMovies,
  onWatchMovie,
  onOpenMovie,
  onOpenCast,
  onOpenGenre,
  onOpenMoviesDirectory,
  onBack,
}) => {
  const [castList, setCastList] = useState<CastMember[]>(movie.cast || []);
  const [inWatchlist, setInWatchlist] = useState<boolean>(false);
  const [favorited, setFavorited] = useState<boolean>(false);
  const [activePlayerTab, setActivePlayerTab] = useState<'stream' | 'trailer'>('stream');

  useEffect(() => {
    setInWatchlist(isInWatchlist(movie.slug));
    setFavorited(isFavorite(movie.slug));
    addRecentlyViewed({
      slug: movie.slug,
      title: movie.title,
      poster: movie.poster,
      country: movie.country,
      year: movie.year,
      rating: movie.rating,
      totalEpisodes: 1,
      type: 'movie',
      genres: movie.genres,
    });
  }, [movie]);

  useEffect(() => {
    let active = true;
    setActivePlayerTab('stream');
    if (movie.cast && movie.cast.length > 0) {
      setCastList(movie.cast);
    } else if (movie.tmdbId) {
      fetchDramaCredits(movie.tmdbId, 'movie').then(list => {
        if (active && list.length > 0) setCastList(list);
      });
    } else {
      setCastList([]);
    }
    return () => {
      active = false;
    };
  }, [movie.slug, movie.tmdbId, movie.cast]);

  const faqs = getDramaFaqs(movie);
  const tmdbId = movie.tmdbId || 0;

  return (
    <div className="min-h-screen bg-[#0a0d14]">
      {/* Movie Hero Backdrop */}
      <div className="relative h-72 sm:h-96 w-full overflow-hidden">
        <OptimizedImage
          src={movie.backdrop || movie.poster}
          alt={`${movie.title} (${movie.year}) Full Movie Backdrop`}
          width={1280}
          height={720}
          sizes="100vw"
          priority
          className="w-full h-full object-cover object-center filter blur-xs brightness-50"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0a0d14] via-[#0a0d14]/70 to-transparent" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0a0d14] via-transparent to-[#0a0d14]" />

        <div className="absolute top-6 left-4 sm:left-6 z-10 flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#111622]/90 backdrop-blur-md text-white text-xs sm:text-sm font-semibold border border-[#1e2638] hover:border-[#00c896]/60 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back</span>
          </button>

          <nav
            aria-label="Breadcrumb"
            className="hidden sm:flex items-center gap-2 text-xs text-slate-300 bg-[#111622]/85 px-3 py-1.5 rounded-lg border border-[#1e2638]"
          >
            <a
              href="/"
              onClick={e => {
                e.preventDefault();
                onBack();
              }}
              className="text-[#00c896] hover:underline font-medium"
            >
              Home
            </a>
            <span>/</span>
            <a
              href="/movies"
              onClick={e => {
                e.preventDefault();
                onOpenMoviesDirectory();
              }}
              className="text-[#00c896] hover:underline font-medium"
            >
              Movies
            </a>
            <span>/</span>
            <span className="text-white font-semibold truncate max-w-xs">{movie.title}</span>
          </nav>
        </div>
      </div>

      {/* Main Content Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 -mt-36 sm:-mt-48 relative z-10 pb-16">
        <div className="flex flex-col md:flex-row gap-8 items-start">
          {/* Left Column: Poster & Watch Actions */}
          <div className="w-48 sm:w-64 shrink-0 mx-auto md:mx-0">
            <div className="aspect-[2/3] w-full rounded-2xl overflow-hidden shadow-2xl border-2 border-[#1e2638] bg-[#111622]">
              <OptimizedImage
                src={movie.poster}
                alt={`${movie.title} (${movie.year}) Movie Poster`}
                width={500}
                height={750}
                priority
                className="w-full h-full object-cover"
              />
            </div>

            <div className="mt-4 space-y-2.5">
              <a
                href={`/watch/${movie.slug}`}
                onClick={e => {
                  e.preventDefault();
                  onWatchMovie(movie.slug);
                }}
                className="w-full py-3 px-4 rounded-xl bg-[#00c896] hover:bg-[#00b084] text-slate-950 font-bold text-sm sm:text-base flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20 transition-all hover:scale-[1.02]"
              >
                <Play className="w-5 h-5 fill-current" />
                <span>Watch Movie HD</span>
              </a>

              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    const res = toggleWatchlist({
                      slug: movie.slug,
                      title: movie.title,
                      poster: movie.poster,
                      country: movie.country,
                      year: movie.year,
                      rating: movie.rating,
                      totalEpisodes: 1,
                      type: 'movie',
                      genres: movie.genres,
                    });
                    setInWatchlist(res.added);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    inWatchlist
                      ? 'bg-[#00c896]/15 border-[#00c896]/40 text-[#00c896]'
                      : 'bg-[#111622] hover:bg-[#1a2234] border-[#1e2638] text-slate-200'
                  }`}
                >
                  <Bookmark className={`w-3.5 h-3.5 ${inWatchlist ? 'fill-current' : ''}`} />
                  <span>{inWatchlist ? 'Saved' : 'Watchlist'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    const res = toggleFavorite({
                      slug: movie.slug,
                      title: movie.title,
                      poster: movie.poster,
                      country: movie.country,
                      year: movie.year,
                      rating: movie.rating,
                      totalEpisodes: 1,
                      type: 'movie',
                      genres: movie.genres,
                    });
                    setFavorited(res.added);
                  }}
                  className={`py-2 px-3 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 border transition-colors cursor-pointer ${
                    favorited
                      ? 'bg-rose-600/20 border-rose-500/40 text-rose-300'
                      : 'bg-[#111622] hover:bg-[#1a2234] border-[#1e2638] text-slate-200'
                  }`}
                >
                  <Heart className={`w-3.5 h-3.5 ${favorited ? 'fill-current' : ''}`} />
                  <span>{favorited ? 'Favorited' : 'Favorite'}</span>
                </button>
              </div>
            </div>
          </div>

          {/* Right Column: Clean Typography Metadata */}
          <div className="flex-1 text-slate-200 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#00c896] mb-2">
              <a
                href="/movies"
                onClick={e => {
                  e.preventDefault();
                  onOpenMoviesDirectory();
                }}
                className="hover:underline"
              >
                {movie.country} Movie
              </a>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">Full HD 1080p</span>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <span className="text-slate-300">Hindi Dubbed &amp; Multi-Audio</span>
            </div>

            <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
              {movie.title}
            </h1>
            <p className="text-sm font-semibold text-slate-400 mt-1 mb-4">
              {movie.hindiTitle}
            </p>

            {/* Quick Metrics */}
            <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs sm:text-sm text-slate-300 py-3 border-y border-[#1e2638] mb-5 tabular-nums">
              <div className="flex items-center gap-1.5 text-amber-400 font-bold">
                <Star className="w-4 h-4 fill-amber-400" />
                <span>{movie.rating} / 10</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div className="flex items-center gap-1">
                <Calendar className="w-4 h-4 text-slate-400" />
                <span>{movie.year}</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div className="flex items-center gap-1">
                <Clock className="w-4 h-4 text-slate-400" />
                <span>{movie.duration || '118 min'}</span>
              </div>
              <span aria-hidden="true" className="text-slate-600">·</span>
              <div className="flex items-center gap-1">
                <Eye className="w-4 h-4 text-slate-400" />
                <span>{movie.views} views</span>
              </div>
            </div>

            {/* Crawlable Genre Links */}
            <div className="flex flex-wrap gap-2 mb-5">
              {(movie.genres || []).map(g => {
                const gSlug = slugifyText(g);
                return (
                  <a
                    key={g}
                    href={`/genre/${gSlug}`}
                    onClick={e => {
                      e.preventDefault();
                      onOpenGenre(gSlug);
                    }}
                    className="bg-[#111622] hover:bg-[#00c896]/15 text-slate-300 hover:text-[#00c896] border border-[#1e2638] hover:border-[#00c896]/50 text-xs font-medium px-3 py-1 rounded-md transition-colors"
                  >
                    {g}
                  </a>
                );
              })}
            </div>

            {/* Synopsis */}
            <div className="mb-6">
              <h2 className="text-sm font-bold text-slate-100 uppercase tracking-wider mb-2">
                Storyline
              </h2>
              <p className="text-sm text-slate-300 leading-relaxed">{movie.overview}</p>
            </div>

            {/* Specifications */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-[#111622] border border-[#1e2638] rounded-xl p-4 text-xs">
              <div>
                <span className="text-slate-400 block">Audio Tracks</span>
                <span className="text-white font-semibold">Hindi · Korean · English · Urdu</span>
              </div>
              <div>
                <span className="text-slate-400 block">Video Quality</span>
                <span className="text-white font-semibold">1080p FHD / 720p HD</span>
              </div>
              <div>
                <span className="text-slate-400 block">Country</span>
                <span className="text-white font-semibold">{movie.country} Cinema</span>
              </div>
              <div>
                <span className="text-slate-400 block">TMDB Reference</span>
                <span className="text-white font-semibold tabular-nums">#{movie.tmdbId || 'Verified'}</span>
              </div>
            </div>
          </div>
        </div>

        <AdsterraBanner type="player" className="my-8" />

        {/* Dedicated Embedded HLX Movie Streamer Section */}
        <section className="mb-10">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
            <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
              <Film className="w-5 h-5 text-[#00c896]" />
              <span>Stream {movie.title} Online</span>
            </h2>

            <div className="flex items-center gap-2">
              {movie.youtubeKey && (
                <div className="flex items-center gap-1 bg-[#111622] p-1 rounded-lg border border-[#1e2638]">
                  <button
                    type="button"
                    onClick={() => setActivePlayerTab('stream')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      activePlayerTab === 'stream'
                        ? 'bg-[#00c896] text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Full Movie
                  </button>
                  <button
                    type="button"
                    onClick={() => setActivePlayerTab('trailer')}
                    className={`px-3 py-1 rounded-md text-xs font-semibold cursor-pointer transition-colors ${
                      activePlayerTab === 'trailer'
                        ? 'bg-[#00c896] text-slate-950'
                        : 'text-slate-300 hover:text-white'
                    }`}
                  >
                    Trailer
                  </button>
                </div>
              )}

              <a
                href={`/watch/${movie.slug}`}
                onClick={e => {
                  e.preventDefault();
                  onWatchMovie(movie.slug);
                }}
                className="px-3 py-1.5 rounded-lg bg-[#111622] hover:bg-[#1a2234] text-[#00c896] border border-[#1e2638] text-xs font-semibold flex items-center gap-1.5"
              >
                <ExternalLink className="w-3.5 h-3.5" />
                <span>Theater Watch Page</span>
              </a>
            </div>
          </div>

          {activePlayerTab === 'trailer' && movie.youtubeKey ? (
            <div className="aspect-video w-full rounded-2xl overflow-hidden border border-[#1e2638] bg-black">
              <iframe
                src={`https://www.youtube.com/embed/${movie.youtubeKey}?autoplay=1`}
                title={`${movie.title} Official Trailer`}
                className="w-full h-full border-0"
                allow="autoplay; fullscreen; encrypted-media"
                allowFullScreen
              />
            </div>
          ) : (
            <DynamicMoviePlayer
              tmdbId={tmdbId || movie.slug}
              slug={movie.slug}
              title={movie.title}
              poster={movie.backdrop || movie.poster}
              mediaType="movie"
              initialLang="hi"
            />
          )}
        </section>

        <AdsterraBanner type="download" className="mb-10" />

        {/* Cast Section */}
        {castList.length > 0 && (
          <section className="bg-[#111622] border border-[#1e2638] rounded-2xl p-6 mb-10">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-[#1e2638]">
              <h2 className="text-lg sm:text-xl font-bold text-white flex items-center gap-2">
                <Users className="w-5 h-5 text-[#00c896]" />
                <span>Cast &amp; Credits – {movie.title}</span>
              </h2>
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
                  className="group bg-[#0a0d14] border border-[#1e2638] hover:border-[#00c896]/60 rounded-xl overflow-hidden transition-all"
                >
                  <div className="aspect-[3/4] bg-[#1a2234] overflow-hidden">
                    <OptimizedImage
                      src={actor.profilePath}
                      alt={`${actor.name} in ${movie.title}`}
                      width={342}
                      height={456}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  </div>
                  <div className="p-2.5">
                    <p className="text-xs font-bold text-slate-100 group-hover:text-[#00c896] line-clamp-1">
                      {actor.name}
                    </p>
                    <p className="text-[11px] text-slate-400 line-clamp-1">{actor.character}</p>
                  </div>
                </a>
              ))}
            </div>
          </section>
        )}

        {/* Movie FAQs */}
        <section className="bg-[#111622] border border-[#1e2638] rounded-2xl p-6 mb-10">
          <h2 className="text-lg font-bold text-white flex items-center gap-2 mb-4">
            <HelpCircle className="w-5 h-5 text-[#00c896]" />
            <span>Frequently Asked Questions – {movie.title}</span>
          </h2>
          <div className="space-y-3">
            {faqs.map((faq, idx) => (
              <div key={idx} className="bg-[#0a0d14] border border-[#1e2638] rounded-xl p-4">
                <h3 className="text-sm font-semibold text-slate-100 mb-1">{faq.question}</h3>
                <p className="text-xs text-slate-400 leading-relaxed">{faq.answer}</p>
              </div>
            ))}
          </div>
        </section>

        {/* Related Movies Grid (Crawlable 1-Movie-1-Page links) */}
        {relatedMovies.length > 0 && (
          <section>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-white">More Movies You May Like</h2>
              <a
                href="/movies"
                onClick={e => {
                  e.preventDefault();
                  onOpenMoviesDirectory();
                }}
                className="text-xs font-semibold text-[#00c896] hover:underline"
              >
                Browse All Movies →
              </a>
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 gap-4">
              {relatedMovies.slice(0, 6).map(item => (
                <a
                  key={item.slug}
                  href={`/movie/${item.slug}`}
                  onClick={e => {
                    e.preventDefault();
                    onOpenMovie(item.slug);
                  }}
                  className="group cursor-pointer block"
                >
                  <div className="aspect-[2/3] rounded-xl overflow-hidden bg-[#111622] border border-[#1e2638] group-hover:border-[#00c896]/70 transition-colors">
                    <OptimizedImage
                      src={item.poster}
                      alt={`${item.title} (${item.year}) Poster`}
                      width={342}
                      height={513}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                  <h3 className="text-xs sm:text-sm font-semibold text-slate-200 group-hover:text-[#00c896] transition-colors line-clamp-1 mt-2">
                    {item.title}
                  </h3>
                  <p className="text-[11px] text-slate-400 tabular-nums">
                    {item.year} · ★ {item.rating} · HD
                  </p>
                </a>
              ))}
            </div>
          </section>
        )}
      </div>
    </div>
  );
};
