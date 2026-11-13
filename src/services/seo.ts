import type { CastProfile, Drama, DramaFAQ } from '../types/drama.ts';

export interface SeoMetadata {
  title: string;
  description: string;
  keywords: string;
  canonicalUrl: string;
  ogType: 'website' | 'video.tv_show' | 'video.episode' | 'profile';
  ogImage: string;
  ogImageAlt: string;
  robots: string;
  jsonLd: Record<string, unknown>[];
}

export function slugifyText(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '');
}

export function getDramaFaqs(drama: Drama, episode?: number): DramaFAQ[] {
  const epNum = episode || drama.latestEpisode || 1;
  return [
    {
      question: `Where can I watch ${drama.title} ${episode ? `Episode ${epNum} ` : ''}in Hindi Dubbed online?`,
      answer: `You can stream ${drama.title} (${drama.year}) ${episode ? `Episode ${epNum} ` : 'all episodes '}in Hindi Dubbed 1080p HD for free on HindiDrama.net using fast multi-provider servers including StreamWish, Abyss, Byse, EarnVids, and VidCloud.`
    },
    {
      question: `How many total episodes are in ${drama.title} Hindi Dubbed?`,
      answer: `${drama.title} consists of ${drama.totalEpisodes} total episodes (${drama.duration} per episode), all available in Hindi Dubbed and original ${drama.country} audio.`
    },
    {
      question: `Is ${drama.title} available for HD download in Hindi?`,
      answer: `Yes, every episode of ${drama.title} can be downloaded in 1080p Full HD, 720p HD, and 480p mobile sizes with crystal-clear Hindi audio tracks directly from the watch page.`
    },
    {
      question: `What is the genre and IMDb/TMDB rating of ${drama.title}?`,
      answer: `${drama.title} is a ${drama.country} series in the ${(drama.genres || ['Drama']).join(', ')} genre(s) rated ${drama.rating}/10 on TMDB.`
    }
  ];
}

function escapeHtmlAttr(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export function buildSeoMetadata(params: {
  path: string;
  origin: string;
  dramas: Drama[];
  activeDrama?: Drama;
  episode?: number;
  category?: string;
  genre?: string;
  castProfile?: CastProfile | null;
  searchQuery?: string;
  staticPage?: string;
}): SeoMetadata {
  const cleanOrigin = params.origin.replace(/\/$/, '') || 'https://hindidrama.net';
  const normalizedPath = params.path === '/' ? '' : params.path;
  const canonicalUrl = `${cleanOrigin}${normalizedPath || '/'}`;

  // 1. Episode Watch Page (/watch/:slug/episode-:ep)
  if (params.path.startsWith('/watch/') && params.activeDrama) {
    const drama = params.activeDrama;
    const ep = params.episode || 1;
    const title = `Watch ${drama.title} Episode ${ep} Hindi Dubbed Online Free HD | HindiDrama`;
    const description = `Stream ${drama.title} Episode ${ep} Hindi Dubbed online free in 1080p Full HD on HindiDrama.net. Fast StreamWish, Abyss, Byse & VidCloud servers with zero buffering.`.slice(0, 160);
    const keywords = [
      `watch ${drama.title.toLowerCase()} episode ${ep} hindi dubbed online free`,
      `${drama.title.toLowerCase()} ep ${ep} in hindi hd`,
      `${drama.country.toLowerCase()} drama ${drama.title.toLowerCase()} hindi dubbed`,
      `download ${drama.title.toLowerCase()} episode ${ep} hindi 1080p`,
      'hindidrama net'
    ].join(', ');
    const faqs = getDramaFaqs(drama, ep);
    const ratingCount = Math.max(120, Math.round(drama.rating * 340));

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      ogType: 'video.episode',
      ogImage: drama.backdrop || drama.poster,
      ogImageAlt: `Watch ${drama.title} Episode ${ep} Hindi Dubbed`,
      robots: 'index, follow, max-image-preview:large',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'TVEpisode',
          name: `${drama.title} Episode ${ep} Hindi Dubbed`,
          episodeNumber: ep,
          inLanguage: 'hi',
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
          inLanguage: 'hi',
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
    const title = `${drama.title} (${drama.year}) Hindi Dubbed Full Episodes HD | HindiDrama`;
    const description = `Watch all ${drama.totalEpisodes} episodes of ${drama.title} (${drama.country} Drama) in Hindi Dubbed HD on HindiDrama.net. ${drama.overview}`.slice(0, 160);
    const keywords = [
      `${drama.title.toLowerCase()} hindi dubbed all episodes`,
      `watch ${drama.title.toLowerCase()} in hindi online free`,
      `${drama.title.toLowerCase()} ${drama.year} ${drama.country.toLowerCase()} drama hindi`,
      `${(drama.genres || []).join(' ').toLowerCase()} drama in hindi`,
      'hindidrama.net'
    ].join(', ');
    const faqs = getDramaFaqs(drama);
    const ratingCount = Math.max(150, Math.round(drama.rating * 390));

    return {
      title,
      description,
      keywords,
      canonicalUrl,
      ogType: 'video.tv_show',
      ogImage: drama.poster || drama.backdrop,
      ogImageAlt: `${drama.title} (${drama.year}) Hindi Dubbed Poster`,
      robots: 'index, follow, max-image-preview:large',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'TVSeries',
          name: drama.title,
          alternateName: drama.hindiTitle,
          url: canonicalUrl,
          image: drama.poster,
          description: drama.overview,
          datePublished: String(drama.year),
          genre: drama.genres,
          numberOfEpisodes: drama.totalEpisodes,
          inLanguage: 'hi',
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

  // 3. Genre Hub Page (/genre/:genre)
  if (params.path.startsWith('/genre/') && params.genre) {
    const genreLabel = params.genre.charAt(0).toUpperCase() + params.genre.slice(1);
    const title = `Best ${genreLabel} Asian & K-Dramas in Hindi Dubbed | HindiDrama`;
    const description = `Stream top-rated ${genreLabel} Korean, Chinese, and Japanese dramas in Hindi dubbed online for free in 1080p HD on HindiDrama.net.`;
    return {
      title,
      description,
      keywords: `${genreLabel.toLowerCase()} kdrama in hindi dubbed, best ${genreLabel.toLowerCase()} asian dramas hindi, watch ${genreLabel.toLowerCase()} chinese drama hindi`,
      canonicalUrl,
      ogType: 'website',
      ogImage: params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: `${genreLabel} Dramas in Hindi Dubbed`,
      robots: 'index, follow, max-image-preview:large',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${genreLabel} Hindi Dubbed Dramas`,
          description,
          url: canonicalUrl
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

  // 4. Cast Profile Page (/cast/:slug)
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
      keywords: `${titleCaseName.toLowerCase()} kdrama in hindi, ${titleCaseName.toLowerCase()} dramas hindi dubbed, ${titleCaseName.toLowerCase()} movies list`,
      canonicalUrl,
      ogType: 'profile',
      ogImage: params.castProfile?.profileImage || params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: `${titleCaseName} Cast Profile`,
      robots: 'index, follow, max-image-preview:large',
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

  // 5. Category Page (/category/:cat)
  if (params.path.startsWith('/category/') && params.category && params.category !== 'all') {
    const catCap = params.category.charAt(0).toUpperCase() + params.category.slice(1);
    const title = `${catCap} Dramas Hindi Dubbed Watch Online Free HD | HindiDrama`;
    const description = `Watch latest ${catCap} dramas and web series dubbed in Hindi online for free in 1080p HD. Stream all episodes on HindiDrama.net.`;
    return {
      title,
      description,
      keywords: `${catCap.toLowerCase()} drama in hindi dubbed, watch ${catCap.toLowerCase()} series online free hd, hindidrama ${catCap.toLowerCase()}`,
      canonicalUrl,
      ogType: 'website',
      ogImage: params.dramas[0]?.poster || 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
      ogImageAlt: `${catCap} Dramas in Hindi Dubbed`,
      robots: 'index, follow, max-image-preview:large',
      jsonLd: [
        {
          '@context': 'https://schema.org',
          '@type': 'CollectionPage',
          name: `${catCap} Dramas in Hindi Dubbed`,
          description,
          url: canonicalUrl
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

  // 6. Legal/Static Pages
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

  // 7. Default Homepage
  const homeTitle = 'HindiDrama – Watch Kdrama & Asian Drama Hindi Dubbed Online Free HD';
  const homeDescription = 'Watch Korean, Chinese, Japanese, and Indian dramas in Hindi dubbed online for free in HD. Stream One and Only, Study Group, The Remarried Empress with fast servers.';
  return {
    title: homeTitle,
    description: homeDescription,
    keywords: 'watch one and only episode 24 hindi dubbed online free, study group kdrama hindi dubbed hd stream, latest korean drama in hindi dubbed 2026, chinese historical romance drama in hindi, hindi drama net',
    canonicalUrl: `${cleanOrigin}/`,
    ogType: 'website',
    ogImage: 'https://image.tmdb.org/t/p/w500/jyc9HDQDmJC4PthBUdw95XJJog9.jpg',
    ogImageAlt: 'HindiDrama – Watch Kdrama & Asian Drama Hindi Dubbed',
    robots: params.searchQuery ? 'noindex, follow' : 'index, follow, max-image-preview:large',
    jsonLd: [
      {
        '@context': 'https://schema.org',
        '@type': 'WebSite',
        name: 'HindiDrama.net',
        alternateName: 'HindiDrama',
        url: `${cleanOrigin}/`,
        description: homeDescription,
        potentialAction: {
          '@type': 'SearchAction',
          target: `${cleanOrigin}/?q={search_term_string}`,
          'query-input': 'required name=search_term_string'
        }
      },
      {
        '@context': 'https://schema.org',
        '@type': 'ItemList',
        name: 'Top 10 Asian Dramas in Hindi Dubbed This Week',
        itemListElement: params.dramas.slice(0, 10).map((d, idx) => ({
          '@type': 'ListItem',
          position: idx + 1,
          url: `${cleanOrigin}/drama/${d.slug}`,
          name: d.title
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

  return `
    <title>${escapeHtmlAttr(meta.title)}</title>
    <meta name="description" content="${escapeHtmlAttr(meta.description)}" />
    <meta name="keywords" content="${escapeHtmlAttr(meta.keywords)}" />
    <meta name="robots" content="${escapeHtmlAttr(meta.robots)}" />
    <link rel="canonical" href="${escapeHtmlAttr(meta.canonicalUrl)}" />
    <meta property="og:type" content="${escapeHtmlAttr(meta.ogType)}" />
    <meta property="og:site_name" content="HindiDrama.net" />
    <meta property="og:title" content="${escapeHtmlAttr(meta.title)}" />
    <meta property="og:description" content="${escapeHtmlAttr(meta.description)}" />
    <meta property="og:url" content="${escapeHtmlAttr(meta.canonicalUrl)}" />
    <meta property="og:image" content="${escapeHtmlAttr(meta.ogImage)}" />
    <meta property="og:image:alt" content="${escapeHtmlAttr(meta.ogImageAlt)}" />
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="${escapeHtmlAttr(meta.title)}" />
    <meta name="twitter:description" content="${escapeHtmlAttr(meta.description)}" />
    <meta name="twitter:image" content="${escapeHtmlAttr(meta.ogImage)}" />
    ${jsonLdScripts}
  `.trim();
}

export function applyClientSeo(meta: SeoMetadata): void {
  if (typeof document === 'undefined') return;
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
  setMeta('meta[property="og:type"]', 'property', 'og:type', meta.ogType);
  setMeta('meta[property="og:title"]', 'property', 'og:title', meta.title);
  setMeta('meta[property="og:description"]', 'property', 'og:description', meta.description);
  setMeta('meta[property="og:url"]', 'property', 'og:url', meta.canonicalUrl);
  setMeta('meta[property="og:image"]', 'property', 'og:image', meta.ogImage);
  setMeta('meta[property="og:image:alt"]', 'property', 'og:image:alt', meta.ogImageAlt);
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
