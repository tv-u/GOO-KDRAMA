import type { CFContext } from '../types.ts';

export async function onRequestPost(context: CFContext): Promise<Response> {
  try {
    const body = (await context.request.json().catch(() => ({}))) as { url?: unknown };
    const url = body?.url;

    if (typeof url !== 'string' || (!url.startsWith('https://') && !url.startsWith('http://'))) {
      return new Response(
        JSON.stringify({ ok: false, error: 'Valid HTTP/HTTPS embed URL required' }),
        {
          status: 400,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }

    const start = Date.now();
    try {
      const response = await fetch(url, {
        method: 'HEAD',
        redirect: 'follow',
        signal: AbortSignal.timeout(2500),
      });
      const latencyMs = Date.now() - start;
      const ok = response.status < 500;
      return new Response(
        JSON.stringify({ ok, status: response.status, latencyMs }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    } catch {
      return new Response(
        JSON.stringify({ ok: false, status: 503, latencyMs: Date.now() - start }),
        {
          status: 200,
          headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
        }
      );
    }
  } catch {
    return new Response(
      JSON.stringify({ ok: false, status: 500 }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      }
    );
  }
}
