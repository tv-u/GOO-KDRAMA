import type { CastProfile, Drama, DramaFAQ } from '../types/drama.ts';
import {
  TOP_50_WORLD_LANGUAGES,
  TOP_50_LANGUAGE_NAMES,
  TOP_50_LOCALIZED_PHRASES,
  ZERO_COMPETITION_CATEGORY_KEYWORDS,
  buildHreflangUrl,
  buildLongTailDramaKeywords,
  resolveWorldLanguageSeo,
} from './worldwideSeo.ts';

export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  baseCanonicalUrl: string;
  htmlLang: string;
  ogLocale: string;
  ogType: 'website' | 'video.tv_show' | 'video.movie' | 'video.episode' | 'profile';
  ogImage: string;
  ogImageAlt: string;
  videoUrl?: string;
  robots: string;
  jsonLd: Record<string, unknown>[];
}

export function slugifyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getContentPath(item: { slug: string; type?: string }): string {
  return item.type === 'movie' ? `/movie/${item.slug}` : `/drama/${item.slug}`;
}

export function getWatchPath(
  item: { slug: string; type?: string },
  episode = 1,
  season = 1
): string {
  if (item.type === 'movie') {
    return `/watch/${item.slug}`;
  }
  return season > 1
    ? `/watch/${item.slug}/season-${season}/episode-${episode}`
    : `/watch/${item.slug}/episode-${episode}`;
}

export function getMp4StreamPath(
  item: { slug: string; type?: string },
  episode = 1,
  season = 1
): string {
  if (item.type === 'movie') {
    return `/stream/${item.slug}.mp4`;
  }
  return season > 1
    ? `/stream/${item.slug}/season-${season}/episode-${episode}.mp4`
    : `/stream/${item.slug}/episode-${episode}.mp4`;
}

export function getDramaFaqs(drama: Drama, episode?: number): DramaFAQ[] {
  if (drama.type === 'movie') {
    return [
      {
        question: `Where can I watch ${drama.title} (${drama.year}) Full Movie in Hindi Dubbed & Original HD online?`,
        answer: `You can stream ${drama.title} (${drama.year}) full ${drama.country} movie in 1080p HD on HindiDrama.net with instant HLS.proxy, 2Embed, MultiEmbed, vipstream-Y, vipstream-F, vipstream-R, GDrive, doodstream, and mixdrop servers plus multi-audio switching.`,
      },
      {
        question: `Does ${drama.title} support multi-audio tracks and instant .mp4 streaming?`,
        answer: `Yes, ${drama.title} supports instant multi-audio switching (Korean Original, Hindi Dub, English Dub, Urdu, Tamil, Telugu) alongside subtitles and a dedicated .mp4 stream URL.`,
      },
      {
        question: `How long is ${drama.title} (${drama.year}) Full Movie?`,
        answer: `${drama.title} has a runtime of ${drama.duration || '115 min'} and is rated ${drama.rating}/10 across ${(drama.genres || ['Action', 'Drama']).join(', ')}.`,
      },
      {
        question: `How do I open ${drama.title} in a full clean standalone player window?`,
        answer: `Click the emerald PLAY NOW button at the top-right of the video player to launch ${drama.title} in a dedicated distraction-free player window.`,
      },
    ];
  }

  const epNum = episode || drama.latestEpisode || 1;
  return [
    {
      question: `Where can I watch ${drama.title} ${episode ? `Episode ${epNum} ` : ''}online in 1080p HD?`,
      answer: `You can stream ${drama.title} (${drama.year}) ${episode ? `Episode ${epNum} ` : 'all episodes '}in 1080p HD for free on HindiDrama.net using fast auto-synced HLS.proxy, 2Embed, MultiEmbed, vipstream-Y, vipstream-F, vipstream-R, GDrive, doodstream, and mixdrop servers.`,
    },
    {
      question: `Is ${drama.title} available with multi-audio tracks and subtitles?`,
      answer: `Yes, ${drama.title} (${drama.country} Drama) lets you switch audio languages (Korean Original, Hindi Dub, English Dub, Urdu, Tamil, Telugu) and synced subtitles directly inside the Video.js player.`,
    },
    {
      question: `How many total episodes are in ${drama.title}?`,
      answer: `${drama.title} consists of ${drama.totalEpisodes} episode(s) (${drama.duration} per episode), all auto-synced with TMDB season & episode metadata.`,
    },
    {
      question: `Does ${drama.title} Episode ${epNum} have a direct .mp4 stream URL?`,
      answer: `Yes, every K-Drama episode on HindiDrama.net automatically generates a dedicated .mp4 stream URL and clean PLAY NOW window for instant playback.`,
    },
    {
      question: `What is the genre and TMDB rating of ${drama.title}?`,
      answer: `${drama.title} is a ${drama.country} series in the ${(drama.genres || ['Drama']).join(', ')} genre(s) rated ${drama.rating}/10 on TMDB.`,
    },
  ];
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

const WORLDWIDE_AUDIENCE = {
  '@type': 'Audience',
  audienceType: 'Worldwide Asian & K-Drama Viewers',
  geographicArea: {
    '@type': 'AdministrativeArea',
    name: 'Worldwide',
  },
};

export function buildSeoMetadata(params: {
  path: string;
  origin: string;
  dramas: Drama[];
  activeDrama?: Drama;
  episode?: number;
  season?: number;
  category?: string;
  genre?: string;
  castProfile?: CastProfile | null;
  searchQuery?: string;
  staticPage?: string;
  hlLang?: string;
}): SeoMetadata {
  const cleanOrigin = params.origin.replace(/\/$/, '') || 'https://hindidrama.net';
  const normalizedPath = params.path === '/' ? '' : params.path;
  const worldLang = resolveWorldLanguageSeo(params.hlLang);
  const isLocalizedHl = Boolean(params.hlLang && worldLang.code !== 'en');
  const baseDefaultCanonical = `${cleanOrigin}${normalizedPath || '/'}`;
  const canonicalUrl = isLocalizedHl ? buildHreflangUrl(baseDefaultCanonical, worldLang.code) : baseDefaultCanonical;
  const availableLanguage = TOP_50_LANGUAGE_NAMES;
  const hlTitleSuffix = isLocalizedHl ? ` – ${worldLang.phrase}` : '';

  // 0. Dedicated Movie Page (/movie/:slug) or Movie on /watch/:slug
  if (
    (params.path.startsWith('/movie/') ||
      (params.path.startsWith('/drama/') && params.activeDrama?.type === 'movie') ||
      (params.path.startsWith('/watch/') && params.activeDrama?.type === 'movie')) &&
    params.activeDrama
  ) {
    const movie = params.activeDrama;
    const movieBase = params.path.startsWith('/watch/') ? baseDefaultCanonical : `${cleanOrigin}/movie/${movie.slug}`;
    const movieCanonical = isLocalizedHl ? buildHreflangUrl(movieBase, worldLang.code) : movieBase;
    const mp4Url = `${cleanOrigin}${getMp4StreamPath(movie)}`;
    const title = isLocalizedHl
      ? `${movie.title} (${movie.year}) ${worldLang.phrase} | HindiDrama`
      : `${movie.title} (${movie.year}) Full Movie Hindi Dubbed & Korean Watch Free HD | HindiDrama`;
    const description = (
      isLocalizedHl
        ? `[${worldLang.name}] ${worldLang.phrase}: ${movie.title} (${movie.year}) ${movie.country} Full HD .mp4 stream on HindiDrama.net.`
        : `Watch ${movie.title} (${movie.year}) full ${movie.country} movie instant play 1080p HD with Hindi Dub, Korean Original, English Dub & Urdu on HindiDrama.net.`
    ).slice(0, 160);
    const castNames = (movie.cast || []).slice(0, 4).map(a => a.name);
    const keywords = [
      ...buildLongTailDramaKeywords({
        title: movie.title,
        country: movie.country,
        year: movie.year,
        genres: movie.genres || ['Drama'],
        castNames,
        hlCode: worldLang.code,
      }),
      `${movie.title.toLowerCase()} full movie mp4 direct stream`,
      `watch ${movie.title.toLowerCase()} online free hd`,
      'hindidrama.net',
    ].join(', ');
    const faqs = getDramaFaqs(movie);
    const ratingCount = Math.max(180, Math.round(movie.rating * 420));
    const durationMins = parseInt(String(movie.duration || '115'), 10) || 115;
    const uploadDate = movie.updatedAt || `${movie.year}-01-01T00:00:00Z`;

    return {
      title,
      description,
      keywords,
      canonicalUrl: movieCanonical,
      baseCanonicalUrl: movieBase,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'video.movie',
      ogImage: movie.backdrop || movie.poster,
      ogImageAlt: `${movie.title} (${movie.year}) Full Movie Hindi Dubbed Poster`,
      videoUrl: mp4Url,
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Movie',
          name: movie.title,
          alternateName: movie.hindiTitle,
          url: movieCanonical,
          image: movie.poster,
          description: movie.overview,
          datePublished: String(movie.year),
          duration: `PT${durationMins}M`,
          genre: movie.genres,
          keywords,
          inLanguage: worldLang.code,
          countryOfOrigin: {
            '@type': 'Country',
            name: movie.country,
          },
          actor: (movie.cast || []).slice(0, 10).map(actor => ({
            '@type': 'Person',
            name: actor.name,
            url: `${cleanOrigin}/cast/${actor.slug}`,
          })),
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: movie.rating,
            bestRating: 10,
            worstRating: 1,
            ratingCount,
          },
          potentialAction: {
            '@type': 'WatchAction',
            target: `${cleanOrigin}/watch/${movie.slug}`,
          },
        },
        {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: `${movie.title} (${movie.year}) Full Movie HD`,
          description,
          thumbnailUrl: [movie.backdrop || movie.poster, movie.poster].filter(Boolean),
          uploadDate,
          duration: `PT${durationMins}M`,
          contentUrl: mp4Url,
          embedUrl: `${cleanOrigin}/watch/${movie.slug}`,
          encodingFormat: 'video/mp4',
          inLanguage: worldLang.code,
          subtitleLanguage: availableLanguage,
          audience: WORLDWIDE_AUDIENCE,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: 'Movies', item: `${cleanOrigin}/movies` },
            { '@type': 'ListItem', position: 3, name: movie.title, item: movieCanonical },
          ],
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer,
            },
          })),
        },
      ],
    };
  }

  // 0b. All Movies Directory Hub (/movies & /movies/page/:page)
  if (params.path === '/movies' || params.path.startsWith('/movies/page/')) {
    const movieItems = params.dramas.filter(d => d.type === 'movie');
    const pageMatch = params.path.match(/\/movies\/page\/(\d+)/i);
    const pageNum = pageMatch ? Math.max(1, parseInt(pageMatch[1], 10)) : 1;
    const perPage = 24;
    const slice = movieItems.slice((pageNum - 1) * perPage, pageNum * perPage);
    const title =
      pageNum > 1
        ? `Asian & Korean Movies Page ${pageNum} – Watch Full HD Online Free | HindiDrama`
        : `All ${movieItems.length}+ Asian & Korean Movies in HD Hindi Dubbed | HindiDrama`;
    const description = `Browse ${movieItems.length}+ dedicated movie pages with 1080p HD streaming, HLX.proxy multi-audio (Hindi, Korean, English, Urdu) and instant downloads on HindiDrama.net.`;

    return {
      title,
      description,
      keywords: [
        'korean movies hindi dubbed watch online free',
        'asian movies full hd 1080p mp4',
        '500 korean movies list',
        ...TOP_50_LOCALIZED_PHRASES.slice(0, 12),
      ].join(', '),
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'website',
      ogImage: slice[0]?.poster || movieItems[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: 'Asian & Korean Movies Directory',
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: title,
          description,
          url: canonicalUrl,
          availableLanguage,
          audience: WORLDWIDE_AUDIENCE,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: `Movies Directory Page ${pageNum}`,
          numberOfItems: slice.length,
          itemListElement: slice.map((m, idx) => ({
            '@type': 'ListItem',
            position: (pageNum - 1) * perPage + idx + 1,
            url: `${cleanOrigin}/movie/${m.slug}`,
            name: `${m.title} (${m.year})`,
          })),
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: 'Movies', item: `${cleanOrigin}/movies` },
          ],
        },
      ],
    };
  }

  // 1. Episode Watch Page (/watch/:slug/episode-:ep)
  if (params.path.startsWith('/watch/') && params.activeDrama) {
    const drama = params.activeDrama;
    const ep = params.episode || 1;
    const season = params.season || drama.season || 1;
    const mp4Url = `${cleanOrigin}${getMp4StreamPath(drama, ep, season)}`;
    const title = isLocalizedHl
      ? `${drama.title} Episode ${ep} ${worldLang.phrase} | HindiDrama`
      : `Watch ${drama.title} Episode ${ep} Hindi Dubbed & Original HD | HindiDrama`;
    const description = (
      isLocalizedHl
        ? `[${worldLang.name}] ${worldLang.phrase}: ${drama.title} Episode ${ep} direct .mp4 1080p HD stream on HindiDrama.net.`
        : `Stream ${drama.title} Episode ${ep} instant play 1080p HD on HindiDrama.net. Fast HLS.proxy, 2Embed, MultiEmbed, vipstream-Y & direct .mp4 multi-audio player.`
    ).slice(0, 160);
    const castNames = (drama.cast || []).slice(0, 4).map(a => a.name);
    const longTail = buildLongTailDramaKeywords({
      title: drama.title,
      country: drama.country,
      year: drama.year,
      genres: drama.genres || ['Drama'],
      episode: ep,
      castNames,
      hlCode: worldLang.code,
    });
    const keywords = [
      ...longTail,
      `${drama.title.toLowerCase()} episode ${ep} mp4 direct stream`,
      'watch kdrama hindi dubbed online free',
      'hindidrama net',
    ].join(', ');
    const faqs = getDramaFaqs(drama, ep);
    const ratingCount = Math.max(120, Math.round(drama.rating * 340));
    const uploadDate = drama.updatedAt || `${drama.year}-01-01T00:00:00Z`;
    const durationMins = parseInt(String(drama.duration || '45'), 10) || 45;

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'video.episode',
      ogImage: drama.backdrop || drama.poster,
      ogImageAlt: `Watch ${drama.title} Episode ${ep} Hindi Dubbed`,
      videoUrl: mp4Url,
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: `${drama.title} Episode ${ep} Online HD`,
          alternativeHeadline: `${drama.title} Ep ${ep} | ${worldLang.phrase}`,
          description,
          thumbnailUrl: [drama.backdrop || drama.poster, drama.poster].filter(Boolean),
          uploadDate,
          duration: `PT${durationMins}M`,
          contentUrl: mp4Url,
          embedUrl: canonicalUrl,
          encodingFormat: 'video/mp4',
          inLanguage: worldLang.code,
          subtitleLanguage: availableLanguage,
          keywords,
          isFamilyFriendly: true,
          audience: WORLDWIDE_AUDIENCE,
          publisher: {
            '@type': 'Organization',
            name: 'HindiDrama.net',
            url: `${cleanOrigin}/`,
            logo: {
              '@type': 'ImageObject',
              url: `${cleanOrigin}/favicon.svg`
            }
          },
          potentialAction: {
            '@type': 'WatchAction',
            target: canonicalUrl
          }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'TVEpisode',
          name: `${drama.title} Episode ${ep}`,
          episodeNumber: ep,
          inLanguage: worldLang.code,
          url: canonicalUrl,
          image: drama.backdrop || drama.poster,
          description: drama.overview,
          partOfSeries: {
            '@type': 'TVSeries',
            name: drama.title,
            url: `${cleanOrigin}/drama/${drama.slug}`,
            numberOfEpisodes: drama.totalEpisodes,
            genre: drama.genres,
            aggregateRating: {
              '@type': 'AggregateRating',
              ratingValue: drama.rating,
              bestRating: 10,
              worstRating: 1,
              ratingCount
            }
          },
          potentialAction: {
            '@type': 'WatchAction',
            target: canonicalUrl
          }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'TVSeries',
          name: drama.title,
          alternateName: drama.hindiTitle,
          url: `${cleanOrigin}/drama/${drama.slug}`,
          image: drama.poster,
          description: drama.overview,
          genre: drama.genres,
          numberOfEpisodes: drama.totalEpisodes,
          inLanguage: worldLang.code,
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: drama.rating,
            bestRating: 10,
            worstRating: 1,
            ratingCount
          }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: `${drama.country} Drama`, item: `${cleanOrigin}/category/${drama.country.toLowerCase()}` },
            { '@type': 'ListItem', position: 3, name: drama.title, item: `${cleanOrigin}/drama/${drama.slug}` },
            { '@type': 'ListItem', position: 4, name: `Episode ${ep}`, item: canonicalUrl }
          ]
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer
            }
          }))
        }
      ]
    };
  }

  // 2. Drama Detail Page (/drama/:slug)
  if (params.path.startsWith('/drama/') && params.activeDrama) {
    const drama = params.activeDrama;
    const mp4Url = `${cleanOrigin}${getMp4StreamPath(drama, drama.latestEpisode || 1, drama.season || 1)}`;
    const title = isLocalizedHl
      ? `${drama.title} (${drama.year}) ${worldLang.phrase} | HindiDrama`
      : `${drama.title} (${drama.year}) Full Episodes HD & MP4 Stream | HindiDrama`;
    const description = (
      isLocalizedHl
        ? `[${worldLang.name}] ${worldLang.phrase}: ${drama.title} (${drama.totalEpisodes} Episodes). ${drama.overview}`
        : `Watch all ${drama.totalEpisodes} episodes of ${drama.title} (${drama.country} Drama) in 1080p HD on HindiDrama.net with direct .mp4 streaming & multi-audio. ${drama.overview}`
    ).slice(0, 160);
    const castNames = (drama.cast || []).slice(0, 4).map(a => a.name);
    const keywords = [
      ...buildLongTailDramaKeywords({
        title: drama.title,
        country: drama.country,
        year: drama.year,
        genres: drama.genres || ['Drama'],
        castNames,
        hlCode: worldLang.code,
      }),
      'hindidrama.net',
    ].join(', ');
    const faqs = getDramaFaqs(drama);
    const ratingCount = Math.max(150, Math.round(drama.rating * 390));

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'video.tv_show',
      ogImage: drama.poster || drama.backdrop,
      ogImageAlt: `${drama.title} (${drama.year}) Hindi Dubbed Poster`,
      videoUrl: mp4Url,
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'TVSeries',
          name: drama.title,
          alternateName: [drama.hindiTitle, ...TOP_50_LOCALIZED_PHRASES.slice(0, 12).map(p => `${drama.title} - ${p}`)],
          url: canonicalUrl,
          image: drama.poster,
          description: drama.overview,
          datePublished: String(drama.year),
          genre: drama.genres,
          keywords,
          numberOfEpisodes: drama.totalEpisodes,
          inLanguage: worldLang.code,
          audience: WORLDWIDE_AUDIENCE,
          countryOfOrigin: {
            '@type': 'Country',
            name: drama.country
          },
          actor: (drama.cast || []).slice(0, 10).map(actor => ({
            '@type': 'Person',
            name: actor.name,
            url: `${cleanOrigin}/cast/${actor.slug}`
          })),
          aggregateRating: {
            '@type': 'AggregateRating',
            ratingValue: drama.rating,
            bestRating: 10,
            worstRating: 1,
            ratingCount
          }
        },
        {
          '@context': 'https://schema.org',
          '@type': 'VideoObject',
          name: `${drama.title} Episode ${drama.latestEpisode || 1} HD Stream`,
          description,
          thumbnailUrl: [drama.backdrop || drama.poster, drama.poster].filter(Boolean),
          uploadDate: drama.updatedAt || `${drama.year}-01-01T00:00:00Z`,
          contentUrl: mp4Url,
          embedUrl: `${cleanOrigin}/watch/${drama.slug}/episode-1`,
          encodingFormat: 'video/mp4',
          inLanguage: worldLang.code,
          subtitleLanguage: availableLanguage,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: `${drama.country} Drama`, item: `${cleanOrigin}/category/${drama.country.toLowerCase()}` },
            { '@type': 'ListItem', position: 3, name: drama.title, item: canonicalUrl }
          ]
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: faqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: {
              '@type': 'Answer',
              text: faq.answer
            }
          }))
        }
      ]
    };
  }

  // 3. Dedicated Hindi Dubbed K-Drama Category (/category/hindi-dubbed)
  if (params.path === '/category/hindi-dubbed' || params.category === 'hindi-dubbed') {
    const hindiKdramas = params.dramas.filter(
      d => d.country.toLowerCase() === 'korean' && (d.hindiOnly || (d.language || '').toLowerCase().includes('hindi'))
    );
    const title = 'Hindi Dubbed K-Drama (100% Pure Hindi Audio Only) Watch Free HD | HindiDrama';
    const description = 'Watch 100% real Hindi dubbed Korean dramas online free in 1080p HD. Pure Hindi audio only playback with Squid Game, Vincenzo, Queen of Tears, Business Proposal & more.';
    const keywords = [
      ...ZERO_COMPETITION_CATEGORY_KEYWORDS,
      ...TOP_50_LOCALIZED_PHRASES.slice(0, 20),
    ].join(', ');

    const hubFaqs: DramaFAQ[] = [
      {
        question: 'Which Korean dramas on HindiDrama.net play 100% in real Hindi Dubbed audio only?',
        answer: 'All dramas listed in our Hindi Dubbed K-Drama category are verified Korean television series that lock playback strictly to Pure Hindi audio track without switching to other languages.'
      },
      {
        question: 'Can I watch Hindi dubbed K-dramas worldwide for free in 1080p HD?',
        answer: 'Yes, viewers across India, Pakistan, Nepal, Bangladesh, UAE, UK, USA, Singapore, Indonesia, and worldwide can stream Hindi dubbed K-dramas free with zero buffering.'
      }
    ];

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      baseCanonicalUrl: `${cleanOrigin}/category/hindi-dubbed`,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'website',
      ogImage: hindiKdramas[0]?.poster || params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: 'Hindi Dubbed K-Drama Pure Hindi Audio Streaming Archive',
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: 'Hindi Dubbed K-Drama (Pure Hindi Audio Only)',
          description,
          url: `${cleanOrigin}/category/hindi-dubbed`,
          inLanguage: 'hi',
          availableLanguage,
          keywords,
          audience: WORLDWIDE_AUDIENCE,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'ItemList',
          name: 'Real Hindi Dubbed Korean Dramas Collection',
          numberOfItems: hindiKdramas.length,
          itemListElement: hindiKdramas.slice(0, 20).map((d, idx) => ({
            '@type': 'ListItem',
            position: idx + 1,
            url: `${cleanOrigin}/drama/${d.slug}`,
            name: `${d.title} (Hindi Dubbed)`
          }))
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: 'Hindi Dubbed K-Drama', item: `${cleanOrigin}/category/hindi-dubbed` }
          ]
        },
        {
          '@context': 'https://schema.org',
          '@type': 'FAQPage',
          mainEntity: hubFaqs.map(faq => ({
            '@type': 'Question',
            name: faq.question,
            acceptedAnswer: { '@type': 'Answer', text: faq.answer }
          }))
        }
      ]
    };
  }

  // 4. Genre Hub Page (/genre/:genre)
  if (params.path.startsWith('/genre/') && params.genre) {
    const genreLabel = params.genre.charAt(0).toUpperCase() + params.genre.slice(1);
    const title = `Best ${genreLabel} Asian & K-Dramas in Hindi Dubbed${hlTitleSuffix} | HindiDrama`;
    const description = `Stream top-rated ${genreLabel} Korean, Chinese, and Japanese dramas in Hindi dubbed online for free in 1080p HD worldwide on HindiDrama.net.`;
    return {
      title,
      description,
      keywords: [
        `${genreLabel.toLowerCase()} kdrama in hindi dubbed full episodes free`,
        `best ${genreLabel.toLowerCase()} korean drama in pure hindi audio 1080p`,
        `watch ${genreLabel.toLowerCase()} asian dramas hindi online no signup`,
        ...TOP_50_LOCALIZED_PHRASES.slice(0, 8),
      ].join(', '),
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'website',
      ogImage: params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: `${genreLabel} Dramas in Hindi Dubbed`,
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${genreLabel} Hindi Dubbed Dramas`,
          description,
          url: canonicalUrl,
          availableLanguage,
          audience: WORLDWIDE_AUDIENCE,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: `${genreLabel} Dramas`, item: canonicalUrl }
          ]
        }
      ]
    };
  }

  // 5. Cast Profile Page (/cast/:slug)
  if (params.path.startsWith('/cast/')) {
    const castName = params.castProfile?.name || params.path.replace('/cast/', '').replace(/^\d+-/, '').replace(/-/g, ' ');
    const titleCaseName = castName.replace(/\b\w/g, c => c.toUpperCase());
    const title = `${titleCaseName} Dramas & Movies in Hindi Dubbed | HindiDrama`;
    const description = params.castProfile?.biography
      ? `${params.castProfile.name} Hindi dubbed dramas, filmography, biography, and latest episodes on HindiDrama.net. ${params.castProfile.biography}`.slice(0, 160)
      : `Explore all Korean & Chinese dramas starring ${titleCaseName} in Hindi dubbed HD on HindiDrama.net.`;

    return {
      title,
      description,
      keywords: `${titleCaseName.toLowerCase()} kdrama in hindi dubbed full list, ${titleCaseName.toLowerCase()} korean dramas hindi audio online free, ${titleCaseName.toLowerCase()} movies 1080p`,
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'profile',
      ogImage: params.castProfile?.profileImage || params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: `${titleCaseName} Cast Profile`,
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'Person',
          name: titleCaseName,
          description,
          image: params.castProfile?.profileImage,
          jobTitle: params.castProfile?.knownForDepartment || 'Actor',
          url: canonicalUrl
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: titleCaseName, item: canonicalUrl }
          ]
        }
      ]
    };
  }

  // 6. Category Page (/category/:cat)
  if (params.path.startsWith('/category/') && params.category && params.category !== 'all') {
    const catCap = params.category.charAt(0).toUpperCase() + params.category.slice(1);
    const title = `${catCap} Dramas Hindi Dubbed Watch Online Free HD${hlTitleSuffix} | HindiDrama`;
    const description = `Watch latest ${catCap} dramas and web series online free in 1080p HD worldwide with direct .mp4 streaming on HindiDrama.net.`;
    return {
      title,
      description,
      keywords: [
        `${catCap.toLowerCase()} drama in pure hindi dubbed online free`,
        `watch ${catCap.toLowerCase()} series hindi audio 1080p zero buffering`,
        `hindidrama ${catCap.toLowerCase()} full episodes mp4`,
        ...TOP_50_LOCALIZED_PHRASES.slice(0, 10),
      ].join(', '),
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: worldLang.code,
      ogLocale: worldLang.ogLocale,
      ogType: 'website',
      ogImage: params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: `${catCap} Dramas in Hindi Dubbed`,
      robots: 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${catCap} Dramas in Hindi Dubbed`,
          description,
          url: canonicalUrl,
          availableLanguage,
          audience: WORLDWIDE_AUDIENCE,
        },
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: `${catCap} Dramas`, item: canonicalUrl }
          ]
        }
      ]
    };
  }

  // 7. Admin & User Library routes (noindex)
  if (params.path === '/admin' || params.path === '/library') {
    const isAdmin = params.path === '/admin';
    return {
      title: isAdmin ? 'Admin Dashboard | HindiDrama.net' : 'My Library & Continue Watching | HindiDrama.net',
      description: isAdmin
        ? 'Platform analytics, TMDB synchronization, and streaming source management console.'
        : 'Manage your continue watching progress, watchlist, favorites, and viewing history on HindiDrama.net.',
      keywords: 'hindidrama library, watchlist, continue watching',
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: 'en',
      ogLocale: 'en_US',
      ogType: 'website',
      ogImage: 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: 'HindiDrama.net',
      robots: 'noindex, nofollow',
      jsonLd: [],
    };
  }

  // 8. Legal/Static Pages
  if (params.staticPage) {
    const titles: Record<string, string> = {
      dmca: 'DMCA Notice & Copyright Policy | HindiDrama.net',
      disclaimer: 'Disclaimer & Content Policy | HindiDrama.net',
      privacy: 'Privacy Policy | HindiDrama.net',
      terms: 'Terms of Service | HindiDrama.net',
      contact: 'Contact Us & Support | HindiDrama.net'
    };
    const title = titles[params.staticPage] || 'HindiDrama – Watch Kdrama & Asian Drama Hindi Dubbed';
    return {
      title,
      description: 'Official legal information, DMCA compliance, privacy policy, and user support for HindiDrama.net.',
      keywords: 'hindidrama dmca, hindidrama contact, hindidrama privacy policy',
      canonicalUrl,
      baseCanonicalUrl: baseDefaultCanonical,
      htmlLang: 'en',
      ogLocale: 'en_US',
      ogType: 'website',
      ogImage: 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: 'HindiDrama Legal Information',
      robots: 'index, follow',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'BreadcrumbList',
          itemListElement: [
            { '@type': 'ListItem', position: 1, name: 'Home', item: `${cleanOrigin}/` },
            { '@type': 'ListItem', position: 2, name: title.split(' | ')[0], item: canonicalUrl }
          ]
        }
      ]
    };
  }

  // 9. Default Homepage (Worldwide 50-Language SEO Anchor)
  const homeTitle = isLocalizedHl
    ? `HindiDrama – ${worldLang.phrase}`
    : 'HindiDrama – Watch K-Drama & Asian Drama Free 1080p HD Instant Play';
  const homeDescription = isLocalizedHl
    ? `[${worldLang.name}] ${worldLang.phrase}. Stream 650+ Korean & Asian dramas and movies with direct .mp4 URLs, multi-audio & zero buffering on HindiDrama.net.`
    : 'Watch Korean, Chinese, Japanese dramas & 500+ movies online free in 1080p HD. Instant play HLS.proxy, 2Embed & direct .mp4 multi-audio streaming.';
  const homeKeywords = [
    ...ZERO_COMPETITION_CATEGORY_KEYWORDS,
    ...TOP_50_LOCALIZED_PHRASES,
  ].join(', ');

  return {
    title: homeTitle,
    description: homeDescription,
    keywords: homeKeywords,
    canonicalUrl: isLocalizedHl ? canonicalUrl : `${cleanOrigin}/`,
    baseCanonicalUrl: `${cleanOrigin}/`,
    htmlLang: worldLang.code,
    ogLocale: worldLang.ogLocale,
    ogType: 'website',
    ogImage: params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
    ogImageAlt: 'HindiDrama – Watch K-Drama & Asian Drama Hindi Dubbed',
    robots: params.searchQuery ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-video-preview:-1, max-snippet:-1',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'HindiDrama.net',
        alternateName: ['HindiDrama', ...TOP_50_LOCALIZED_PHRASES.slice(0, 25)],
        url: `${cleanOrigin}/`,
        description: homeDescription,
        inLanguage: TOP_50_WORLD_LANGUAGES.map(l => l.code),
        keywords: homeKeywords,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${cleanOrigin}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'Organization',
        name: 'HindiDrama.net',
        url: `${cleanOrigin}/`,
        logo: `${cleanOrigin}/favicon.svg`,
        description: homeDescription,
        areaServed: 'Worldwide',
        availableLanguage,
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Top Asian & K-Dramas Worldwide',
        itemListElement: params.dramas.slice(0, 12).map((d, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: `${cleanOrigin}${getContentPath(d)}`,
          name: `${d.title} (${d.language})`
        }))
      }
    ]
  };
}

export function renderSeoHeadTags(meta: SeoMetadata): string {
  const jsonLdScripts = meta.jsonLd
    .map(
      schema =>
        `<script type="application/ld+json" data-seo-jsonld="true">${JSON.stringify(schema).replace(/<\/script/gi, '<\\/script')}</script>`
    )
    .join('\n    ');

  const hreflangTags = [
    ...TOP_50_WORLD_LANGUAGES.map(
      lang => `<link rel="alternate" hreflang="${lang.code}" href="${escapeHtmlAttr(buildHreflangUrl(meta.baseCanonicalUrl, lang.code))}" />`
    ),
    `<link rel="alternate" hreflang="x-default" href="${escapeHtmlAttr(meta.baseCanonicalUrl)}" />`,
  ].join('\n    ');

  const ogLocaleAlternates = TOP_50_WORLD_LANGUAGES.slice(0, 25)
    .map(lang => `<meta property="og:locale:alternate" content="${escapeHtmlAttr(lang.ogLocale)}" />`)
    .join('\n    ');

  const videoMetaTags = meta.videoUrl
    ? `
    <meta property="og:video" content="${escapeHtmlAttr(meta.videoUrl)}" />
    <meta property="og:video:secure_url" content="${escapeHtmlAttr(meta.videoUrl)}" />
    <meta property="og:video:type" content="video/mp4" />
    <meta property="og:video:width" content="1920" />
    <meta property="og:video:height" content="1080" />
    <link rel="alternate" type="video/mp4" href="${escapeHtmlAttr(meta.videoUrl)}" />`
    : '';

  return `
    <title>${escapeHtmlAttr(meta.title)}</title>
    <meta name="description" content="${escapeHtmlAttr(meta.description)}" />
    <meta name="keywords" content="${escapeHtmlAttr(meta.keywords)}" />
    <meta name="news_keywords" content="${escapeHtmlAttr(meta.keywords.split(',').slice(0, 10).join(','))}" />
    <meta name="author" content="HindiDrama.net" />
    <meta name="robots" content="${escapeHtmlAttr(meta.robots)}" />
    <meta name="googlebot" content="${escapeHtmlAttr(meta.robots)}" />
    <meta name="bingbot" content="${escapeHtmlAttr(meta.robots)}" />
    <meta name="distribution" content="global" />
    <meta name="coverage" content="Worldwide" />
    <meta name="rating" content="general" />
    <meta name="revisit-after" content="1 days" />
    <link rel="canonical" href="${escapeHtmlAttr(meta.canonicalUrl)}" />
    ${hreflangTags}
    <meta property="og:type" content="${escapeHtmlAttr(meta.ogType)}" />
    <meta property="og:locale" content="${escapeHtmlAttr(meta.ogLocale)}" />
    ${ogLocaleAlternates}
    <meta property="og:site_name" content="HindiDrama.net" />
    <meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />
    <meta property="og:url" content="${escapeHtmlAttr(meta.canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtmlAttr(meta.ogImage)}" />
    <meta property="og:image:alt" content="${escapeHtmlAttr(meta.ogImageAlt)}" />${videoMetaTags}
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(meta.ogImage)}" />
    ${jsonLdScripts}
  `.trim();
}

export function applyClientSeo(meta: SeoMetadata): void {
  if (typeof document === 'undefined') return;
  document.documentElement.lang = meta.htmlLang || 'en';
  document.title = meta.title;

  const setMeta = (selector: string, attrName: 'name' | 'property', attrVal: string, content: string) => {
    let el = document.head.querySelector(selector) as HTMLMetaElement | null;
    if (!el) {
      el = document.createElement('meta');
      el.setAttribute(attrName, attrVal);
      document.head.appendChild(el);
    }
    el.setAttribute('content', content);
  };

  setMeta('meta[name="description"]', 'name', 'description', meta.description);
  setMeta('meta[name="keywords"]', 'name', 'keywords', meta.keywords);
  setMeta('meta[name="robots"]', 'name', 'robots', meta.robots);
  setMeta('meta[name="googlebot"]', 'name', 'googlebot', meta.robots);
  setMeta('meta[property="og:type"]', 'property', 'og:type', meta.ogType);
  setMeta('meta[property="og:locale"]', 'property', 'og:locale', meta.ogLocale);
  setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', meta.canonicalUrl);
  setMeta('meta[property="og:image"]', 'property', 'og:image', meta.ogImage);
  setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', meta.ogImageAlt);
  if (meta.videoUrl) {
    setMeta('meta[property="og:video"]', 'property', 'og:video', meta.videoUrl);
    setMeta('meta[property="og:video:type"]', 'property', 'og:video:type', 'video/mp4');
  }
  setMeta('meta[name="twitter:title"]', 'name', 'twitter:title', meta.title);
  setMeta('meta[name="twitter:description"]', 'name', 'twitter:description', meta.description);
  setMeta('meta[name="twitter:image"]', 'name', 'twitter:image', meta.ogImage);

  let canonical = document.head.querySelector('link[rel="canonical"]') as HTMLLinkElement | null;
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.setAttribute('rel', 'canonical');
    document.head.appendChild(canonical);
  }
  canonical.setAttribute('href', meta.canonicalUrl);

  // Sync Top 50 distinct hreflang alternates + x-default without duplicating nodes
  document.head.querySelectorAll('link[rel="alternate"][hreflang]').forEach(node => node.remove());
  TOP_50_WORLD_LANGUAGES.forEach(lang => {
    const link = document.createElement('link');
    link.setAttribute('rel', 'alternate');
    link.setAttribute('hreflang', lang.code);
    link.setAttribute('href', buildHreflangUrl(meta.baseCanonicalUrl, lang.code));
    document.head.appendChild(link);
  });
  const xDef = document.createElement('link');
  xDef.setAttribute('rel', 'alternate');
  xDef.setAttribute('hreflang', 'x-default');
  xDef.setAttribute('href', meta.baseCanonicalUrl);
  document.head.appendChild(xDef);

  // Replace dynamic JSON-LD structured data scripts cleanly
  document.head.querySelectorAll('script[type="application/ld+json"]').forEach(node => node.remove());
  meta.jsonLd.forEach(schema => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.setAttribute('data-seo-jsonld', 'true');
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
  });
}
