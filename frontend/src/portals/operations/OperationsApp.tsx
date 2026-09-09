import { lazy, Suspense, useEffect, type JSX } from 'react';
import { Navigate, Route, Routes, useNavigate, useParams } from 'react-router-dom';
import { OperationsLayout } from './layout/OperationsLayout';
import { DepartmentSelectionProvider } from './context/DepartmentSelectionContext';
import { Spinner } from '../../shared/ui';
import { ProtectedRoute } from '../../auth/ProtectedRoute';
import { useAuth } from '../../auth/AuthContext';
import { useQueryClient } from '@tanstack/react-query';
import { readSession } from '../../auth/storage';
import { getQueue, stopAndClearQueue } from '../citizen/offline/queue';
import { registerOfflineQueueRetry } from '../citizen/offline/registerQueueRetry';
import { requestBackgroundSync, onQueueDrain } from '../citizen/offline/swBridge';
import { clearDraft } from '../citizen/offline/drafts';

const DashboardPage = lazy(() => import('./pages/DashboardPage'));
const ReportListPage = lazy(() => import('./pages/ReportListPage'));
const ReportDetailPage = lazy(() => import('./pages/ReportDetailPage'));
const ExportPage = lazy(() => import('./pages/ExportPage'));
const AdminPage = lazy(() => import('./pages/AdminPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const SecurityPage = lazy(() => import('./pages/SecurityPage'));
const GisMapPage = lazy(() => import('./pages/GisMapPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const ProfilePage = lazy(() => import('../../shared/components/StaffProfilePage'));
const TextileReviewPage = lazy(() => import('./pages/textile/TextileReviewPage'));
const TextileSchedulePage = lazy(() => import('./pages/textile/TextileSchedulePage'));
const TextileTripNewPage = lazy(() => import('./pages/textile/TextileTripNewPage'));
const TextileDispatchPage = lazy(() => import('./pages/textile/TextileDispatchPage'));
const TextileStopPage = lazy(() => import('./pages/textile/TextileStopPage'));
const TextileCompletedPage = lazy(() => import('./pages/textile/TextileCompletedPage'));
const TextileStaffDetailPage = lazy(() => import('./pages/textile/TextileStaffDetailPage'));
const TextileReceiptPage = lazy(() => import('./pages/textile/TextileReceiptPage'));
const TextileRecoveryPage = lazy(() => import('./pages/textile/TextileRecoveryPage'));
const TextileOfflineRecoveryPage = lazy(() => import('./pages/textile/TextileOfflineRecoveryPage'));
const TextileCapacityPage = lazy(() => import('./pages/textile/TextileCapacityPage'));
const TextileCentresPage = lazy(() => import('./pages/textile/TextileCentresPage'));

function Fallback() {
  return (
    <div className="flex items-center justify-center py-20" aria-live="polite">
      <Spinner label="Loading page" />
    </div>
  );
}

function OperationsHome() {
  const { user } = useAuth();
  const isDrLinen = user?.departments?.some((department) => department.code === 'DR_LINEN');

  return isDrLinen ? (
    <Navigate to="/operations/textile-collections/review" replace />
  ) : (
    <DashboardPage />
  );
}

/** Bookmark/in-flight redirect: old dispatch stop URLs keep working. */
function LegacyDispatchStopRedirect(): JSX.Element {
  const { batchId, stopId } = useParams();
  return (
    <Navigate
      to={`/operations/textile-collections/collections/${batchId ?? ''}/stops/${stopId ?? ''}`}
      replace
    />
  );
}

function OperationsOfflineBridge(): null {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const ownerId = readSession()?.user.id ?? null;
  useEffect(() => {
    registerOfflineQueueRetry(ownerId);
    const queue = getQueue(ownerId);
    function drainAndRefresh(): void {
      void queue.drain().then(() => {
        void qc.invalidateQueries({ queryKey: ['textile'] });
        void qc.invalidateQueries({ queryKey: ['department'] });
      });
    }
    drainAndRefresh();
    void requestBackgroundSync();
    const offDrain = onQueueDrain(drainAndRefresh);
    const offOnline = () => drainAndRefresh();
    window.addEventListener('online', offOnline);
    const offLogout = (event: Event) => {
      const detail = (event as CustomEvent<{ ownerId?: string }>).detail;
      if (detail?.ownerId) {
        void stopAndClearQueue(detail.ownerId);
        void clearDraft(detail.ownerId);
      }
    };
    window.addEventListener('cip:auth-logout', offLogout);
    return () => {
      offDrain();
      window.removeEventListener('online', offOnline);
      window.removeEventListener('cip:auth-logout', offLogout);
    };
  }, [qc, navigate, ownerId]);
  return null;
}

export function OperationsApp() {
  return (
    <DepartmentSelectionProvider>
      <OperationsOfflineBridge />
      <Suspense fallback={<Fallback />}>
        <Routes>
          <Route element={<OperationsLayout />}>
            <Route index element={<OperationsHome />} />
            <Route path="reports" element={<ReportListPage />} />
            <Route path="tasks" element={<ReportListPage />} />
            <Route path="reports/export" element={<ExportPage />} />
            <Route path="reports/:id" element={<ReportDetailPage />} />
            <Route path="profile" element={<ProfilePage />} />
            <Route path="map" element={<GisMapPage />} />
            <Route path="analytics" element={<AnalyticsPage />} />
            <Route
              path="textile-collections"
              element={<Navigate to="/operations/textile-collections/review" replace />}
            />
            <Route path="textile-collections/review" element={<TextileReviewPage />} />
            <Route path="textile-collections/schedule" element={<TextileSchedulePage />} />
            <Route path="textile-collections/schedule/new" element={<TextileTripNewPage />} />
            <Route path="textile-collections/pickup-requests" element={<TextileReceiptPage />} />
            <Route path="textile-collections/collections" element={<TextileDispatchPage />} />
            <Route
              path="textile-collections/collections/:batchId/stops/:stopId"
              element={<TextileStopPage />}
            />
            {/* Renamed paths: keep old bookmarks and in-flight links working. */}
            <Route
              path="textile-collections/receipt"
              element={<Navigate to="/operations/textile-collections/pickup-requests" replace />}
            />
            <Route
              path="textile-collections/dispatch"
              element={<Navigate to="/operations/textile-collections/collections" replace />}
            />
            <Route
              path="textile-collections/dispatch/:batchId/stops/:stopId"
              element={<LegacyDispatchStopRedirect />}
            />
            <Route path="textile-collections/reuploads" element={<TextileRecoveryPage />} />
            <Route
              path="textile-collections/recovery"
              element={<Navigate to="/operations/textile-collections/reuploads" replace />}
            />
            <Route
              path="textile-collections/offline-recovery"
              element={<TextileOfflineRecoveryPage />}
            />
            <Route path="textile-collections/capacity" element={<TextileCapacityPage />} />
            <Route path="textile-collections/centres" element={<TextileCentresPage />} />
            <Route path="textile-collections/completed" element={<TextileCompletedPage />} />
            <Route path="textile-collections/:id" element={<TextileStaffDetailPage />} />
            <Route path="audit" element={<AuditLogPage />} />
            <Route path="security" element={<SecurityPage />} />
            <Route
              path="admin"
              element={
                <ProtectedRoute allow={['department_admin', 'super_admin', 'system']}>
                  <AdminPage />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/operations" replace />} />
          </Route>
        </Routes>
      </Suspense>
    </DepartmentSelectionProvider>
  );
}
