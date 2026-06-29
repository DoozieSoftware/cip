import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { type JSX } from 'react';
import { readSession, writeSession, type PersistedSession } from './storage';

export type Role = 'citizen' | 'moderator' | 'department_officer' | 'department_admin' | 'super_admin' | 'system' | 'auditor';

export interface SessionUser {
  id: string;
  name?: string | null;
  mobile?: string | null;
  email?: string | null;
  roles: Role[];
}

export interface AuthContextValue {
  user: SessionUser | null;
  token: string | null;
  isAuthenticated: boolean;
  hasAnyRole: (roles: Role[]) => boolean;
  login: (token: string, user: SessionUser) => void;
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
      });
    }
    setLoading(false);
  }, []);

  const login = useCallback((nextToken: string, nextUser: SessionUser): void => {
    setToken(nextToken);
    setUser(nextUser);
    const persistedUser: PersistedSession['user'] = {
      id: nextUser.id,
      name: nextUser.name ?? null,
      mobile: nextUser.mobile ?? null,
      email: nextUser.email ?? null,
      roles: nextUser.roles,
    };
    writeSession({ token: nextToken, user: persistedUser });
  }, []);

  const logout = useCallback((): void => {
    setToken(null);
    setUser(null);
    writeSession(null);
  }, []);

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
      logout,
      loading,
    }),
    [user, token, hasAnyRole, login, logout, loading],
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
