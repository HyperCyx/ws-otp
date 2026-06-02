import React, { useEffect } from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import { Home, Zap, Clock, Wallet, Sun, Moon } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useThemeStore } from '../store/themeStore';
import { useLang } from '../context/LangContext';

export default function Layout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuthStore();
  const { fetchWallet } = useWalletStore();
  const { theme, toggleTheme } = useThemeStore();
  const { t, lang, setLang } = useLang();

  useEffect(() => {
    fetchWallet();
  }, []);

  const isDark = theme === 'dark';
  const otherLang = lang === 'en' ? 'ru' : 'en';

  const navItems = [
    { to: '/',         icon: Home,   label: t('nav.home'),     exact: true },
    { to: '/activate', icon: Zap,    label: t('nav.activate'), exact: false },
    { to: '/history',  icon: Clock,  label: t('nav.history'),  exact: false },
    { to: '/wallet',   icon: Wallet, label: t('nav.wallet'),   exact: false },
  ];

  function isActive(to, exact) {
    if (exact) return location.pathname === to || location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  return (
    <div className="flex flex-col min-h-screen max-w-md mx-auto">

      {/* ── Header ── */}
      <header className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'var(--bg-header)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}>
        <div className="flex items-center gap-3">
          {/* User Avatar */}
          {user?.photoUrl ? (
            <img
              src={user.photoUrl}
              alt={user.firstName || 'User'}
              className="w-9 h-9 rounded-xl object-cover flex-shrink-0"
              style={{ border: '2px solid var(--border-color)' }}
              onError={(e) => {
                // Fall back to gradient initial on load error
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'flex';
              }}
            />
          ) : null}
          <div
            className="w-9 h-9 rounded-xl items-center justify-center text-base font-bold flex-shrink-0 text-white"
            style={{
              background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
              display: user?.photoUrl ? 'none' : 'flex',
            }}
          >
            {(user?.firstName || 'U')[0].toUpperCase()}
          </div>
          <div>
            <p className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
              {t('layout.welcomeBack')}
            </p>
            <p className="text-sm font-bold leading-tight" style={{ color: 'var(--text-primary)' }}>
              {user?.firstName || 'User'}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Language toggle */}
          <button
            type="button"
            onClick={() => setLang(otherLang)}
            className="h-8 px-2.5 rounded-lg flex items-center justify-center text-xs font-bold transition-all duration-200 hover:scale-105"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-color)',
              color: 'var(--text-muted)',
              minWidth: '36px',
            }}>
            {otherLang.toUpperCase()}
          </button>

          {/* Theme toggle */}
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all duration-200 hover:scale-110"
            style={{
              background: 'var(--accent-blue-soft)',
              border: '1px solid var(--border-color)',
              color: 'var(--accent-blue)',
            }}>
            {isDark ? <Sun size={15} /> : <Moon size={15} />}
          </button>

          {/* Intentional <button> instead of <NavLink to="/admin">: NavLink renders
              as <a href="#/admin"> which exposes the route on long-press in Telegram. */}
          {user?.isAdmin && (
            <button
              type="button"
              onClick={() => navigate('/admin')}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg,#8b5cf6,#7c3aed)', border: 'none', cursor: 'pointer' }}
            >
              {t('layout.admin')}
            </button>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="flex-1 overflow-y-auto px-4 py-5 pb-28">
        <Outlet />
      </main>

      {/* ── Bottom Nav — all <button> elements, zero <a href> in the DOM ── */}
      <nav className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-md safe-bottom z-40"
        style={{
          background: 'var(--bg-nav)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderTop: '1px solid var(--nav-border)',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.06)',
        }}>
        <div className="flex items-center justify-around px-2 py-2">
          {navItems.map(({ to, icon: Icon, label, exact }) => {
            const active = isActive(to, exact);
            return (
              <button
                key={to}
                type="button"
                onClick={() => navigate(to)}
                className={`nav-item ${active ? 'active' : ''}`}
              >
                <Icon size={20} />
                <span>{label}</span>
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
