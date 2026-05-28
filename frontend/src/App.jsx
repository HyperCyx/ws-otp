import React, { useEffect, useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { useAuthStore } from './store/authStore';
import { useThemeStore } from './store/themeStore';
import { LangProvider } from './context/LangContext';
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

function ProtectedAdmin({ children }) {
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  if (!isAuthenticated || !user?.isAdmin) return <Navigate to="/" replace />;
  return children;
}

function AppInner() {
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
  const { login, isAuthenticated, isLoading } = useAuthStore();
  const { initTheme } = useThemeStore();
  const [bootDone, setBootDone] = useState(false);
  const [notInTelegram, setNotInTelegram] = useState(false);

  useEffect(() => {
    initTheme();

    async function boot() {
      const initData = window.Telegram?.WebApp?.initData;

      if (!initData) {
        setNotInTelegram(true);
        setBootDone(true);
        return;
      }

      try { window.Telegram?.WebApp?.expand(); } catch { }

      if (!isAuthenticated) {
        try { await login(initData); } catch (err) { console.warn('Boot error', err); }
      }
      setBootDone(true);
    }

    boot();
  }, []);

  if (!bootDone || isLoading) return <LoadingScreen />;
  if (notInTelegram) return <NotInTelegram />;

  return (
    <LangProvider>
      <BrowserRouter>
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
      </BrowserRouter>
    </LangProvider>
  );
}
