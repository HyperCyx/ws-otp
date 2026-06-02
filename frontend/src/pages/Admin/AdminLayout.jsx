import React from 'react';
import { Outlet, useNavigate, useLocation } from 'react-router-dom';
import {
  LayoutDashboard, Users, Zap, ArrowUpRight, DollarSign,
  FileText, ArrowLeft, Sun, Moon, KeyRound, Settings,
} from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useLang } from '../../context/LangContext';

export default function AdminLayout() {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, toggleTheme } = useThemeStore();
  const { t } = useLang();
  const isDark = theme === 'dark';

  const navItems = [
    { to: '/admin',             icon: LayoutDashboard, label: t('admin.nav.dashboard'), exact: true },
    { to: '/admin/users',       icon: Users,           label: t('admin.nav.users'),        exact: false },
    { to: '/admin/activations', icon: Zap,             label: t('admin.nav.activations'),  exact: false },
    { to: '/admin/withdrawals', icon: ArrowUpRight,    label: t('admin.nav.withdrawals'),  exact: false },
    { to: '/admin/pricing',     icon: DollarSign,      label: t('admin.nav.pricing'),      exact: false },
    { to: '/admin/credentials', icon: KeyRound,        label: t('admin.nav.credentials'),  exact: false },
    { to: '/admin/logs',        icon: FileText,        label: t('admin.nav.logs'),         exact: false },
    { to: '/admin/settings',    icon: Settings,        label: t('admin.nav.settings'),     exact: false },
  ];

  function isActive(to, exact) {
    if (exact) return location.pathname === to;
    return location.pathname.startsWith(to);
  }

  return (
    <div className="flex flex-col min-h-screen w-full safe-top">
      <header className="sticky top-0 z-40 px-4 py-3 flex items-center justify-between"
        style={{
          background: 'var(--bg-header)',
          backdropFilter: 'blur(20px)',
          borderBottom: '1px solid var(--border-subtle)',
          boxShadow: 'var(--shadow-card)',
        }}>
        <div className="flex items-center gap-3">
          {/* Intentional <button> instead of <Link to="/">: Link renders as
              <a href="#/"> which exposes the app URL on long-press in Telegram. */}
          <button
            type="button"
            onClick={() => navigate('/')}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              color: 'var(--text-muted)',
              cursor: 'pointer',
            }}
          >
            <ArrowLeft size={15} />
          </button>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold truncate" style={{ color: 'var(--accent-purple)' }}>
              {t('admin.panel')}
            </p>
            <p className="text-sm font-bold leading-tight truncate" style={{ color: 'var(--text-primary)' }}>
              {t('admin.dashboardTitle')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'var(--accent-blue-soft)', border: '1px solid var(--border-color)', color: 'var(--accent-blue)' }}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <span className="badge-purple font-bold">👑 Admin</span>
        </div>
      </header>

      {/* ── Admin Tab Nav — all <button> elements, zero <a href> in the DOM ── */}
      <nav className="overflow-x-auto no-scrollbar px-2 py-2 flex gap-1 flex-shrink-0 items-center"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
        {navItems.map(({ to, icon: Icon, label, exact }) => {
          const active = isActive(to, exact);
          return (
            <button
              key={to}
              type="button"
              onClick={() => navigate(to)}
              className="flex items-center gap-1 py-1 px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
              style={active ? {
                background: 'var(--badge-purple-bg)',
                color: 'var(--badge-purple-txt)',
                border: '1px solid var(--badge-purple-txt)',
                cursor: 'pointer',
              } : {
                color: 'var(--text-faint)',
                border: '1px solid transparent',
                background: 'none',
                cursor: 'pointer',
              }}
            >
              <Icon size={14} />
              <span className="hidden sm:inline ml-1">{label}</span>
            </button>
          );
        })}
      </nav>

      <main className="flex-1 p-3 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
