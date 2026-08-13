export const STORAGE_KEY = 'cip.session.v1';

export interface PersistedSession {
  token: string;
  refresh_token?: string | null;
  refresh_expires_at?: string | null;
  user: {
    id: string;
    name?: string | null;
    mobile?: string | null;
    email?: string | null;
    roles: string[];
    departments?: Array<{
      id: string;
      code: string;
      name: string;
      is_manager: boolean;
    }>;
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

export function getToken(): string | null {
  return readSession()?.token ?? null;
}

export function getRefreshToken(): string | null {
  return readSession()?.refresh_token ?? null;
}

/** Replace the access/refresh tokens while preserving the rest of the session. */
export function setTokens(accessToken: string, refreshToken?: string | null, refreshExpiresAt?: string | null): void {
  const current = readSession();
  if (current === null) {
    return;
  }
  writeSession({
    ...current,
    token: accessToken,
    refresh_token: refreshToken !== undefined ? refreshToken : current.refresh_token,
    refresh_expires_at: refreshExpiresAt !== undefined ? refreshExpiresAt : current.refresh_expires_at,
  });
}

/**
 * Called when the API rejects a request as unauthorized (HTTP 401 /
 * `UNAUTHORIZED`) and token refresh either failed or was unavailable.
 * Clears the stale session and sends the user to the shared login page
 * so they can re-authenticate instead of being stuck on a "could not
 * load" screen. Guarded against redirect loops.
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
