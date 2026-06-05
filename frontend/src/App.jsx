import React, { useEffect, useState } from 'react';
import { HashRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { LangProvider, useLang } from './context/LangContext';
import Layout from './components/Layout';
import NotInTelegram from './components/NotInTelegram';
import HomePage from './pages/HomePage';
import ActivatePage from './pages/ActivatePage.jsx';
import HistoryPage from './pages/HistoryPage';
import WalletPage from './pages/WalletPage';
import WithdrawPage from './pages/WithdrawPage';
import AdminLayout from './pages/Admin/AdminLayout';
import AdminDashboard from './pages/Admin/AdminDashboard';
import AdminUsers from './pages/Admin/AdminUsers';
import AdminActivations from './pages/Admin/AdminActivations';
import AdminWithdrawals from './pages/Admin/AdminWithdrawals';
import AdminPricing from './pages/Admin/AdminPricing';
import AdminCredentials from './pages/Admin/AdminCredentials';
import AdminLogs from './pages/Admin/AdminLogs';
import AdminSettings from './pages/Admin/AdminSettings';
import LoadingScreen from './components/LoadingScreen';
import MaintenancePage from './pages/MaintenancePage';

/**
 * Route guard — only rendered after bootDone is true, so the persisted
 * auth state is always available when this guard evaluates.
 */
function ProtectedAdmin({ children }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated || !user?.isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppInner() {
  const { maintenanceMode, settingsLoaded } = useLang();
  const user = useAuthStore((s) => s.user);

  // Hold rendering until we know the maintenance state — prevents the
  // brief flash where the normal app renders before settings arrive.
  if (!settingsLoaded) return <LoadingScreen />;

  // Non-admin users see the maintenance page when the setting is active.
  // Admins always have full access so they can turn maintenance off again.
  if (maintenanceMode && !user?.isAdmin) {
    return <MaintenancePage />;
  }

  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<HomePage />} />
        <Route path="activate"  element={<ActivatePage />} />
        <Route path="history"   element={<HistoryPage />} />
        <Route path="wallet"    element={<WalletPage />} />
        <Route path="withdraw"  element={<WithdrawPage />} />
      </Route>

      <Route path="admin" element={
        <ProtectedAdmin><AdminLayout /></ProtectedAdmin>
      }>
        <Route index             element={<AdminDashboard />} />
        <Route path="users"       element={<AdminUsers />} />
        <Route path="activations" element={<AdminActivations />} />
        <Route path="withdrawals" element={<AdminWithdrawals />} />
        <Route path="pricing"     element={<AdminPricing />} />
        <Route path="credentials" element={<AdminCredentials />} />
        <Route path="logs"        element={<AdminLogs />} />
        <Route path="settings"    element={<AdminSettings />} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

export default function App() {
  const { initTheme } = useThemeStore();
  const isLoading = useAuthStore((s) => s.isLoading);
  const [bootDone, setBootDone] = useState(false);
  const [notInTelegram, setNotInTelegram] = useState(false);

  useEffect(() => {
    initTheme();

    async function boot() {
      const tg = window.Telegram?.WebApp;
      const initData = tg?.initData;

      if (!tg) {
        setNotInTelegram(true);
        setBootDone(true);
        return;
      }

      try { tg.ready?.(); } catch { }
      try { tg.expand?.(); } catch { }

      if (!initData) {
        setNotInTelegram(true);
        setBootDone(true);
        return;
      }

      // Always re-authenticate on every app boot so that admin status,
      // bans, and other server-side changes are always reflected immediately.
      // Zustand persist keeps the token in localStorage only as a fallback;
      // the authoritative state always comes from the server on open.
      const { login } = useAuthStore.getState();
      try { await login(initData); } catch (err) { console.warn('Boot error', err); }

      setBootDone(true);
    }

    boot();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // Block ALL route rendering until boot completes.
  // ProtectedAdmin is never evaluated with an empty store.
  if (!bootDone || isLoading) return <LoadingScreen />;
  if (notInTelegram) return <NotInTelegram />;

  return (
    <LangProvider>
      <HashRouter>
        <Toaster
          position="top-center"
          toastOptions={{
            duration: 3500,
            style: {
              background: 'var(--bg-card)',
              color: 'var(--text-primary)',
              border: '1px solid var(--border-subtle)',
              borderRadius: '12px',
              fontSize: '14px',
              boxShadow: 'var(--shadow-card)',
            },
            success: { iconTheme: { primary: '#059669', secondary: '#fff' } },
            error:   { iconTheme: { primary: '#dc2626', secondary: '#fff' } },
          }}
        />
        <AppInner />
      </HashRouter>
    </LangProvider>
  );
}
