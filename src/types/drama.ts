export interface CastMember {
  id: number;
  slug: string;
  name: string;
  character: string;
  profilePath: string;
  popularity?: number;
}

export interface CastProfile {
  id: number;
  slug: string;
  name: string;
  biography: string;
  birthday?: string;
  placeOfBirth?: string;
  knownForDepartment: string;
  profileImage: string;
  credits: {
    tmdbId: number;
    title: string;
    slug: string;
    character: string;
    year: number;
    poster: string;
    rating: number;
    mediaType: 'tv' | 'movie';
  }[];
}

export interface DramaFAQ {
  question: string;
  answer: string;
}

export type AudioLanguageCode = 'hi' | 'ko' | 'ta' | 'te' | 'en' | 'ur';

export interface TmdbEpisodeMeta {
  title: string;
  episodeName: string;
  overview: string;
  backdrop: string;
  runtime?: number;
  imdbId?: string;
  youtubeKey?: string;
  spokenLanguages: { iso_639_1: string; english_name: string; name: string }[];
}

export interface SeasonSummary {
  seasonNumber: number;
  name: string;
  episodeCount: number;
  airDate?: string;
  poster?: string;
}

export interface EpisodeDetail {
  seasonNumber: number;
  episodeNumber: number;
  name: string;
  overview: string;
  airDate?: string;
  stillUrl?: string;
  runtime?: number;
}

export interface CustomStreamSource {
  id: string;
  dramaSlug: string;
  season: number;
  episode: number;
  label: string;
  url: string;
  format: 'hls' | 'dash' | 'mp4' | 'iframe';
  language?: AudioLanguageCode;
  active: boolean;
  createdAt: string;
}

export interface Drama {
  id: string;
  slug: string;
  tmdbId: number;
  title: string;
  hindiTitle: string;
  country: 'Korean' | 'Chinese' | 'Japanese' | 'Indian' | 'Taiwanese' | string;
  year: number;
  rating: number;
  views: string;
  duration: string;
  totalEpisodes: number;
  genres: string[];
  overview: string;
  poster: string;
  backdrop: string;
  status: 'Completed' | 'Ongoing' | 'Upcoming';
  type: 'tv' | 'movie';
  language: string;
  hindiOnly?: boolean;
  imdbId?: string;
  tvdbId?: number;
  youtubeKey?: string;
  latestEpisode: number;
  season?: number;
  seasons?: SeasonSummary[];
  masterHlsUrl?: string;
  cast?: CastMember[];
  updatedAt?: string;
  popularityScore?: number;
}

export interface DramaComment {
  id: string;
  dramaSlug: string;
  episodeNumber?: number;
  userName: string;
  userAvatar?: string;
  content: string;
  createdAt: string;
  likes: number;
}

export interface DramaRequest {
  id: string;
  title: string;
  country: string;
  year?: string;
  notes?: string;
  createdAt: string;
  status: 'Pending' | 'Added' | 'Reviewing';
}

export type AnalyticsEventType =
  | 'page_view'
  | 'poster_click'
  | 'episode_play'
  | 'source_health'
  | 'playback_error';

export interface AnalyticsEventPayload {
  type: AnalyticsEventType;
  sessionId?: string;
  path?: string;
  dramaSlug?: string;
  dramaTitle?: string;
  episode?: number;
  serverId?: number;
  serverName?: string;
  ok?: boolean;
  latencyMs?: number;
  reason?: string;
}

export interface SyncLogEntry {
  id: string;
  timestamp: string;
  trigger: 'manual' | 'scheduled' | 'api';
  added: number;
  updated: number;
  episodesDiscovered: number;
  duplicatesSkipped: number;
  errors: string[];
}

export interface AdminOverviewData {
  catalog: {
    totalTitles: number;
    totalMovies: number;
    totalDramas: number;
    totalEpisodes: number;
    hindiOnlyCount: number;
    missingMetadataCount: number;
    duplicateTmdbCount: number;
  };
  traffic: {
    totalVisits: number;
    uniqueVisitors: number;
    totalPosterClicks: number;
    totalEpisodePlays: number;
  };
  topTitles: {
    slug: string;
    title: string;
    visits: number;
    posterClicks: number;
    episodePlays: number;
  }[];
  popularEpisodes: {
    key: string;
    dramaSlug: string;
    dramaTitle: string;
    episode: number;
    plays: number;
  }[];
  sourceHealth: {
    serverId: number;
    serverName: string;
    checks: number;
    successes: number;
    failures: number;
    avgLatencyMs: number;
    lastError?: string;
    lastCheckedAt?: string;
  }[];
  failedReports: {
    id: string;
    timestamp: string;
    dramaSlug: string;
    episode: number;
    serverName: string;
    reason: string;
  }[];
  syncLogs: SyncLogEntry[];
  manualSources: CustomStreamSource[];
}

export type DramaCategory =
  | 'all'
  | 'hindi-dubbed'
  | 'trending'
  | 'korean'
  | 'chinese'
  | 'japanese'
  | 'indian'
  | 'movies'
  | 'anime';

export type SortOption = 'latest' | 'views' | 'rating' | 'title';

export type AppView = 'home' | 'watch' | 'detail' | 'movie' | 'movies' | 'genre' | 'cast' | 'static' | 'library' | 'admin';
