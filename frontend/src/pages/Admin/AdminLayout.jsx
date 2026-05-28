import React from 'react';
import { Outlet, NavLink, Link } from 'react-router-dom';
import { LayoutDashboard, Users, Zap, ArrowUpRight, DollarSign, FileText, ArrowLeft, Sun, Moon, KeyRound, Settings } from 'lucide-react';
import { useThemeStore } from '../../store/themeStore';
import { useLang } from '../../context/LangContext';

export default function AdminLayout() {
  const { theme, toggleTheme } = useThemeStore();
  const { t } = useLang();
  const isDark = theme === 'dark';

  const navItems = [
    { to: '/admin',             icon: LayoutDashboard, label: t('admin.nav.dashboard'), end: true },
    { to: '/admin/users',       icon: Users,           label: t('admin.nav.users') },
    { to: '/admin/activations', icon: Zap,             label: t('admin.nav.activations') },
    { to: '/admin/withdrawals', icon: ArrowUpRight,    label: t('admin.nav.withdrawals') },
    { to: '/admin/pricing',     icon: DollarSign,      label: t('admin.nav.pricing') },
    { to: '/admin/credentials', icon: KeyRound,        label: t('admin.nav.credentials') },
    { to: '/admin/logs',        icon: FileText,        label: t('admin.nav.logs') },
    { to: '/admin/settings',    icon: Settings,        label: t('admin.nav.settings') },
  ];

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
          <Link to="/"
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
            <ArrowLeft size={15} />
          </Link>
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
          <button onClick={toggleTheme}
            className="w-8 h-8 rounded-lg flex items-center justify-center transition-all"
            style={{ background: 'var(--accent-blue-soft)', border: '1px solid var(--border-color)', color: 'var(--accent-blue)' }}>
            {isDark ? <Sun size={14} /> : <Moon size={14} />}
          </button>
          <span className="badge-purple font-bold">👑 Admin</span>
        </div>
      </header>

      <nav className="overflow-x-auto no-scrollbar px-2 py-2 flex gap-1 flex-shrink-0 items-center"
        style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
        {navItems.map(({ to, icon: Icon, label, end }) => (
          <NavLink key={to} to={to} end={end}
            className={({ isActive }) =>
              `flex items-center gap-1 py-1 px-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all ${isActive ? '' : ''}`
            }
            style={({ isActive }) => isActive ? {
              background: 'var(--badge-purple-bg)',
              color: 'var(--badge-purple-txt)',
              border: '1px solid var(--badge-purple-txt)',
            } : {
              color: 'var(--text-faint)',
              border: '1px solid transparent',
            }}>
            <Icon size={14} />
            <span className="hidden sm:inline ml-1">{label}</span>
          </NavLink>
        ))}
      </nav>

      <main className="flex-1 p-3 pb-20">
        <Outlet />
      </main>
    </div>
  );
}
