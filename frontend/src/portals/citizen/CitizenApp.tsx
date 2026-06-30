import { lazy, Suspense } from 'react';
import { type JSX } from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import { CitizenLayout } from './layout/CitizenLayout';
import { ErrorBoundary, ErrorState, Spinner } from '../moderator/design';

const HomePage = lazy(() => import('./pages/HomePage'));
const SubmitPage = lazy(() => import('./pages/SubmitPage'));
const MyReportsPage = lazy(() => import('./pages/MyReportsPage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));

function Fallback() {
  return (
    <div className="flex items-center justify-center py-20" aria-live="polite">
      <Spinner label="Loading" />
    </div>
  );
}

function RouteError() {
  return (
    <ErrorState
      title="Page not found"
      description="The page you were looking for doesn't exist or has moved."
      action={
        <a
          href="/citizen"
          className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700"
        >
          Back to home
        </a>
      }
    />
  );
}

export function CitizenApp(): JSX.Element {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <Suspense fallback={<Fallback />}>
          <Routes>
            <Route element={<CitizenLayout />}>
              <Route index element={<HomePage />} />
              <Route path="submit" element={<SubmitPage />} />
              <Route path="reports" element={<MyReportsPage />} />
              <Route path="reports/:id" element={<ReportDetailPage />} />
              <Route path="notifications" element={<NotificationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route path="dashboard" element={<DashboardPage />} />
              <Route path="settings" element={<SettingsPage />} />
              <Route path="*" element={<RouteError />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </ErrorBoundary>
  );
}
