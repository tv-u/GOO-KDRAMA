import type { AudioLanguageCode } from '../types/drama.ts';

export interface HlxAudioLanguageOption {
  code: AudioLanguageCode;
  label: string;
  shortLabel: string;
  audioName: string;
  flag: string;
  aliases: string[];
}

export const HLX_AUDIO_LANGUAGES: HlxAudioLanguageOption[] = [
  {
    code: 'ko',
    label: 'Korean (Original)',
    shortLabel: 'Korean',
    audioName: 'korean',
    flag: '🇰🇷',
    aliases: ['ko', 'kor', 'korean', 'orig', 'original'],
  },
  {
    code: 'hi',
    label: 'Hindi Dub',
    shortLabel: 'Hindi',
    audioName: 'hindi',
    flag: '🇮🇳',
    aliases: ['hi', 'hin', 'hindi'],
  },
  {
    code: 'en',
    label: 'English Dub',
    shortLabel: 'English',
    audioName: 'english',
    flag: '🇬🇧',
    aliases: ['en', 'eng', 'english'],
  },
  {
    code: 'ur',
    label: 'Urdu',
    shortLabel: 'Urdu',
    audioName: 'urdu',
    flag: '🇵🇰',
    aliases: ['ur', 'urd', 'urdu'],
  },
  {
    code: 'ta',
    label: 'Tamil',
    shortLabel: 'Tamil',
    audioName: 'tamil',
    flag: '🇮🇳',
    aliases: ['ta', 'tam', 'tamil'],
  },
  {
    code: 'te',
    label: 'Telugu',
    shortLabel: 'Telugu',
    audioName: 'telugu',
    flag: '🇮🇳',
    aliases: ['te', 'tel', 'telugu'],
  },
];

export interface HlxServerNode {
  id: number;
  key: string;
  name: string;
  qualityTag: string;
  mode: 'hlx-direct' | 'hlx-relay';
  supportsRelay: boolean;
  tvUrl: (ctx: HlxRouteContext) => string;
  movieUrl: (ctx: HlxRouteContext) => string;
}

export interface HlxRouteContext {
  tmdbId: number | string;
  imdbId?: string;
  season: number;
  episode: number;
  lang: AudioLanguageCode;
  mediaType: 'tv' | 'movie';
  title?: string;
}

export const HLX_SERVERS: HlxServerNode[] = [
  {
    id: 1,
    key: 'hls-proxy',
    name: 'HLS.proxy',
    qualityTag: 'AUTO HLS',
    mode: 'hlx-direct',
    supportsRelay: true,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://vidsrc.buzz/embed/tv/${tmdbId}/${season}/${episode}?lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://vidsrc.buzz/embed/movie/${tmdbId}?lang=${lang}`,
  },
  {
    id: 2,
    key: '2embed',
    name: '2Embed',
    qualityTag: 'HD',
    mode: 'hlx-direct',
    supportsRelay: true,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://vidsrc.buzz/embed/tv/${tmdbId}/${season}/${episode}?lang=${lang}&src=2embed`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://vidsrc.buzz/embed/movie/${tmdbId}?lang=${lang}&src=2embed`,
  },
  {
    id: 3,
    key: 'multiembed',
    name: 'MultiEmbed',
    qualityTag: 'MULTI',
    mode: 'hlx-relay',
    supportsRelay: false,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&lang=${lang}`,
  },
  {
    id: 4,
    key: 'vipstream-y',
    name: 'vipstream-Y',
    qualityTag: 'MULTI',
    mode: 'hlx-relay',
    supportsRelay: false,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&server=vipstream-Y&lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&server=vipstream-Y&lang=${lang}`,
  },
  {
    id: 5,
    key: 'vipstream-f',
    name: 'vipstream-F',
    qualityTag: '1080p',
    mode: 'hlx-relay',
    supportsRelay: false,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&server=vipstream-F&lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&server=vipstream-F&lang=${lang}`,
  },
  {
    id: 6,
    key: 'vipstream-r',
    name: 'vipstream-R',
    qualityTag: '1080p',
    mode: 'hlx-relay',
    supportsRelay: false,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&server=vipstream-R&lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&server=vipstream-R&lang=${lang}`,
  },
  {
    id: 7,
    key: 'gdrive',
    name: 'GDrive',
    qualityTag: 'HD',
    mode: 'hlx-relay',
    supportsRelay: false,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&server=GDrive&host=gdrive&lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&server=GDrive&host=gdrive&lang=${lang}`,
  },
  {
    id: 8,
    key: 'doodstream',
    name: 'doodstream',
    qualityTag: '1080p',
    mode: 'hlx-relay',
    supportsRelay: false,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&server=doodstream&host=doodstream&lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&server=doodstream&host=doodstream&lang=${lang}`,
  },
  {
    id: 9,
    key: 'mixdrop',
    name: 'mixdrop',
    qualityTag: 'HD',
    mode: 'hlx-relay',
    supportsRelay: false,
    tvUrl: ({ tmdbId, season, episode, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&s=${season}&e=${episode}&server=mixdrop&host=mixdrop&lang=${lang}`,
    movieUrl: ({ tmdbId, lang }) =>
      `https://multiembed.mov/?video_id=${tmdbId}&tmdb=1&server=mixdrop&host=mixdrop&lang=${lang}`,
  },
];

export function buildHlxDirectUrl(server: HlxServerNode, ctx: HlxRouteContext): string {
  return ctx.mediaType === 'movie' ? server.movieUrl(ctx) : server.tvUrl(ctx);
}

export function buildHlxSyncedIframeSrc(
  directUrl: string,
  server: HlxServerNode,
  useRelayShield: boolean,
  isStaticHost: boolean
): string {
  if (!directUrl) return '';
  if (!isStaticHost && useRelayShield && server.supportsRelay) {
    return `/api/player-relay?url=${encodeURIComponent(directUrl)}`;
  }
  return directUrl;
}

export function getAudioLanguageMeta(code: AudioLanguageCode): HlxAudioLanguageOption {
  return HLX_AUDIO_LANGUAGES.find(l => l.code === code) || HLX_AUDIO_LANGUAGES[0];
}
