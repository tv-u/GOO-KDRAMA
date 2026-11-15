import { resolveHlsStream } from '../../src/services/hlsProxy.ts';

export async function onRequest(context: { request: Request }): Promise<Response> {
  const { request } = context;

  if (request.method === 'OPTIONS') {
    return new Response(null, {
      status: 204,
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type',
      },
    });
  }

  let tmdbId = '';
  let type: 'tv' | 'movie' = 'tv';
  let season = 1;
  let episode = 1;
  let lang = 'hi';

  const url = new URL(request.url);
  if (request.method === 'POST') {
    try {
      const body = (await request.json()) as any;
      tmdbId = String(body?.tmdbId || '');
      type = body?.type === 'movie' ? 'movie' : 'tv';
      season = Number(body?.season || 1);
      episode = Number(body?.episode || 1);
      lang = String(body?.lang || 'hi');
    } catch {
      return new Response(JSON.stringify({ ok: false, error: 'Invalid JSON' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
      });
    }
  } else {
    tmdbId = url.searchParams.get('tmdbId') || '';
    type = url.searchParams.get('type') === 'movie' ? 'movie' : 'tv';
    season = Number(url.searchParams.get('season') || 1);
    episode = Number(url.searchParams.get('episode') || 1);
    lang = url.searchParams.get('lang') || 'hi';
  }

  if (!tmdbId) {
    return new Response(JSON.stringify({ ok: false, error: 'Missing tmdbId' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
    });
  }

  const result = await resolveHlsStream({ tmdbId, type, season, episode, lang });
  return new Response(JSON.stringify(result), {
    status: 200,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
      'Access-Control-Allow-Origin': '*',
      'Cache-Control': 'no-store',
    },
  });
}
