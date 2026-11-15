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
  'vidfast.vc',
  'www.vidfast.vc',
  'vidsrc.to',
  'vidsrc.me',
  'vidsrc.sh',
  'www.vidsrc.sh',
  'embed.smashystream.com',
  'anyembed.xyz',
  'multiembed.mov',
  'streamingnow.mov',
  'archive.org',
  'viduki.net',
  'www.viduki.net',
  '111movies.com',
  'ok.ru',
  'www.ok.ru',
  'vk.com',
  'm.vk.com',
  'facebook.com',
  'www.facebook.com',
  'rumble.com',
  'www.rumble.com',
  'odysee.com',
  'lbry.tv',
  'twitch.tv',
  'player.twitch.tv',
  'drive.google.com',
  'vimeo.com',
  'player.vimeo.com',
  'streamable.com',
  'screenpal.com',
  'catbox.moe',
  'files.catbox.moe',
  'streamwish.to',
  'streamwish.com',
  'filemoon.sx',
  'filemoon.in',
  'vidhidepro.com',
  'vidhide.com',
  'byse.to',
  'www.byse.to',
  'earnvids.com',
  'www.earnvids.com',
  'lulustream.com',
  'www.lulustream.com',
  'upbolt.com',
  'www.upbolt.com',
  'vidara.su',
  'www.vidara.su',
  'abyss.to',
  'www.abyss.to',
  'doodstream.com',
  'www.doodstream.com',
  'pkmbed.com',
  'www.pkmbed.com',
  'pkembed.site',
  'www.pkembed.site',
  'vidhide.vip',
  'smoothpre.com',
  'd000d.com',
  'vidsrc.cc',
  'www.vidsrc.cc',
  'vidsrc.xyz',
  'vidsrc.pm',
  'autoembed.cc',
  'player.autoembed.cc',
  'embed.su',
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
  try {
    Object.defineProperty(Document.prototype, 'domain', {
      get: function(){ return location.hostname; },
      set: function(){ return true; },
      configurable: true
    });
  } catch(e) {}
  try {
    var _origHasAttr = Element.prototype.hasAttribute;
    Element.prototype.hasAttribute = function(name) {
      if (typeof name === 'string' && name.toLowerCase() === 'sandbox') return false;
      return _origHasAttr.call(this, name);
    };
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
        abs.hostname.indexOf('vidrock.net') !== -1 ||
        abs.hostname.indexOf('vidfast.') !== -1 ||
        abs.hostname.indexOf('vidsrc.sh') !== -1
      ) {
        return '/api/player-relay?url=' + encodeURIComponent(abs.toString());
      }
      return inputUrl;
    } catch(e) { return inputUrl; }
  }
  try {
    var _allowedPopupHosts = ['vidsrc', 'videm', '2embed', 'nontongo', 'vidrock', 'vidfast', 'vidlink', 'cinemaos', 'anyembed', 'youtube', 'dailymotion'];
    function _isSafeStreamHost(urlStr) {
      try {
        var u = new URL(urlStr, window.location.href);
        if (u.origin === window.location.origin || u.origin === ${safeOrigin}) return true;
        var h = u.hostname.toLowerCase();
        for (var i = 0; i < _allowedPopupHosts.length; i++) {
          if (h.indexOf(_allowedPopupHosts[i]) !== -1) return true;
        }
        return false;
      } catch(e) { return false; }
    }
    window.open = function(url) {
      if (url && _isSafeStreamHost(String(url))) {
        return { closed: false, focus: function(){}, close: function(){}, location: { href: String(url) } };
      }
      return { closed: false, focus: function(){}, close: function(){}, location: { href: '' } };
    };
    document.addEventListener('click', function(ev) {
      try {
        var el = ev.target;
        while (el && el.tagName !== 'A') el = el.parentElement;
        if (el && el.href) {
          var tgt = (el.getAttribute('target') || '').toLowerCase();
          if ((tgt === '_blank' || tgt === '_top' || tgt === '_parent') && !_isSafeStreamHost(el.href)) {
            ev.preventDefault();
            ev.stopPropagation();
          }
        }
      } catch(e) {}
    }, true);
  } catch(e) {}
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

  // 1. Neutralize known sandbox detector functions, disable-devtool, and top-window homepage redirects
  out = out
    .replace(/function\s+isReallySandboxed\s*\(\s*\)\s*\{/gi, 'function isReallySandboxed(){return false;}function _hdDisabledSbx(){')
    .replace(/function\s+opaqueOrigin\s*\(\s*\)\s*\{/gi, 'function opaqueOrigin(){return false;}function _hdDisabledOpaque(){')
    .replace(/function\s+sandboxVerdict\s*\(\s*\)\s*\{/gi, 'function sandboxVerdict(){return "clean";}function _hdDisabledVerdict(){')
    .replace(/function\s+sandboxDeny\s*\(\s*\)\s*\{/gi, 'function sandboxDeny(){return;}function _hdDisabledDeny(){')
    .replace(/if\s*\(\s*window\s*==={1,2}\s*window\.top\s*\)\s*\{[^}]*location\.replace\([^)]*\)[^}]*\}/gi, '')
    .replace(/document\.domain\s*=\s*[^;\n}]+/gi, 'void 0');

  // 2. Remove meta-refresh redirects, disable-devtool, 2embed.skin redirects, & aggressive popunder/redirect ad scripts
  out = out
    .replace(/<meta[^>]+http-equiv=["']?refresh["']?[^>]*>/gi, '')
    .replace(/<script[^>]*disable-devtool[^>]*>\s*<\/script>/gi, '')
    .replace(/<a[^>]+href=["']https?:\/\/(?:www\.)?2embed\.skin[^"']*["'][^>]*>[\s\S]*?<\/a>/gi, '')
    .replace(/<script[^>]+src=["']https?:\/\/(?:[^"']*\.)?(?:tagivi\.com|adplox\.com|acscdn\.com|onclkds\.com|popads\.net|popcash\.net|clickadu\.com|hilltopads\.net|exoclick\.com|trafficstars\.com|highperformanceformat\.com|disable-devtool|unfortunatelyejectinflected\.com|whos\.amung\.us)[^"']*["'][^>]*>\s*<\/script>/gi, '');

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
    let fetchTarget = target;
    let upstreamRes = await fetch(fetchTarget.toString(), {
      method: params.method === 'POST' ? 'POST' : 'GET',
      headers: upstreamHeaders,
      body: params.method === 'POST' && params.bodyText ? params.bodyText : undefined,
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
    });

    const respContentType = upstreamRes.headers.get('content-type') || 'text/html; charset=utf-8';
    const isHtml = respContentType.toLowerCase().includes('text/html');

    if (isHtml) {
      let rawHtml = await upstreamRes.text();

      // Master trick for 2embed.cc: unwrap its homepage/dropdown menu shell and directly serve its clean vidsrc.buzz player!
      if (fetchTarget.hostname.includes('2embed.cc') && params.method === 'GET') {
        const innerMatch =
          rawHtml.match(/<iframe[^>]+id=["']iframesrc["'][^>]+data-src=["'](https:\/\/(?:vidsrc\.buzz|videm\.buzz|streamsrcs\.2embed\.cc)\/[^"']+)["']/i) ||
          rawHtml.match(/go\(\s*['"](https:\/\/(?:vidsrc\.buzz|streamsrcs\.2embed\.cc)\/[^'"]+)['"]\s*\)/i);
        if (innerMatch?.[1]) {
          const unwrappedUrl = new URL(innerMatch[1]);
          const unwrappedRes = await fetch(unwrappedUrl.toString(), {
            headers: { ...upstreamHeaders, Referer: 'https://www.2embed.cc/' },
            redirect: 'follow',
            signal: AbortSignal.timeout(8000),
          });
          if (unwrappedRes.ok) {
            fetchTarget = unwrappedUrl;
            upstreamRes = unwrappedRes;
            rawHtml = await unwrappedRes.text();
          }
        }
      }

      if (upstreamRes.status >= 400) {
        const errorHtml = `<!doctype html><html><body style="margin:0;background:#0a0d14;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;"><script>try{window.parent.postMessage({type:'HLX_RELAY_ERROR',status:${upstreamRes.status},url:${JSON.stringify(fetchTarget.toString())}},'*');}catch(e){}</script><div><p style="font-size:14px;font-weight:600;margin:0 0 6px;">Auto-switching HLX Mirror...</p><p style="font-size:12px;color:#94a3b8;margin:0;">Mirror responded ${upstreamRes.status}, loading backup node.</p></div></body></html>`;
        return {
          status: 502,
          headers: { 'Content-Type': 'text/html; charset=utf-8', 'Cache-Control': 'no-store' },
          body: errorHtml,
        };
      }

      const cleanHtml = rewriteEmbedHtml(rawHtml, new URL(upstreamRes.url || fetchTarget.toString()));
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
      body: `<!doctype html><html><body style="margin:0;background:#0a0d14;color:#e2e8f0;font-family:system-ui,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;text-align:center;padding:24px;"><script>try{window.parent.postMessage({type:'HLX_RELAY_ERROR',status:502,reason:${JSON.stringify(message)}},'*');}catch(e){}</script><div><p style="font-size:14px;font-weight:600;margin:0 0 6px;">Auto-switching HLX Mirror...</p><p style="font-size:12px;color:#94a3b8;margin:0;">${message}</p></div></body></html>`,
    };
  }
}
