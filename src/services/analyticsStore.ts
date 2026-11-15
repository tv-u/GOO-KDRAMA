import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import type {
  AdminOverviewData,
  AnalyticsEventPayload,
  CustomStreamSource,
  Drama,
  SyncLogEntry,
} from '../types/drama.ts';

interface PersistedAnalyticsState {
  totalVisits: number;
  uniqueVisitorIds: string[];
  totalPosterClicks: number;
  totalEpisodePlays: number;
  titleStats: Record<
    string,
    { slug: string; title: string; visits: number; posterClicks: number; episodePlays: number }
  >;
  episodeStats: Record<
    string,
    { key: string; dramaSlug: string; dramaTitle: string; episode: number; plays: number }
  >;
  sourceHealth: Record<
    string,
    {
      serverId: number;
      serverName: string;
      checks: number;
      successes: number;
      failures: number;
      totalLatencyMs: number;
      lastError?: string;
      lastCheckedAt?: string;
    }
  >;
  failedReports: {
    id: string;
    timestamp: string;
    dramaSlug: string;
    episode: number;
    serverName: string;
    reason: string;
  }[];
  syncLogs: SyncLogEntry[];
  manualSources: CustomStreamSource[];
}

const DEFAULT_STATE: PersistedAnalyticsState = {
  totalVisits: 0,
  uniqueVisitorIds: [],
  totalPosterClicks: 0,
  totalEpisodePlays: 0,
  titleStats: {},
  episodeStats: {},
  sourceHealth: {},
  failedReports: [],
  syncLogs: [],
  manualSources: [],
};

const STORE_DIR = path.resolve(process.cwd(), '.data');
const STORE_FILE = path.join(STORE_DIR, 'platform-analytics.json');

let memoryState: PersistedAnalyticsState = loadPersistedState();
let flushTimer: ReturnType<typeof setTimeout> | null = null;

function loadPersistedState(): PersistedAnalyticsState {
  try {
    if (fs.existsSync(STORE_FILE)) {
      const raw = fs.readFileSync(STORE_FILE, 'utf-8');
      const parsed = JSON.parse(raw) as Partial<PersistedAnalyticsState>;
      return {
        ...DEFAULT_STATE,
        ...parsed,
        uniqueVisitorIds: Array.isArray(parsed.uniqueVisitorIds) ? parsed.uniqueVisitorIds : [],
        failedReports: Array.isArray(parsed.failedReports) ? parsed.failedReports : [],
        syncLogs: Array.isArray(parsed.syncLogs) ? parsed.syncLogs : [],
        manualSources: Array.isArray(parsed.manualSources) ? parsed.manualSources : [],
      };
    }
  } catch {
    // fallback to clean memory state if filesystem is ephemeral/unavailable
  }
  return structuredClone(DEFAULT_STATE);
}

function scheduleFlush(): void {
  if (flushTimer) return;
  flushTimer = setTimeout(() => {
    flushTimer = null;
    try {
      if (!fs.existsSync(STORE_DIR)) {
        fs.mkdirSync(STORE_DIR, { recursive: true });
      }
      fs.writeFileSync(STORE_FILE, JSON.stringify(memoryState, null, 2), 'utf-8');
    } catch {
      // Ignore write failures on read-only deployment environments
    }
  }, 500);
}

export function getAdminPassword(): string {
  return process.env.ADMIN_PASSWORD || 'admin123';
}

function getSessionSecret(): string {
  return (
    process.env.ADMIN_SESSION_SECRET ||
    `${process.env.TMDB_API_KEY || 'hindidrama'}-admin-session-key`
  );
}

export function verifyAdminPassword(candidate: string): boolean {
  const expected = getAdminPassword();
  if (!candidate || candidate.length !== expected.length) return false;
  return crypto.timingSafeEqual(Buffer.from(candidate), Buffer.from(expected));
}

export function createAdminToken(ttlSeconds = 86_400): string {
  const exp = Math.floor(Date.now() / 1000) + ttlSeconds;
  const payload = Buffer.from(JSON.stringify({ role: 'admin', exp })).toString('base64url');
  const sig = crypto.createHmac('sha256', getSessionSecret()).update(payload).digest('base64url');
  return `${payload}.${sig}`;
}

export function verifyAdminToken(authHeader?: string | null): boolean {
  if (!authHeader || !authHeader.startsWith('Bearer ')) return false;
  const token = authHeader.slice(7).trim();
  const parts = token.split('.');
  if (parts.length !== 2) return false;
  const [payload, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', getSessionSecret())
    .update(payload)
    .digest('base64url');
  if (sig.length !== expectedSig.length) return false;
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expectedSig))) return false;
  try {
    const decoded = JSON.parse(Buffer.from(payload, 'base64url').toString('utf-8')) as {
      role?: string;
      exp?: number;
    };
    return decoded.role === 'admin' && typeof decoded.exp === 'number' && decoded.exp > Date.now() / 1000;
  } catch {
    return false;
  }
}

export function recordAnalyticsEvent(event: AnalyticsEventPayload): void {
  if (!event || !event.type) return;

  if (event.sessionId && !memoryState.uniqueVisitorIds.includes(event.sessionId)) {
    memoryState.uniqueVisitorIds.push(event.sessionId);
    if (memoryState.uniqueVisitorIds.length > 20_000) {
      memoryState.uniqueVisitorIds = memoryState.uniqueVisitorIds.slice(-15_000);
    }
  }

  const ensureTitleBucket = (slug: string, title?: string) => {
    if (!memoryState.titleStats[slug]) {
      memoryState.titleStats[slug] = {
        slug,
        title: title || slug,
        visits: 0,
        posterClicks: 0,
        episodePlays: 0,
      };
    } else if (title && memoryState.titleStats[slug].title === slug) {
      memoryState.titleStats[slug].title = title;
    }
    return memoryState.titleStats[slug];
  };

  if (event.type === 'page_view') {
    memoryState.totalVisits += 1;
    if (event.dramaSlug) {
      ensureTitleBucket(event.dramaSlug, event.dramaTitle).visits += 1;
    }
  } else if (event.type === 'poster_click') {
    memoryState.totalPosterClicks += 1;
    if (event.dramaSlug) {
      ensureTitleBucket(event.dramaSlug, event.dramaTitle).posterClicks += 1;
    }
  } else if (event.type === 'episode_play') {
    memoryState.totalEpisodePlays += 1;
    if (event.dramaSlug) {
      ensureTitleBucket(event.dramaSlug, event.dramaTitle).episodePlays += 1;
      const ep = Math.max(1, Number(event.episode || 1));
      const key = `${event.dramaSlug}::ep-${ep}`;
      if (!memoryState.episodeStats[key]) {
        memoryState.episodeStats[key] = {
          key,
          dramaSlug: event.dramaSlug,
          dramaTitle: event.dramaTitle || event.dramaSlug,
          episode: ep,
          plays: 0,
        };
      }
      memoryState.episodeStats[key].plays += 1;
    }
  } else if (event.type === 'source_health') {
    const sId = Number(event.serverId ?? -1);
    const sName = event.serverName || `Server ${sId}`;
    const key = `${sId}:${sName}`;
    if (!memoryState.sourceHealth[key]) {
      memoryState.sourceHealth[key] = {
        serverId: sId,
        serverName: sName,
        checks: 0,
        successes: 0,
        failures: 0,
        totalLatencyMs: 0,
      };
    }
    const bucket = memoryState.sourceHealth[key];
    bucket.checks += 1;
    if (event.ok) {
      bucket.successes += 1;
    } else {
      bucket.failures += 1;
      bucket.lastError = event.reason || 'Stream unavailable';
    }
    if (typeof event.latencyMs === 'number' && Number.isFinite(event.latencyMs)) {
      bucket.totalLatencyMs += Math.max(0, event.latencyMs);
    }
    bucket.lastCheckedAt = new Date().toISOString();
  } else if (event.type === 'playback_error') {
    memoryState.failedReports.unshift({
      id: `err_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      timestamp: new Date().toISOString(),
      dramaSlug: event.dramaSlug || 'unknown',
      episode: Math.max(1, Number(event.episode || 1)),
      serverName: event.serverName || 'Unknown Server',
      reason: (event.reason || 'Playback failed').slice(0, 200),
    });
    memoryState.failedReports = memoryState.failedReports.slice(0, 100);
  }

  scheduleFlush();
}

export function appendSyncLog(entry: Omit<SyncLogEntry, 'id' | 'timestamp'>): SyncLogEntry {
  const full: SyncLogEntry = {
    ...entry,
    id: `sync_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    timestamp: new Date().toISOString(),
  };
  memoryState.syncLogs.unshift(full);
  memoryState.syncLogs = memoryState.syncLogs.slice(0, 40);
  scheduleFlush();
  return full;
}

export function getManualSourcesForEpisode(dramaSlug: string, episode: number): CustomStreamSource[] {
  const slugLower = dramaSlug.toLowerCase();
  return memoryState.manualSources.filter(
    s => s.active && s.dramaSlug.toLowerCase() === slugLower && (s.episode === episode || s.episode === 0)
  );
}

export function addManualSource(input: {
  dramaSlug: string;
  season?: number;
  episode?: number;
  label: string;
  url: string;
  format: 'hls' | 'dash' | 'mp4' | 'iframe';
  language?: CustomStreamSource['language'];
}): CustomStreamSource {
  const source: CustomStreamSource = {
    id: `src_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    dramaSlug: input.dramaSlug.trim().toLowerCase(),
    season: Math.max(1, Number(input.season || 1)),
    episode: Math.max(0, Number(input.episode ?? 1)),
    label: input.label.trim().slice(0, 60),
    url: input.url.trim(),
    format: input.format,
    language: input.language || 'hi',
    active: true,
    createdAt: new Date().toISOString(),
  };
  memoryState.manualSources.unshift(source);
  scheduleFlush();
  return source;
}

export function toggleManualSource(id: string): CustomStreamSource | null {
  const target = memoryState.manualSources.find(s => s.id === id);
  if (!target) return null;
  target.active = !target.active;
  scheduleFlush();
  return target;
}

export function deleteManualSource(id: string): boolean {
  const before = memoryState.manualSources.length;
  memoryState.manualSources = memoryState.manualSources.filter(s => s.id !== id);
  if (memoryState.manualSources.length !== before) {
    scheduleFlush();
    return true;
  }
  return false;
}

export function buildAdminOverview(dramas: Drama[]): AdminOverviewData {
  const seenTmdb = new Set<number>();
  let duplicateTmdbCount = 0;
  let missingMetadataCount = 0;
  let totalMovies = 0;
  let totalDramas = 0;
  let totalEpisodes = 0;
  let hindiOnlyCount = 0;

  for (const d of dramas) {
    if (d.type === 'movie') totalMovies += 1;
    else totalDramas += 1;
    totalEpisodes += Math.max(1, Number(d.totalEpisodes) || 1);
    if (d.hindiOnly) hindiOnlyCount += 1;
    if (!d.overview || !d.poster || !d.backdrop) missingMetadataCount += 1;
    if (d.tmdbId) {
      if (seenTmdb.has(d.tmdbId)) duplicateTmdbCount += 1;
      else seenTmdb.add(d.tmdbId);
    }
  }

  const topTitles = Object.values(memoryState.titleStats)
    .sort((a, b) => b.episodePlays + b.posterClicks + b.visits - (a.episodePlays + a.posterClicks + a.visits))
    .slice(0, 15);

  const popularEpisodes = Object.values(memoryState.episodeStats)
    .sort((a, b) => b.plays - a.plays)
    .slice(0, 15);

  const sourceHealth = Object.values(memoryState.sourceHealth)
    .map(s => ({
      serverId: s.serverId,
      serverName: s.serverName,
      checks: s.checks,
      successes: s.successes,
      failures: s.failures,
      avgLatencyMs: s.checks > 0 ? Math.round(s.totalLatencyMs / s.checks) : 0,
      lastError: s.lastError,
      lastCheckedAt: s.lastCheckedAt,
    }))
    .sort((a, b) => a.serverId - b.serverId);

  return {
    catalog: {
      totalTitles: dramas.length,
      totalMovies,
      totalDramas,
      totalEpisodes,
      hindiOnlyCount,
      missingMetadataCount,
      duplicateTmdbCount,
    },
    traffic: {
      totalVisits: memoryState.totalVisits,
      uniqueVisitors: memoryState.uniqueVisitorIds.length,
      totalPosterClicks: memoryState.totalPosterClicks,
      totalEpisodePlays: memoryState.totalEpisodePlays,
    },
    topTitles,
    popularEpisodes,
    sourceHealth,
    failedReports: memoryState.failedReports,
    syncLogs: memoryState.syncLogs,
    manualSources: memoryState.manualSources,
  };
}
