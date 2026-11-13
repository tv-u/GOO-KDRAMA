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

export type AudioLanguageCode = 'hi' | 'ko' | 'ta' | 'te' | 'en';

export interface TmdbEpisodeMeta {
  title: string;
  episodeName: string;
  overview: string;
  backdrop: string;
  runtime?: number;
  spokenLanguages: { iso_639_1: string; english_name: string; name: string }[];
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
  latestEpisode: number;
  season?: number;
  masterHlsUrl?: string;
  cast?: CastMember[];
  updatedAt?: string;
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

export type DramaCategory = 'all' | 'trending' | 'korean' | 'chinese' | 'japanese' | 'indian';

export type SortOption = 'latest' | 'views' | 'rating' | 'title';

export type AppView = 'home' | 'watch' | 'detail' | 'genre' | 'cast' | 'static';
