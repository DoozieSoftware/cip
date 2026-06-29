import { lazy, Suspense } from 'react';
import { type JSX } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AdminLayout } from './layout/AdminLayout';
import { Spinner } from '../moderator/design';

const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const AdminUsers = lazy(() => import('./pages/AdminUsers'));
const AdminRoles = lazy(() => import('./pages/AdminRoles'));
const AdminReportTypes = lazy(() => import('./pages/AdminReportTypes'));
const AdminSecurityPolicies = lazy(() => import('./pages/AdminSecurityPolicies'));
const AdminFeatureFlags = lazy(() => import('./pages/AdminFeatureFlags'));
const AdminAuditLog = lazy(() => import('./pages/AdminAuditLog'));

function Fallback() {
  return (
    <div className="flex items-center justify-center py-20" aria-live="polite">
      <Spinner label="Loading" />
    </div>
  );
}

export function AdminApp(): JSX.Element {
  return (
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<AdminLayout />}>
            <Route index element={<AdminDashboard />} />
            <Route path="users" element={<AdminUsers />} />
            <Route path="roles" element={<AdminRoles />} />
            <Route path="report-types" element={<AdminReportTypes />} />
            <Route path="security-policies" element={<AdminSecurityPolicies />} />
            <Route path="feature-flags" element={<AdminFeatureFlags />} />
            <Route path="audit" element={<AdminAuditLog />} />
            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
