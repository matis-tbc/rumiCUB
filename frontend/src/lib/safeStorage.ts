/**
 * Incognito-safe localStorage wrapper. In private browsing or with storage
 * disabled, the native localStorage can throw QuotaExceededError or
 * SecurityError. This wraps every call in a try/catch so callers degrade
 * gracefully (read returns null, write returns false).
 */

export function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function safeSet(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value);
    return true;
  } catch {
    return false;
  }
}

export function safeRemove(key: string): boolean {
  try {
    window.localStorage.removeItem(key);
    return true;
  } catch {
    return false;
  }
}

export const STORAGE_KEYS = {
  gameId: "rumicube.game_id",
  seenIntro: "rumicube.seen_intro",
  clickSeenCount: "rumicube.click_seen_count",
} as const;
