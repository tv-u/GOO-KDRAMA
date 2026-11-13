import React, { useEffect, useState } from 'react';
import { ArrowLeft, Calendar, Film, MapPin, Play, Star, User } from 'lucide-react';
import type { CastProfile, Drama } from '../types/drama.ts';
import { fetchCastDetails, fetchDramaDetailsFromTMDB } from '../services/tmdb.ts';
import { OptimizedImage } from './OptimizedImage.tsx';
import { AdsterraBanner } from './AdsterraBanner.tsx';

interface CastPageProps {
  castSlug: string;
  initialCastProfile?: CastProfile | null;
  dramas: Drama[];
  onOpenDrama: (slug: string) => void;
  onDramaSynced: (drama: Drama) => void;
  onBack: () => void;
}

export const CastPage: React.FC<CastPageProps> = ({
  castSlug,
  initialCastProfile = null,
  dramas,
  onOpenDrama,
  onDramaSynced,
  onBack,
}) => {
  const [profile, setProfile] = useState<CastProfile | null>(
    initialCastProfile && initialCastProfile.slug === castSlug ? initialCastProfile : initialCastProfile
  );
  const [loading, setLoading] = useState<boolean>(!initialCastProfile);
  const [syncingTmdbId, setSyncingTmdbId] = useState<number | null>(null);

  useEffect(() => {
    let active = true;
    if (initialCastProfile && (initialCastProfile.slug === castSlug || String(initialCastProfile.id) === castSlug.split('-')[0])) {
      setProfile(initialCastProfile);
      setLoading(false);
      return;
    }

    setLoading(true);
    fetchCastDetails(castSlug).then(res => {
      if (!active) return;
      setProfile(res);
      setLoading(false);
    });

    return () => {
      active = false;
    };
  }, [castSlug, initialCastProfile]);

  const handleOpenCredit = async (credit: CastProfile['credits'][number]) => {
    const existing = dramas.find(d => d.slug === credit.slug || d.tmdbId === credit.tmdbId);
    if (existing) {
      onOpenDrama(existing.slug);
      return;
    }

    setSyncingTmdbId(credit.tmdbId);
    const synced = await fetchDramaDetailsFromTMDB(credit.tmdbId, credit.mediaType);
    setSyncingTmdbId(null);
    if (synced) {
      onDramaSynced(synced);
      onOpenDrama(synced.slug);
    }
  };

  if (loading) {
    return (
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-12">
        <div className="animate-pulse flex flex-col md:flex-row gap-8">
          <div className="w-48 h-72 bg-slate-800 rounded-2xl shrink-0" />
          <div className="flex-1 space-y-4">
            <div className="h-8 bg-slate-800 rounded w-1/3" />
            <div className="h-4 bg-slate-800 rounded w-1/4" />
            <div className="h-24 bg-slate-800 rounded w-full" />
          </div>
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-5xl mx-auto px-4 sm:px-6 py-14 text-center">
        <User className="w-12 h-12 text-slate-500 mx-auto mb-3" />
        <h1 className="text-2xl font-bold text-white mb-2">Cast Profile Not Found</h1>
        <p className="text-sm text-slate-400 mb-6">
          Could not load actor filmography from TMDB for this cast route.
        </p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-sm font-semibold transition-colors cursor-pointer"
        >
          Back to Browse Dramas
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-8">
      {/* Breadcrumb Navigation */}
      <nav aria-label="Breadcrumb" className="flex items-center gap-2 text-xs sm:text-sm text-slate-400 mb-6">
        <a
          href="/"
          onClick={e => {
            e.preventDefault();
            onBack();
          }}
          className="text-blue-500 hover:text-blue-400 font-medium"
        >
          Home
        </a>
        <span>/</span>
        <span>Cast</span>
        <span>/</span>
        <span className="text-slate-200 font-semibold">{profile.name}</span>
      </nav>

      {/* Actor Hero Header */}
      <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 sm:p-8 mb-8 flex flex-col md:flex-row gap-8 items-start">
        <div className="w-44 sm:w-56 shrink-0 mx-auto md:mx-0">
          <div className="aspect-[2/3] rounded-2xl overflow-hidden border-2 border-slate-700 bg-slate-800 shadow-2xl">
            <OptimizedImage
              src={profile.profileImage}
              alt={`${profile.name} Asian Drama Cast Profile`}
              width={400}
              height={600}
              priority
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        <div className="flex-1 space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <span className="bg-blue-600 text-white text-xs font-bold px-2.5 py-0.5 rounded uppercase">
              {profile.knownForDepartment}
            </span>
            <span className="bg-slate-800 text-slate-300 text-xs px-2.5 py-0.5 rounded">
              TMDB ID: {profile.id}
            </span>
          </div>

          <h1 className="text-3xl sm:text-4xl font-extrabold text-white tracking-tight">
            {profile.name}
          </h1>

          <div className="flex flex-wrap gap-4 text-xs sm:text-sm text-slate-300">
            {profile.birthday && (
              <span className="flex items-center gap-1.5">
                <Calendar className="w-4 h-4 text-blue-400" />
                Born: {profile.birthday}
              </span>
            )}
            {profile.placeOfBirth && (
              <span className="flex items-center gap-1.5">
                <MapPin className="w-4 h-4 text-emerald-400" />
                {profile.placeOfBirth}
              </span>
            )}
          </div>

          <div>
            <h2 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-1.5">
              Biography
            </h2>
            <p className="text-sm text-slate-300 leading-relaxed line-clamp-6">
              {profile.biography}
            </p>
          </div>

          <button
            onClick={onBack}
            className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold border border-slate-700 transition-colors cursor-pointer"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to All Dramas</span>
          </button>
        </div>
      </div>

      <AdsterraBanner type="native" className="mb-8" />

      {/* Filmography Credits */}
      <div>
        <div className="flex items-center justify-between pb-3 mb-5 border-b border-slate-800">
          <h2 className="text-xl sm:text-2xl font-bold text-white flex items-center gap-2">
            <Film className="w-5 h-5 text-blue-500" />
            <span>{profile.name} Dramas & Filmography ({profile.credits.length})</span>
          </h2>
          <span className="text-xs text-slate-400">Click any title to stream in Hindi Dubbed</span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
          {profile.credits.map(credit => {
            const isSyncing = syncingTmdbId === credit.tmdbId;
            return (
              <a
                key={`${credit.tmdbId}-${credit.slug}`}
                href={`/drama/${credit.slug}`}
                onClick={e => {
                  e.preventDefault();
                  handleOpenCredit(credit);
                }}
                className="group cursor-pointer flex flex-col"
              >
                <div className="relative aspect-[2/3] rounded-xl overflow-hidden bg-slate-800 border border-slate-800 group-hover:border-blue-500 transition-all">
                  <OptimizedImage
                    src={credit.poster}
                    alt={`${credit.title} starring ${profile.name} Hindi Dubbed`}
                    width={342}
                    height={513}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                  <div className="absolute top-2 right-2 flex items-center gap-1 bg-amber-500/90 text-slate-950 font-black text-[10px] px-1.5 py-0.5 rounded">
                    <Star className="w-3 h-3 fill-slate-950" />
                    <span>{credit.rating}</span>
                  </div>
                  <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                    <div className="w-10 h-10 rounded-full bg-blue-600 text-white flex items-center justify-center shadow-lg">
                      <Play className="w-4 h-4 fill-current ml-0.5" />
                    </div>
                  </div>
                  {isSyncing && (
                    <div className="absolute inset-0 bg-black/80 flex items-center justify-center text-xs font-semibold text-blue-300">
                      Syncing...
                    </div>
                  )}
                </div>
                <h3 className="text-xs sm:text-sm font-semibold text-slate-100 group-hover:text-blue-400 transition-colors line-clamp-1 mt-2">
                  {credit.title}
                </h3>
                <p className="text-[11px] text-slate-400 line-clamp-1">
                  {credit.year} • as {credit.character}
                </p>
              </a>
            );
          })}
        </div>
      </div>
    </div>
  );
};
