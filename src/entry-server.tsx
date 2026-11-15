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

  const activeDrama =
    parsed.dramaSlug
      ? dramas.find(d => d.slug.toLowerCase() === parsed.dramaSlug.toLowerCase())
      : undefined;

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
    statusCode: 200,
  };
}
