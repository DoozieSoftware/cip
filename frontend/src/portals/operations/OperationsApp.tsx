import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { OperationsLayout } from './layout/OperationsLayout';
import { Spinner } from './design';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportListPage = lazy(() => import('./pages/ReportListPage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const GisMapPage = lazy(() => import('./pages/GisMapPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));

function Fallback() {
  return (
    <div className="flex items-center justify-center py-20" aria-live="polite">
      <Spinner label="Loading page" />
    </div>
  );
}

export function OperationsApp() {
  return (
    <BrowserRouter>
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<OperationsLayout />}>
            <Route index element={<DashboardPage />} />
            <Route path="reports" element={<ReportListPage />} />
            <Route path="reports/export" element={<ExportPage />} />
            <Route path="reports/:id" element={<ReportDetailPage />} />
            <Route path="map" element={<GisMapPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route path="admin" element={<AdminPage />} />
            <Route path="*" element={<Navigate to="/operations" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </BrowserRouter>
  );
}
