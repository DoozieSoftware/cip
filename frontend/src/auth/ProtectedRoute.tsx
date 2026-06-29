import { Navigate, useLocation } from 'react-router-dom';
import { type JSX } from 'react';
import type { ReactNode } from 'react';
import { useAuth, type Role } from './AuthContext';
import { Spinner } from '../portals/moderator/design';

export interface ProtectedRouteProps {
  allow: Role[];
  children: ReactNode;
}

export function ProtectedRoute({ allow, children }: ProtectedRouteProps): JSX.Element {
  const { isAuthenticated, hasAnyRole, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-slate-50">
        <Spinner label="Restoring session" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (!hasAnyRole(allow)) {
    return <Navigate to="/" replace />;
  }

  return <>{children}</>;
}
