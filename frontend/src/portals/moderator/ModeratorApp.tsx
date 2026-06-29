import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { ModeratorLayout } from './layout/ModeratorLayout';
import { Spinner } from './design';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReviewQueuePage = lazy(() => import('./pages/ReviewQueuePage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const DuplicatesQueuePage = lazy(() => import('./pages/DuplicatesQueuePage'));
const FraudQueuePage = lazy(() => import('./pages/FraudQueuePage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const AiPerformancePage = lazy(() => import('./pages/AiPerformancePage'));

function Fallback() {
  return (
    <div className="flex items-center justify-center py-20" aria-live="polite">
      <Spinner label="Loading page" />
    </div>
  );
}

export function ModeratorApp() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<ModeratorLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="queue" element={<ReviewQueuePage />} />
            <Route path="duplicates" element={<DuplicatesQueuePage />} />
            <Route path="fraud" element={<FraudQueuePage />} />
            <Route path="reports/:id" element={<ReportDetailPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="ai-performance" element={<AiPerformancePage />} />
            <Route path="*" element={<Navigate to="/moderator" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
