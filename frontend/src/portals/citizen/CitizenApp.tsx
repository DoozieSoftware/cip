import { lazy, Suspense, useEffect } from 'react';
import { type JSX } from 'react';
import { Route, Routes, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { CitizenLayout } from './layout/CitizenLayout';
import { ErrorBoundary, ErrorState, Spinner } from '../moderator/design';
import { registerOfflineQueueRetry } from './offline/registerQueueRetry';
import { getQueue } from './offline/queue';
import { requestBackgroundSync, onQueueDrain, onPushReceived, onPushNavigate } from './offline/swBridge';

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

/**
 * Wires the offline queue's delivery function and the service-worker
 * bridge once per app mount. Rendered inside `<BrowserRouter>` because
 * `onPushNavigate` needs `useNavigate()`. Before this existed, the
 * queue had no retry handler at all (queued submissions never left
 * IndexedDB) and `swBridge`'s listeners were never registered by any
 * component, so a `queue:drain` / `push:received` message from the
 * service worker had no effect on the running app.
 */
function OfflineBridge(): null {
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    registerOfflineQueueRetry();

    function drainAndRefresh(): void {
      void getQueue()
        .drain()
        .then(() => {
          void qc.invalidateQueries({ queryKey: ['citizen'] });
          void qc.invalidateQueries({ queryKey: ['me'] });
        });
    }

    // Catch items queued while this tab was closed/backgrounded —
    // don't wait for a service-worker round trip to notice them.
    drainAndRefresh();
    void requestBackgroundSync();

    const offDrain = onQueueDrain(drainAndRefresh);
    const offOnline = (): void => drainAndRefresh();
    window.addEventListener('online', offOnline);

    const offPush = onPushReceived(() => {
      void qc.invalidateQueries({ queryKey: ['notifications'] });
    });
    const offNavigate = onPushNavigate((url) => {
      void navigate(url);
    });

    return () => {
      offDrain();
      window.removeEventListener('online', offOnline);
      offPush();
      offNavigate();
    };
  }, [qc, navigate]);

  return null;
}

export function CitizenApp(): JSX.Element {
  return (
    <ErrorBoundary>
      <OfflineBridge />
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
    </ErrorBoundary>
  );
}
