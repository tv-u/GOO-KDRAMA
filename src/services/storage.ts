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
    if (saved === 'hi' || saved === 'ko' || saved === 'ta' || saved === 'te' || saved === 'en') {
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
}

export function saveWatchHistory(item: Omit<WatchHistoryItem, 'timestamp'>) {
  if (!hasStorage()) return;
  try {
    const raw = localStorage.getItem(HISTORY_STORAGE_KEY);
    const list: WatchHistoryItem[] = raw ? JSON.parse(raw) : [];
    const filtered = list.filter(i => i.dramaSlug !== item.dramaSlug);
    filtered.unshift({ ...item, timestamp: Date.now() });
    localStorage.setItem(HISTORY_STORAGE_KEY, JSON.stringify(filtered.slice(0, 20)));
  } catch (e) {
    console.error('Failed to save history', e);
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
