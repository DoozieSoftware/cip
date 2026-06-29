import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useState } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AuthProvider } from './auth/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { ModeratorApp } from './portals/moderator/ModeratorApp';
import { OperationsApp } from './portals/operations/OperationsApp';
import { CitizenApp } from './portals/citizen/CitizenApp';
import { AdminApp } from './portals/admin/AdminApp';
import { ProtectedRoute } from './auth/ProtectedRoute';

/**
 * Top-level portal switcher.
 *
 *  - `/`           → public landing page with role quick-switch
 *  - `/login`      → public OTP login
 *  - `/citizen*`   → Citizen PWA (M13)
 *  - `/moderator*` → Moderator portal (M10)
 *  - `/operations*`→ Operations portal (M11)
 *  - `/admin*`     → Super Admin portal (M12)
 */
export default function App() {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            retry: 1,
          },
        },
      }),
  );

  return (
    <QueryClientProvider client={client}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/citizen/*"
              element={
                <ProtectedRoute allow={['citizen', 'super_admin', 'system']}>
                  <CitizenApp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/moderator/*"
              element={
                <ProtectedRoute allow={['moderator', 'super_admin', 'system', 'auditor']}>
                  <ModeratorApp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/operations/*"
              element={
                <ProtectedRoute allow={['department_officer', 'department_admin', 'super_admin', 'system']}>
                  <OperationsApp />
                </ProtectedRoute>
              }
            />
            <Route
              path="/admin/*"
              element={
                <ProtectedRoute allow={['super_admin', 'system']}>
                  <AdminApp />
                </ProtectedRoute>
              }
            />
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
}
