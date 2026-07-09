export const STORAGE_KEY = 'cip.session.v1';

export interface PersistedSession {
  token: string;
  user: {
    id: string;
    name?: string | null;
    mobile?: string | null;
    email?: string | null;
    roles: string[];
  };
}

export function readSession(): PersistedSession | null {
  if (typeof window === 'undefined') {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw) as PersistedSession;
    if (!parsed.token || !parsed.user) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function writeSession(session: PersistedSession | null): void {
  if (typeof window === 'undefined') {
    return;
  }
  if (session === null) {
    window.localStorage.removeItem(STORAGE_KEY);
    return;
  }
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

/**
 * Called when the API rejects a request as unauthorized (HTTP 401 /
 * `UNAUTHORIZED`). Clears the stale session and sends the user to the
 * shared login page so they can re-authenticate instead of being stuck on
 * a "could not load" screen. Guarded against redirect loops.
 */
export function handleUnauthorized(): void {
  if (typeof window === 'undefined') {
    return;
  }
  writeSession(null);
  if (window.location.pathname.startsWith('/login')) {
    return;
  }
  window.location.assign('/login');
}
