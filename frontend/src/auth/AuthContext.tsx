import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { type JSX } from 'react';
import { readSession, writeSession, type PersistedSession } from './storage';

export type Role =
  | 'citizen'
  | 'moderator'
  | 'department_officer'
  | 'department_admin'
  | 'super_admin'
  | 'system'
  | 'auditor';

export interface SessionUser {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: Role[];
  departments?: Array<{
    id: string;
    code: string;
    name: string;
    is_manager: boolean;
  }>;
}

export type SessionUserPatch = Partial<Pick<SessionUser, 'name' | 'mobile' | 'email'>>;

export interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  isAuthenticated: boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  login: (
    token: string,
    user: SessionUser,
    refreshToken?: string | null,
    refreshExpiresAt?: string | null,
  ) => void;
  updateUser: (patch: SessionUserPatch) => void;
  logout: () => void;
  loading: boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }): JSX.Element {
  const [user, setUser] = useState<SessionUser | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    const persisted = readSession();
    if (persisted !== null) {
      setToken(persisted.token);
      setUser({
        id: persisted.user.id,
        name: persisted.user.name ?? null,
        mobile: persisted.user.mobile ?? null,
        email: persisted.user.email ?? null,
        roles: persisted.user.roles as unknown as Role[],
        departments: persisted.user.departments,
      });
    }
    setLoading(false);
  }, []);

  const login = useCallback(
    (
      nextToken: string,
      nextUser: SessionUser,
      refreshToken?: string | null,
      refreshExpiresAt?: string | null,
    ): void => {
      setToken(nextToken);
      setUser(nextUser);
      const persistedUser: PersistedSession['user'] = {
        id: nextUser.id,
        name: nextUser.name ?? null,
        mobile: nextUser.mobile ?? null,
        email: nextUser.email ?? null,
        roles: nextUser.roles,
        departments: nextUser.departments,
      };
      writeSession({
        token: nextToken,
        refresh_token: refreshToken ?? undefined,
        refresh_expires_at: refreshExpiresAt ?? undefined,
        user: persistedUser,
      });
    },
    [],
  );

  const updateUser = useCallback(
    (patch: SessionUserPatch): void => {
      if (user === null) {
        return;
      }
      const nextUser = { ...user, ...patch };
      setUser(nextUser);
      const persisted = readSession();
      if (persisted !== null) {
        writeSession({
          ...persisted,
          user: { ...persisted.user, ...patch },
        });
      }
    },
    [user],
  );

  const logout = useCallback((): void => {
    const persisted = readSession();
    const ownerId = user?.id;

    // Revoke the server-side Sanctum access token and all active refresh
    // tokens before clearing local state. This is intentionally best effort:
    // logout must still complete when the device is offline or the API is
    // unavailable, while the backend endpoint remains the source of truth
    // for token revocation.
    if (persisted?.token && typeof window !== 'undefined') {
      const apiBase = (import.meta.env['VITE_API_BASE'] as string | undefined) ?? '/api/v1';
      try {
        const url = new URL(`${apiBase}/auth/logout`, window.location.origin).toString();
        void fetch(url, {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${persisted.token}`,
          },
          credentials: 'same-origin',
          keepalive: true,
        }).catch(() => undefined);
      } catch {
        // Invalid runtime configuration must not prevent local logout.
      }
    }

    if (typeof window !== 'undefined' && ownerId) {
      window.dispatchEvent(new CustomEvent('cip:auth-logout', { detail: { ownerId } }));
      // Phase 4: clear device-local offline queue tied to this user/session per retention policy
      try {
        window.localStorage.removeItem(`cip_offline_queue:${ownerId}`);
      } catch {
        // ignore storage errors
      }
    }
    setToken(null);
    setUser(null);
    writeSession(null);
  }, [user]);

  const hasAnyRole = useCallback(
    (roles: Role[]): boolean => {
      if (user === null) {
        return false;
      }
      return user.roles.some((r) => roles.includes(r));
    },
    [user],
  );

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      token,
      isAuthenticated: token !== null && user !== null,
      hasAnyRole,
      login,
      updateUser,
      logout,
      loading,
    }),
    [user, token, hasAnyRole, login, updateUser, logout, loading],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (ctx === null) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
