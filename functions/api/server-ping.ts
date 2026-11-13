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
    const headers = {
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36',
      Accept: 'text/html,application/xhtml+xml',
    };
    try {
      // Check initial response without failing on Cloudflare JS-challenged redirects (e.g. multiembed.mov -> streamingnow.mov)
      let response = await fetch(url, {
        method: 'HEAD',
        headers,
        redirect: 'manual',
        signal: AbortSignal.timeout(2500),
      });
      if (response.status >= 400) {
        response = await fetch(url, {
          method: 'GET',
          headers,
          redirect: 'manual',
          signal: AbortSignal.timeout(2500),
        });
      }
      const latencyMs = Date.now() - start;
      const isRedirect = response.status >= 300 && response.status < 400 && Boolean(response.headers.get('location'));
      const isCfBrowserChallenge = response.status === 403 && Boolean(response.headers.get('cf-mitigated'));
      const ok = (response.status >= 200 && response.status < 400) || isRedirect || isCfBrowserChallenge;
      return new Response(
        JSON.stringify({ ok, status: isRedirect || isCfBrowserChallenge ? 200 : response.status, latencyMs }),
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
