import React from 'react';
import { renderToString } from 'react-dom/server';
import App, { parseRouteUrl } from './App.tsx';
import type { CastProfile, Drama } from './types/drama.ts';
import { buildSeoMetadata, renderSeoHeadTags } from './services/seo.ts';

export interface SsrRenderOptions {
  url: string;
  origin: string;
  dramas: Drama[];
  castProfile?: CastProfile | null;
}

function findActiveDramaForSsr(dramas: Drama[], dramaSlug: string, view: string): Drama | undefined {
  if (!dramaSlug) return undefined;
  const lower = dramaSlug.toLowerCase();
  const exact = dramas.find(d => d.slug.toLowerCase() === lower || d.id.toLowerCase() === lower);
  if (exact) return exact;
  const trailingId = lower.match(/(?:^|-)(\d+)$/)?.[1];
  if (trailingId) {
    return dramas.find(
      d => String(d.tmdbId) === trailingId && (view !== 'movie' || d.type === 'movie')
    );
  }
  return undefined;
}

export function renderPage({ url, origin, dramas, castProfile = null }: SsrRenderOptions): {
  appHtml: string;
  headTags: string;
  htmlLang: string;
  statusCode: number;
} {
  const parsed = parseRouteUrl(url);
  const [pathOnly, queryString = ''] = url.split('?');
  const qs = new URLSearchParams(queryString);
  const hlLang = qs.get('hl') || undefined;
  const isPlayerQueryVariant =
    qs.get('window') === '1' || qs.has('server') || qs.has('lang') || qs.has('audio');

  const activeDrama = findActiveDramaForSsr(dramas, parsed.dramaSlug, parsed.view);
  const isMissingTitle =
    (parsed.view === 'movie' || parsed.view === 'detail' || parsed.view === 'watch') &&
    !activeDrama;

  const seoMeta = buildSeoMetadata({
    path: pathOnly || '/',
    origin,
    dramas,
    activeDrama,
    episode: parsed.episode,
    season: parsed.season,
    category: parsed.category,
    genre: parsed.genreSlug,
    castProfile,
    searchQuery: parsed.searchQuery,
    staticPage: parsed.view === 'static' ? parsed.staticPage : undefined,
    hlLang,
    isPlayerQueryVariant,
  });

  const appHtml = renderToString(
    <React.StrictMode>
      <App
        initialUrl={url}
        initialDramas={dramas}
        initialCastProfile={castProfile}
        origin={origin}
      />
    </React.StrictMode>
  );

  const headTags = renderSeoHeadTags(seoMeta);

  return {
    appHtml,
    headTags,
    htmlLang: seoMeta.htmlLang || 'en',
    statusCode: isMissingTitle ? 404 : 200,
  };
}
