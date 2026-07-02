import { lazy, Suspense } from 'react';
import { type JSX } from 'react';
import { Routes, Route } from 'react-router-dom';
import { PublicLayout } from './layout/PublicLayout';
import { ErrorBoundary, ErrorState, Spinner } from '../moderator/design';

const OverviewPage = lazy(() => import('./pages/OverviewPage'));
const HeatmapPage = lazy(() => import('./pages/HeatmapPage'));
const DepartmentPerformancePage = lazy(() => import('./pages/DepartmentPerformancePage'));

function Fallback(): JSX.Element {
  return (
    <div className="flex items-center justify-center py-20" aria-live="polite">
      <Spinner label="Loading" />
    </div>
  );
}

function RouteError(): JSX.Element {
  return (
    <ErrorState
      title="Page not found"
      description="The page you were looking for doesn't exist or has moved."
      action={
        <a href="/public" className="rounded-md bg-rose-600 px-3 py-1.5 text-sm font-semibold text-white hover:bg-rose-700">
          Back to overview
        </a>
      }
    />
  );
}

/**
 * M17 — Public Transparency Portal (Vision §7 / PRD M7). No auth
 * gate — every route here reads from unauthenticated `/public/*`
 * endpoints. Mounted at `/public/*` in the root App router.
 */
export function PublicApp(): JSX.Element {
  return (
    <ErrorBoundary>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<PublicLayout />}>
            <Route index element={<OverviewPage />} />
            <Route path="heatmap" element={<HeatmapPage />} />
            <Route path="departments" element={<DepartmentPerformancePage />} />
            <Route path="*" element={<RouteError />} />
          </Route>
        </Routes>
      </Suspense>
    </ErrorBoundary>
  );
}
