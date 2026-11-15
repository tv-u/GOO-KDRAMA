import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');

const BASE_URL = process.env.TEST_BASE_URL || 'http://127.0.0.1:3000';
const ADMIN_PASS = process.env.ADMIN_PASSWORD || 'admin123';

test('Catalog JSON integrity: unique slugs, unique tmdbIds, required fields', () => {
  const raw = fs.readFileSync(path.join(ROOT, 'src/data/dramas.json'), 'utf8');
  const dramas = JSON.parse(raw);
  assert.ok(Array.isArray(dramas) && dramas.length > 50, 'Expected catalog with >50 dramas');

  const slugs = new Set();
  const tmdbIds = new Set();

  for (const d of dramas) {
    assert.ok(d.slug && typeof d.slug === 'string', `Missing slug on ${d.title}`);
    assert.ok(!slugs.has(d.slug), `Duplicate slug detected: ${d.slug}`);
    slugs.add(d.slug);

    if (d.tmdbId) {
      assert.ok(!tmdbIds.has(d.tmdbId), `Duplicate tmdbId detected: ${d.tmdbId} (${d.slug})`);
      tmdbIds.add(d.tmdbId);
    }

    assert.ok(d.title && d.poster && d.overview, `Incomplete metadata on ${d.slug}`);
    assert.ok(d.totalEpisodes >= 1, `Invalid episode count on ${d.slug}`);
  }

  const hindiKdramas = dramas.filter(
    d => d.country?.toLowerCase() === 'korean' && (d.hindiOnly || (d.language || '').toLowerCase().includes('hindi'))
  );
  assert.ok(hindiKdramas.length > 0, 'Expected verified Hindi Dubbed Korean dramas');
});

test('Environment template documents required secrets safely', () => {
  const envExample = fs.readFileSync(path.join(ROOT, '.env.example'), 'utf8');
  assert.match(envExample, /TMDB_API_KEY/);
  assert.match(envExample, /DAILYMOTION_API_KEY/);
  assert.match(envExample, /ADMIN_PASSWORD/);
  assert.match(envExample, /ADMIN_SESSION_SECRET/);
  assert.equal(/656242f6bd70036a2064/.test(envExample), false, '.env.example must not leak real Dailymotion key');
});

test('WatchPlayer uses Video.js and clean server templates without {videoId} placeholders', () => {
  const watchPlayer = fs.readFileSync(path.join(ROOT, 'src/components/WatchPlayer.tsx'), 'utf8');
  assert.match(watchPlayer, /VideoJsPlayer/);
  assert.match(watchPlayer, /Internet Archive/);
  assert.match(watchPlayer, /Wikimedia Commons/);
  assert.match(watchPlayer, /PeerTube/);
  assert.match(watchPlayer, /Dailymotion/);
  assert.equal(/\{videoId\}/.test(watchPlayer), false, 'Server templates must not contain literal {videoId} placeholders');
});

test('No <iframe sandbox> attribute anywhere in src components', () => {
  const componentsDir = path.join(ROOT, 'src/components');
  const files = fs.readdirSync(componentsDir).filter(f => f.endsWith('.tsx'));
  for (const file of files) {
    const content = fs.readFileSync(path.join(componentsDir, file), 'utf8');
    assert.equal(/<iframe[^>]*\bsandbox\b/i.test(content), false, `Found forbidden iframe sandbox in ${file}`);
  }
});

test('SSR routes render valid HTML, zero sandbox iframes, and proper robots meta', async t => {
  let reachable = true;
  try {
    const res = await fetch(`${BASE_URL}/api/dramas`);
    if (!res.ok) reachable = false;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    t.skip(`Live server not running at ${BASE_URL}`);
    return;
  }

  const dramasRes = await fetch(`${BASE_URL}/api/dramas`);
  assert.equal(dramasRes.status, 200);
  const dramasJson = await dramasRes.json();
  assert.ok(Array.isArray(dramasJson.dramas) && dramasJson.dramas.length > 0);
  const sampleSlug = dramasJson.dramas[0].slug;

  const homeRes = await fetch(`${BASE_URL}/`);
  assert.equal(homeRes.status, 200);
  const homeHtml = await homeRes.text();
  assert.match(homeHtml, /HindiDrama\.net/i);
  assert.equal(/<iframe[^>]*\bsandbox\b/i.test(homeHtml), false);

  const detailRes = await fetch(`${BASE_URL}/drama/${encodeURIComponent(sampleSlug)}`);
  assert.equal(detailRes.status, 200);
  const detailHtml = await detailRes.text();
  assert.match(detailHtml, /application\/ld\+json/i);

  const watchRes = await fetch(`${BASE_URL}/watch/${encodeURIComponent(sampleSlug)}/episode-1`);
  assert.equal(watchRes.status, 200);
  const watchHtml = await watchRes.text();
  assert.equal(/<iframe[^>]*\bsandbox\b/i.test(watchHtml), false);

  const adminRes = await fetch(`${BASE_URL}/admin`);
  assert.equal(adminRes.status, 200);
  const adminHtml = await adminRes.text();
  assert.match(adminHtml, /noindex/i);
});

test('Admin Auth & Real Separate Counters (Visits vs Poster Clicks vs Plays) & Source CRUD', async t => {
  let reachable = true;
  try {
    const ping = await fetch(`${BASE_URL}/api/dramas`);
    if (!ping.ok) reachable = false;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    t.skip(`Live server not running at ${BASE_URL}`);
    return;
  }

  // 1. Unauthenticated overview must return 401
  const unauthRes = await fetch(`${BASE_URL}/api/admin/overview`);
  assert.equal(unauthRes.status, 401);

  // 2. Invalid password must return 401
  const badLogin = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: 'wrong-password-xyz' }),
  });
  assert.equal(badLogin.status, 401);

  // 3. Valid login returns Bearer token (if test shell has matching ADMIN_PASSWORD)
  const loginRes = await fetch(`${BASE_URL}/api/admin/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ password: ADMIN_PASS }),
  });
  if (loginRes.status === 401 && !process.env.ADMIN_PASSWORD) {
    t.skip('Live server uses configured ADMIN_PASSWORD secret not exposed to test shell');
    return;
  }
  assert.equal(loginRes.status, 200);
  const loginJson = await loginRes.json();
  assert.ok(loginJson.ok && loginJson.token);
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${loginJson.token}`,
  };

  // 4. Read baseline counters
  const beforeJson = await (await fetch(`${BASE_URL}/api/admin/overview`, { headers: authHeaders })).json();
  assert.equal(beforeJson.ok, true);
  const before = beforeJson.data;
  assert.equal(before.catalog.duplicateTmdbCount, 0);

  // 5. Record 1 real page_view -> only totalVisits increments
  await fetch(`${BASE_URL}/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type: 'page_view', path: '/test-visit', sessionId: 'test-sess-1' }),
  });
  const afterVisit = (await (await fetch(`${BASE_URL}/api/admin/overview`, { headers: authHeaders })).json()).data;
  assert.equal(afterVisit.traffic.totalVisits, before.traffic.totalVisits + 1);
  assert.equal(afterVisit.traffic.totalPosterClicks, before.traffic.totalPosterClicks);

  // 6. Record 1 real poster_click -> only totalPosterClicks increments (visits stay constant)
  await fetch(`${BASE_URL}/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'poster_click',
      dramaSlug: 'squid-game',
      dramaTitle: 'Squid Game',
      sessionId: 'test-sess-1',
    }),
  });
  const afterClick = (await (await fetch(`${BASE_URL}/api/admin/overview`, { headers: authHeaders })).json()).data;
  assert.equal(afterClick.traffic.totalVisits, afterVisit.traffic.totalVisits);
  assert.equal(afterClick.traffic.totalPosterClicks, afterVisit.traffic.totalPosterClicks + 1);

  // 6b. Record 1 real episode_play -> only totalEpisodePlays increments
  await fetch(`${BASE_URL}/api/analytics/event`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      type: 'episode_play',
      dramaSlug: 'squid-game',
      dramaTitle: 'Squid Game',
      episode: 1,
      serverName: 'VidLink',
      sessionId: 'test-sess-1',
    }),
  });
  const afterPlay = (await (await fetch(`${BASE_URL}/api/admin/overview`, { headers: authHeaders })).json()).data;
  assert.equal(afterPlay.traffic.totalEpisodePlays, afterClick.traffic.totalEpisodePlays + 1);
  assert.equal(afterPlay.traffic.totalVisits, afterClick.traffic.totalVisits);
  assert.equal(afterPlay.traffic.totalPosterClicks, afterClick.traffic.totalPosterClicks);

  // 7. Manual Authorized Source CRUD + Cleanup
  const createSrcRes = await fetch(`${BASE_URL}/api/admin/sources`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      dramaSlug: 'squid-game',
      season: 1,
      episode: 1,
      label: 'Test HLS Source',
      url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
      format: 'hls',
    }),
  });
  assert.equal(createSrcRes.status, 200);
  const created = await createSrcRes.json();
  assert.ok(created.ok && created.source?.id);
  const sourceId = created.source.id;

  const publicSrcs = await (await fetch(`${BASE_URL}/api/sources/squid-game/1`)).json();
  assert.ok(publicSrcs.sources.some(s => s.id === sourceId));

  // Toggle off
  const toggleRes = await fetch(`${BASE_URL}/api/admin/sources/${encodeURIComponent(sourceId)}/toggle`, {
    method: 'POST',
    headers: authHeaders,
  });
  assert.equal(toggleRes.status, 200);
  const publicAfterToggle = await (await fetch(`${BASE_URL}/api/sources/squid-game/1`)).json();
  assert.equal(publicAfterToggle.sources.some(s => s.id === sourceId), false);

  // Clean up test source
  const delRes = await fetch(`${BASE_URL}/api/admin/sources/${encodeURIComponent(sourceId)}`, {
    method: 'DELETE',
    headers: authHeaders,
  });
  assert.equal(delRes.status, 200);
});

test('Live /api/embed-resolve returns playable streams or embeds for Dailymotion, Archive, Wikimedia, and PeerTube', async t => {
  let reachable = true;
  try {
    const ping = await fetch(`${BASE_URL}/api/dramas`);
    if (!ping.ok) reachable = false;
  } catch {
    reachable = false;
  }

  if (!reachable) {
    t.skip(`Live server not running at ${BASE_URL}`);
    return;
  }

  const queries = [
    { provider: 'dailymotion', title: 'Squid Game', type: 'tv', season: 1, episode: 1, lang: 'hi' },
    { provider: 'archive', title: 'Night of the Living Dead', type: 'movie', season: 1, episode: 1, lang: 'en' },
    { provider: 'wikimedia', title: 'Korea', type: 'movie', season: 1, episode: 1, lang: 'en' },
    { provider: 'peertube', title: 'Korea', type: 'tv', season: 1, episode: 1, lang: 'en' },
  ];

  for (const payload of queries) {
    const res = await fetch(`${BASE_URL}/api/embed-resolve`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    assert.equal(res.status, 200, `Expected 200 for ${payload.provider}`);
    const data = await res.json();
    assert.equal(data.ok, true, `Expected ok=true for ${payload.provider}: ${JSON.stringify(data)}`);
    assert.ok(
      (typeof data.streamUrl === 'string' && data.streamUrl.startsWith('http')) ||
        (typeof data.embedUrl === 'string' && data.embedUrl.startsWith('http')),
      `Expected valid http streamUrl or embedUrl for ${payload.provider}`
    );
  }
});
