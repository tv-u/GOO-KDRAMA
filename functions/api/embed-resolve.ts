import { resolveDynamicEmbed } from '../../src/services/embedResolver.ts';
import type { AudioLanguageCode } from '../../src/types/drama.ts';
import type { CFContext } from '../types.ts';

export async function onRequestPost(context: CFContext): Promise<Response> {
  try {
    const body = (await context.request.json().catch(() => ({}))) as {
      provider?: string;
      title?: string;
      tmdbId?: number;
      type?: 'tv' | 'movie';
      season?: number;
      episode?: number;
      lang?: AudioLanguageCode;
    };

    if (
      (body.provider !== 'dailymotion' && body.provider !== 'youtube') ||
      typeof body.title !== 'string'
    ) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Valid provider and title required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }

    const result = await resolveDynamicEmbed({
      provider: body.provider,
      title: body.title,
      tmdbId: Number(body.tmdbId) || 0,
      type: body.type === 'movie' ? 'movie' : 'tv',
      season: Number(body.season) || 1,
      episode: Number(body.episode) || 1,
      lang: body.lang || 'hi',
      apiKey: context.env.TMDB_API_KEY,
    });

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=3600',
      },
    });
  } catch {
    return new Response(JSON.stringify({ ok: false, embedUrl: null }), {
      status: 500,
      headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
    });
  }
}
