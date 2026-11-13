const ALLOWED_RELAY_HOSTS = new Set([
  'www.2embed.cc',
  '2embed.cc',
  'streamsrcs.2embed.cc',
  'vidsrc.buzz',
  'www.vidsrc.buzz',
  'videm.buzz',
  'www.videm.buzz',
  'www.nontongo.win',
  'nontongo.win',
  'vidrock.net',
  'www.vidrock.net',
  'vidlink.pro',
  'cinemaos.tech',
  'vidfast.pro',
  'vidsrc.to',
  'vidsrc.me',
  'embed.smashystream.com',
]);

const BROWSER_UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36';

export function isAllowedRelayUrl(rawUrl: string): URL | null {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
    if (!ALLOWED_RELAY_HOSTS.has(parsed.hostname.toLowerCase())) return null;
    return parsed;
  } catch {
    return null;
  }
}

function getUpstreamReferer(target: URL): string {
  const host = target.hostname.toLowerCase();
  if (host.includes('vidsrc.buzz') || host.includes('videm.buzz') || host.includes('streamsrcs.2embed.cc')) {
    return 'https://www.2embed.cc/';
  }
  return `${target.origin}/`;
}

function buildSandboxShieldHeadSnippet(upstreamOrigin: string, upstreamBasePath: string): string {
  const safeOrigin = JSON.stringify(upstreamOrigin);
  const safeBase = JSON.stringify(`${upstreamOrigin}${upstreamBasePath}`);
  return `
<style id="hd-sandbox-shield-css">
#sbxErr, [id*="sbx" i], .sandbox-error { display: none !important; visibility: hidden !important; pointer-events: none !important; opacity: 0 !important; }
</style>
<script id="hd-sandbox-shield-js">
(function(){
  try {
    Object.defineProperty(window, 'frameElement', { get: function(){ return null; }, configurable: true });
  } catch(e) {}
  try { window.isReallySandboxed = function(){ return false; }; } catch(e) {}
  try { window.opaqueOrigin = function(){ return false; }; } catch(e) {}
  try { window.sandboxVerdict = function(){ return 'clean'; }; } catch(e) {}
  var UP_ORIGIN = ${safeOrigin};
  var UP_BASE = ${safeBase};
  function toRelayIfNeeded(inputUrl) {
    try {
      if (typeof inputUrl !== 'string' || !inputUrl) return inputUrl;
      if (inputUrl.indexOf('/api/player-relay') === 0 || inputUrl.indexOf('data:') === 0 || inputUrl.indexOf('blob:') === 0) return inputUrl;
      var abs = new URL(inputUrl, UP_BASE);
      if (abs.origin === window.location.origin) {
        abs = new URL(abs.pathname + abs.search, UP_BASE);
      }
      if (
        abs.hostname.indexOf('vidsrc.buzz') !== -1 ||
        abs.hostname.indexOf('videm.buzz') !== -1 ||
        abs.hostname.indexOf('2embed.cc') !== -1 ||
        abs.hostname.indexOf('nontongo.win') !== -1 ||
        abs.hostname.indexOf('vidrock.net') !== -1
      ) {
        return '/api/player-relay?url=' + encodeURIComponent(abs.toString());
      }
      return inputUrl;
    } catch(e) { return inputUrl; }
  }
  if (typeof window.fetch === 'function') {
    var _origFetch = window.fetch.bind(window);
    window.fetch = function(resource, init) {
      try {
        if (typeof resource === 'string') {
          resource = toRelayIfNeeded(resource);
        } else if (resource && typeof resource.url === 'string') {
          var nextUrl = toRelayIfNeeded(resource.url);
          if (nextUrl !== resource.url) {
            resource = new Request(nextUrl, resource);
          }
        }
      } catch(e) {}
      return _origFetch(resource, init);
    };
  }
  if (typeof XMLHttpRequest !== 'undefined' && XMLHttpRequest.prototype && XMLHttpRequest.prototype.open) {
    var _origOpen = XMLHttpRequest.prototype.open;
    XMLHttpRequest.prototype.open = function(method, url) {
      try {
        if (typeof url === 'string') {
          arguments[1] = toRelayIfNeeded(url);
        }
      } catch(e) {}
      return _origOpen.apply(this, arguments);
    };
  }
})();
</script>`.trim();
}

function rewriteEmbedHtml(html: string, target: URL): string {
  const host = target.hostname.toLowerCase();
  let out = html;

  // 1. Neutralize known sandbox detector functions directly in inline JS
  out = out
    .replace(/function\s+isReallySandboxed\s*\(\s*\)\s*\{/gi, 'function isReallySandboxed(){return false;}function _hdDisabledSbx(){')
    .replace(/function\s+opaqueOrigin\s*\(\s*\)\s*\{/gi, 'function opaqueOrigin(){return false;}function _hdDisabledOpaque(){')
    .replace(/function\s+sandboxVerdict\s*\(\s*\)\s*\{/gi, 'function sandboxVerdict(){return "clean";}function _hdDisabledVerdict(){')
    .replace(/function\s+sandboxDeny\s*\(\s*\)\s*\{/gi, 'function sandboxDeny(){return;}function _hdDisabledDeny(){')
    .replace(/document\.domain\s*=\s*[^;\n}]+/gi, 'void 0');

  // 2. Remove aggressive popup ad scripts on embed wrappers (sandbox overlay is hidden by injected CSS)
  out = out
    .replace(/<script[^>]+src=["']https?:\/\/(?:tagivi\.com|adplox\.com)[^"']*["'][^>]*>\s*<\/script>/gi, '');

  // 3. Route inner sandbox-checked iframe/source URLs inside 2embed through our same-origin relay too
  out = out.replace(
    /(data-src|src)=(["'])(https:\/\/(?:vidsrc\.buzz|www\.vidsrc\.buzz|videm\.buzz|www\.videm\.buzz|streamsrcs\.2embed\.cc)[^"']+)\2/gi,
    (_m, attr, quote, innerUrl) => `${attr}=${quote}/api/player-relay?url=${encodeURIComponent(innerUrl)}${quote}`
  );
  out = out.replace(
    /go\(\s*(['"])(https:\/\/(?:vidsrc\.buzz|www\.vidsrc\.buzz|videm\.buzz|www\.videm\.buzz|streamsrcs\.2embed\.cc)[^'"]+)\1\s*\)/gi,
    (_m, quote, innerUrl) => `go(${quote}/api/player-relay?url=${encodeURIComponent(innerUrl)}${quote})`
  );

  // 4. Preserve correct relative asset & API resolution using upstream <base href>
  let upstreamBasePath = '/';
  const baseMatch = out.match(/<base\s+[^>]*href=(["'])([^"']+)\1[^>]*>/i);
  if (baseMatch) {
    const rawHref = baseMatch[2];
    const resolvedBase = rawHref.startsWith('http')
      ? rawHref
      : new URL(rawHref, target.origin).toString();
    try {
      upstreamBasePath = new URL(resolvedBase).pathname;
    } catch {
      upstreamBasePath = '/';
    }
    out = out.replace(baseMatch[0], `<base href="${resolvedBase}">`);
  }

  // Note: vidsrc.buzz / videm.buzz serve player assets under /pl/
  if (!baseMatch && (host.includes('vidsrc.buzz') || host.includes('videm.buzz'))) {
    upstreamBasePath = '/pl/';
  }

  const headInject = `${baseMatch ? '' : `<base href="${target.origin}${upstreamBasePath}">\n`}${buildSandboxShieldHeadSnippet(target.origin, upstreamBasePath)}`;

  if (/<head[^>]*>/i.test(out)) {
    out = out.replace(/<head[^>]*>/i, match => `${match}\n${headInject}`);
  } else {
    out = `<!doctype html><html><head>${headInject}</head><body>${out}</body></html>`;
  }

  return out;
}

export async function relayPlayerRequest(params: {
  method: string;
  targetUrlRaw: string;
  bodyText?: string | null;
  contentType?: string | null;
}): Promise<{
  status: number;
  headers: Record<string, string>;
  body: string | ArrayBuffer;
}> {
  const target = isAllowedRelayUrl(params.targetUrlRaw);
  if (!target) {
    return {
      status: 400,
      headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ ok: false, error: 'Unsupported or invalid relay URL' }),
    };
  }

  const upstreamHeaders: Record<string, string> = {
    'User-Agent': BROWSER_UA,
    Accept: 'text/html,application/xhtml+xml,application/json,*/*;q=0.8',
    'Accept-Language': 'en-US,en;q=0.9,hi;q=0.8',
    Referer: getUpstreamReferer(target),
  };
  if (params.contentType && params.method !== 'GET' && params.method !== 'HEAD') {
    upstreamHeaders['Content-Type'] = params.contentType;
  }

  try {
    const upstreamRes = await fetch(target.toString(), {
      method: params.method === 'POST' ? 'POST' : 'GET',
      headers: upstreamHeaders,
      body: params.method === 'POST' && params.bodyText ? params.bodyText : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    const respContentType = upstreamRes.headers.get('content-type') || 'text/html; charset=utf-8';
    const isHtml = respContentType.toLowerCase().includes('text/html');

    if (isHtml) {
      const rawHtml = await upstreamRes.text();
      const cleanHtml = rewriteEmbedHtml(rawHtml, new URL(upstreamRes.url || target.toString()));
      return {
        status: upstreamRes.status,
        headers: {
          'Content-Type': 'text/html; charset=utf-8',
          'Cache-Control': 'no-store',
          'Referrer-Policy': 'no-referrer-when-downgrade',
        },
        body: cleanHtml,
      };
    }

    const buffer = await upstreamRes.arrayBuffer();
    return {
      status: upstreamRes.status,
      headers: {
        'Content-Type': respContentType,
        'Cache-Control': 'no-store',
        'Access-Control-Allow-Origin': '*',
      },
      body: buffer,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Upstream embed unavailable';
    return {
      status: 502,
      headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
      body: `<!doctype html><html><body style="margin:0;background:#020617;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;"><div><p style="font-size:15px;font-weight:600;margin:0 0 8px;">Stream Temporarily Busy (${message})</p><p style="font-size:12px;color:#94a3b8;margin:0;">Click Auto-Fallback or Direct Play in the player bar above.</p></div></body></html>`,
    };
  }
}
