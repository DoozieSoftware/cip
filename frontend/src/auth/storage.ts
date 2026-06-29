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
