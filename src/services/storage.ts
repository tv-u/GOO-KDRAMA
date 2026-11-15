import type { AudioLanguageCode, DramaComment, DramaRequest } from '../types/drama.ts';

const COMMENTS_STORAGE_KEY = 'hindidrama_comments_v1';
const REQUESTS_STORAGE_KEY = 'hindidrama_requests_v1';
const HISTORY_STORAGE_KEY = 'hindidrama_history_v1';
const PREFERRED_AUDIO_KEY = 'hindidrama_preferred_audio_lang';

const hasStorage = () => typeof window !== 'undefined' && typeof localStorage !== 'undefined';

export function getPreferredAudioLang(): AudioLanguageCode {
  if (!hasStorage()) return 'hi';
  try {
    const saved = localStorage.getItem(PREFERRED_AUDIO_KEY);
    if (saved === 'hi' || saved === 'ko' || saved === 'ta' || saved === 'te' || saved === 'en' || saved === 'ur') {
      return saved;
    }
  } catch {
    // ignore storage errors
  }
  return 'hi';
}

export function savePreferredAudioLang(lang: AudioLanguageCode): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(PREFERRED_AUDIO_KEY, lang);
  } catch {
    // ignore storage errors
  }
}

export function getCommentsForDrama(slug: string): DramaComment[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
    const allComments: DramaComment[] = raw ? JSON.parse(raw) : [];
    return allComments.filter(c => c.dramaSlug.toLowerCase() === slug.toLowerCase());
  } catch {
    return [];
  }
}

export function addComment(comment: Omit<DramaComment, 'id' | 'createdAt' | 'likes'>): DramaComment {
  const newComment: DramaComment = {
    ...comment,
    id: 'cmt_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    createdAt: 'Just now',
    likes: 0,
  };

  if (hasStorage()) {
    try {
      const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
      const allComments: DramaComment[] = raw ? JSON.parse(raw) : [];
      allComments.unshift(newComment);
      localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(allComments));
    } catch (err) {
      console.error('Failed to save comment', err);
    }
  }

  return newComment;
}

export function likeComment(commentId: string): number {
  if (!hasStorage()) return 0;
  try {
    const raw = localStorage.getItem(COMMENTS_STORAGE_KEY);
    const allComments: DramaComment[] = raw ? JSON.parse(raw) : [];
    const target = allComments.find(c => c.id === commentId);
    if (target) {
      target.likes += 1;
      localStorage.setItem(COMMENTS_STORAGE_KEY, JSON.stringify(allComments));
      return target.likes;
    }
  } catch (e) {
    console.error('Failed to like comment', e);
  }
  return 0;
}

export function getDramaRequests(): DramaRequest[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(REQUESTS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function submitDramaRequest(title: string, country: string, notes?: string): DramaRequest {
  const req: DramaRequest = {
    id: 'req_' + Date.now(),
    title,
    country,
    notes,
    createdAt: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
    status: 'Pending',
  };

  if (hasStorage()) {
    try {
      const list = getDramaRequests();
      list.unshift(req);
      localStorage.setItem(REQUESTS_STORAGE_KEY, JSON.stringify(list));
    } catch (e) {
      console.error('Failed to save request', e);
    }
  }

  return req;
}

export interface WatchHistoryItem {
  dramaSlug: string;
  dramaTitle: string;
  episode: number;
  poster: string;
  timestamp: number;
  progressSeconds?: number;
  durationSeconds?: number;
  totalEpisodes?: number;
  type?: 'tv' | 'movie';
  country?: string;
  year?: number;
}

export interface LibraryDramaRef {
  slug: string;
  title: string;
  poster: string;
  country: string;
  year: number;
  rating: number;
  totalEpisodes: number;
  type?: 'tv' | 'movie';
  genres?: string[];
  addedAt: number;
}

const WATCHLIST_KEY = 'hindidrama_watchlist_v1';
const FAVORITES_KEY = 'hindidrama_favorites_v1';
const RECENTLY_VIEWED_KEY = 'hindidrama_recently_viewed_v1';
const WATCHED_EPISODES_KEY = 'hindidrama_watched_episodes_v1';
const SEARCH_HISTORY_KEY = 'hindidrama_search_history_v1';
const LAST_SERVER_KEY = 'hindidrama_last_working_server_v1';
const SESSION_ID_KEY = 'hindidrama_visitor_session_v1';

export function getOrCreateVisitorSessionId(): string {
  if (!hasStorage()) return 'ssr-session';
  try {
    const existing = localStorage.getItem(SESSION_ID_KEY);
    if (existing) return existing;
    const generated = `v_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(SESSION_ID_KEY, generated);
    return generated;
  } catch {
    return 'anon-session';
  }
}

export function saveWatchHistory(item: Omit<WatchHistoryItem, 'timestamp'>) {
  if (!hasStorage()) return;
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const list: WatchHistoryItem[] = raw ? JSON.parse(raw) : [];
    const existing = list.find(i => i.dramaSlug === item.dramaSlug && i.episode === item.episode);
    const merged: WatchHistoryItem = {
      ...existing,
      ...item,
      timestamp: Date.now(),
    };
    const filtered = list.filter(i => i.dramaSlug !== item.dramaSlug);
    filtered.unshift(merged);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered.slice(0, 50)));
  } catch (e) {
    console.error('Failed to save history', e);
  }
}

export function saveEpisodePlaybackProgress(
  dramaSlug: string,
  episode: number,
  progressSeconds: number,
  durationSeconds: number
): void {
  if (!hasStorage() || !Number.isFinite(progressSeconds) || progressSeconds < 0) return;
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const list: WatchHistoryItem[] = raw ? JSON.parse(raw) : [];
    const idx = list.findIndex(i => i.dramaSlug === dramaSlug);
    if (idx !== -1) {
      list[idx] = {
        ...list[idx],
        episode,
        progressSeconds: Math.floor(progressSeconds),
        durationSeconds: Math.floor(durationSeconds || list[idx].durationSeconds || 0),
        timestamp: Date.now(),
      };
      localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(list));
    }

    const epProgressKey = `hindidrama_ep_pos_${dramaSlug}_e${episode}`;
    localStorage.setItem(
      epProgressKey,
      JSON.stringify({
        progressSeconds: Math.floor(progressSeconds),
        durationSeconds: Math.floor(durationSeconds || 0),
        updatedAt: Date.now(),
      })
    );
  } catch {
    // ignore storage quota errors
  }
}

export function getEpisodePlaybackProgress(
  dramaSlug: string,
  episode: number
): { progressSeconds: number; durationSeconds: number } {
  if (!hasStorage()) return { progressSeconds: 0, durationSeconds: 0 };
  try {
    const raw = localStorage.getItem(`hindidrama_ep_pos_${dramaSlug}_e${episode}`);
    if (!raw) return { progressSeconds: 0, durationSeconds: 0 };
    const parsed = JSON.parse(raw);
    return {
      progressSeconds: Number(parsed?.progressSeconds) || 0,
      durationSeconds: Number(parsed?.durationSeconds) || 0,
    };
  } catch {
    return { progressSeconds: 0, durationSeconds: 0 };
  }
}

export function getWatchHistory(): WatchHistoryItem[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function removeWatchHistoryItem(dramaSlug: string): WatchHistoryItem[] {
  if (!hasStorage()) return [];
  try {
    const updated = getWatchHistory().filter(i => i.dramaSlug !== dramaSlug);
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function markEpisodeWatched(dramaSlug: string, episode: number): number[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(WATCHED_EPISODES_KEY);
    const map: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    const existing = new Set<number>(Array.isArray(map[dramaSlug]) ? map[dramaSlug] : []);
    existing.add(episode);
    const sorted = Array.from(existing).sort((a, b) => a - b);
    map[dramaSlug] = sorted;
    localStorage.setItem(WATCHED_EPISODES_KEY, JSON.stringify(map));
    return sorted;
  } catch {
    return [];
  }
}

export function getWatchedEpisodesForDrama(dramaSlug: string): number[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(WATCHED_EPISODES_KEY);
    const map: Record<string, number[]> = raw ? JSON.parse(raw) : {};
    return Array.isArray(map[dramaSlug]) ? map[dramaSlug] : [];
  } catch {
    return [];
  }
}

function readLibraryList(key: string): LibraryDramaRef[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

function toggleLibraryList(key: string, item: Omit<LibraryDramaRef, 'addedAt'>): { added: boolean; items: LibraryDramaRef[] } {
  if (!hasStorage()) return { added: false, items: [] };
  const list = readLibraryList(key);
  const exists = list.some(x => x.slug === item.slug);
  const updated = exists
    ? list.filter(x => x.slug !== item.slug)
    : [{ ...item, addedAt: Date.now() }, ...list].slice(0, 100);
  try {
    localStorage.setItem(key, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
  return { added: !exists, items: updated };
}

export function getWatchlist(): LibraryDramaRef[] {
  return readLibraryList(WATCHLIST_KEY);
}

export function isInWatchlist(slug: string): boolean {
  return getWatchlist().some(x => x.slug === slug);
}

export function toggleWatchlist(item: Omit<LibraryDramaRef, 'addedAt'>) {
  return toggleLibraryList(WATCHLIST_KEY, item);
}

export function getFavorites(): LibraryDramaRef[] {
  return readLibraryList(FAVORITES_KEY);
}

export function isFavorite(slug: string): boolean {
  return getFavorites().some(x => x.slug === slug);
}

export function toggleFavorite(item: Omit<LibraryDramaRef, 'addedAt'>) {
  return toggleLibraryList(FAVORITES_KEY, item);
}

export function getRecentlyViewed(): LibraryDramaRef[] {
  return readLibraryList(RECENTLY_VIEWED_KEY);
}

export function addRecentlyViewed(item: Omit<LibraryDramaRef, 'addedAt'>): void {
  if (!hasStorage()) return;
  const list = readLibraryList(RECENTLY_VIEWED_KEY).filter(x => x.slug !== item.slug);
  const updated = [{ ...item, addedAt: Date.now() }, ...list].slice(0, 30);
  try {
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // ignore storage errors
  }
}

export function getSearchHistory(): string[] {
  if (!hasStorage()) return [];
  try {
    const raw = localStorage.getItem(SEARCH_HISTORY_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export function addSearchHistory(query: string): string[] {
  const clean = query.trim();
  if (!hasStorage() || clean.length < 2) return getSearchHistory();
  try {
    const existing = getSearchHistory().filter(q => q.toLowerCase() !== clean.toLowerCase());
    const updated = [clean, ...existing].slice(0, 10);
    localStorage.setItem(SEARCH_HISTORY_KEY, JSON.stringify(updated));
    return updated;
  } catch {
    return [];
  }
}

export function clearSearchHistory(): void {
  if (!hasStorage()) return;
  try {
    localStorage.removeItem(SEARCH_HISTORY_KEY);
  } catch {
    // ignore
  }
}

export function getLastWorkingServer(): number | null {
  if (!hasStorage()) return null;
  try {
    const raw = localStorage.getItem(LAST_SERVER_KEY);
    if (!raw) return null;
    const n = parseInt(raw, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  } catch {
    return null;
  }
}

export function saveLastWorkingServer(serverId: number): void {
  if (!hasStorage()) return;
  try {
    localStorage.setItem(LAST_SERVER_KEY, String(serverId));
  } catch {
    // ignore
  }
}

export function trackPlatformEvent(event: {
  type: 'page_view' | 'poster_click' | 'episode_play' | 'source_health' | 'playback_error';
  path?: string;
  dramaSlug?: string;
  dramaTitle?: string;
  episode?: number;
  serverId?: number;
  serverName?: string;
  ok?: boolean;
  latencyMs?: number;
  reason?: string;
}): void {
  if (typeof window === 'undefined') return;
  if (window.location.hostname.endsWith('.github.io')) return;

  const payload = {
    ...event,
    sessionId: getOrCreateVisitorSessionId(),
  };

  fetch('/api/analytics/event', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    keepalive: true,
  }).catch(() => {});
}
