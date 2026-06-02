import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Zap, Clock, TrendingUp, ArrowRight, CheckCircle, XCircle, AlertCircle, Loader2 } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import { useWalletStore } from '../store/walletStore';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useLang } from '../context/LangContext';
import api from '../api/client';

// Active statuses that warrant a countdown display
const ACTIVE_STATUSES = new Set(['pending', 'in_progress', 'awaiting_otp', 'otp_uploaded']);
const ACTIVATION_WINDOW_MS = 10 * 60 * 1000; // 10-minute polling window

/**
 * CountdownBadge — live MM:SS countdown for active activations in Recent Activity.
 */
function CountdownBadge({ createdAt }) {
  const [remaining, setRemaining] = useState(0);

  useEffect(() => {
    if (!createdAt) return;
    const end = new Date(createdAt).getTime() + ACTIVATION_WINDOW_MS;
    const tick = () => setRemaining(Math.max(0, end - Date.now()));
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  if (remaining <= 0) return null;
  const mins = String(Math.floor(remaining / 60000)).padStart(2, '0');
  const secs = String(Math.floor((remaining % 60000) / 1000)).padStart(2, '0');
  return (
    <span
      className="text-xs font-bold tabular-nums"
      style={{ color: 'var(--accent-blue)' }}
    >
      <Clock size={9} className="inline mr-0.5" />{mins}:{secs}
    </span>
  );
}

export default function HomePage() {
  const { user } = useAuthStore();
  const { balance, totalEarned, lockedBalance, fetchWallet } = useWalletStore();
  const { on } = useWebSocket();
  const { t, startupMessage } = useLang();
  const [activations, setActivations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  const STATUS_CFG = {
    success:      { label: t('status.success'),     badge: 'badge-success', spin: false },
    failed:       { label: t('status.failed'),      badge: 'badge-error',   spin: false },
    invalid:      { label: t('status.invalid'),     badge: 'badge-error',   spin: false },
    pending:      { label: t('status.pending'),     badge: 'badge-warning', spin: true  },
    in_progress:  { label: t('status.in_progress'), badge: 'badge-info',    spin: true  },
    otp_uploaded: { label: t('status.otp_uploaded'),badge: 'badge-purple',  spin: true  },
    expired:      { label: t('status.expired'),     badge: 'badge-neutral', spin: false },
  };

  async function load() {
    try {
      const { data } = await api.get('/activations?limit=5');
      setActivations(Array.isArray(data?.data) ? data.data : []);
      setTotalCount(data?.pagination?.total ?? 0);
    } catch { setActivations([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); fetchWallet(); }, []);

  useEffect(() => {
    const refresh = () => { load(); fetchWallet(); };
    const offActivation = on('activation:update', refresh);
    const offWallet = on('wallet:update', refresh);
    const timer = setInterval(refresh, 8000);
    return () => { clearInterval(timer); offActivation?.(); offWallet?.(); };
  }, [on, fetchWallet]);

  const available = Math.max(0, parseFloat(balance || 0) - parseFloat(lockedBalance || 0));
  const successCount = activations.filter((a) => a.status === 'success').length;
  const pendingCount = activations.filter((a) => ['pending','in_progress','otp_uploaded'].includes(a.status)).length;

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Dynamic Announcement Banner ── */}
      {startupMessage && (
        <div className="glass-card p-4 relative overflow-hidden animate-slide-down flex items-start gap-3 animate-pulse-glow"
          style={{
            border: '1.5px solid transparent',
            backgroundImage: 'linear-gradient(var(--bg-card), var(--bg-card)), linear-gradient(135deg, #0ea5e9, #8b5cf6)',
            backgroundOrigin: 'border-box',
            backgroundClip: 'padding-box, border-box',
            boxShadow: 'var(--shadow-card)',
          }}>
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 text-base"
            style={{ background: 'var(--accent-blue-soft)', color: 'var(--accent-blue)', border: '1px solid var(--border-subtle)' }}>
            📢
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: 'var(--accent-blue)' }}>
              {t('nav.home') === 'Home' ? 'Announcement' : 'Объявление'}
            </p>
            <p className="text-xs font-semibold leading-relaxed" style={{ color: 'var(--text-primary)' }}>
              {startupMessage}
            </p>
          </div>
        </div>
      )}

      {/* ── Hero Balance Card ── */}
      <div className="rounded-2xl p-6 animate-pulse-glow relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0369a1 60%, #8b5cf6 100%)',
          boxShadow: '0 8px 32px rgba(14,165,233,0.35)',
        }}>
        <div className="absolute -top-8 -right-8 w-36 h-36 rounded-full bg-white/10 pointer-events-none" />
        <div className="absolute -bottom-6 -left-6 w-24 h-24 rounded-full bg-white/5 pointer-events-none" />

        <p className="text-blue-100 text-xs font-semibold uppercase tracking-widest mb-1">
          {t('home.availableBalance')}
        </p>
        <div className="flex items-end gap-2 mb-4">
          <span className="text-4xl font-extrabold text-white">${available.toFixed(2)}</span>
          <span className="text-blue-200 text-sm mb-1">USD</span>
        </div>
        <div className="flex gap-5 text-sm">
          <div>
            <p className="text-blue-200 text-xs">{t('home.totalEarned')}</p>
            <p className="text-white font-bold">${parseFloat(totalEarned || 0).toFixed(2)}</p>
          </div>
          <div className="w-px bg-white/20" />
          <div>
            <p className="text-blue-200 text-xs">{t('home.activations')}</p>
            <p className="text-white font-bold">{totalCount}</p>
          </div>
          <div className="w-px bg-white/20" />
          <div>
            <p className="text-blue-200 text-xs">{t('home.successful')}</p>
            <p className="text-white font-bold" style={{ color: '#6ee7b7' }}>{successCount}</p>
          </div>
        </div>
      </div>

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link to="/activate" className="glass-card-hover p-4 flex flex-col gap-2 cursor-pointer">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--accent-blue-soft)' }}>
            <Zap size={20} style={{ color: 'var(--accent-blue)' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('home.newActivation')}</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{t('home.submitWhatsApp')}</p>
        </Link>

        <Link to="/wallet" className="glass-card-hover p-4 flex flex-col gap-2 cursor-pointer">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center"
            style={{ background: 'var(--badge-purple-bg)' }}>
            <TrendingUp size={20} style={{ color: 'var(--accent-purple)' }} />
          </div>
          <p className="text-sm font-bold" style={{ color: 'var(--text-primary)' }}>{t('home.myWallet')}</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{t('home.viewWithdraw')}</p>
        </Link>
      </div>

      {/* ── Recent Activations ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
            <Clock size={15} style={{ color: 'var(--text-muted)' }} />
            {t('home.recentActivations')}
          </h2>
          <Link to="/history" className="text-xs flex items-center gap-1 font-medium"
            style={{ color: 'var(--accent-blue)' }}>
            {t('home.viewAll')} <ArrowRight size={12} />
          </Link>
        </div>

        {loading ? (
          <div className="space-y-2">
            {[1,2,3].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : activations.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <Zap size={32} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
            <p className="font-medium text-sm" style={{ color: 'var(--text-muted)' }}>{t('home.noActivations')}</p>
            <p className="text-xs mt-1 mb-4" style={{ color: 'var(--text-faint)' }}>{t('home.submitToEarn')}</p>
            <Link to="/activate" className="btn-primary text-xs py-2.5 px-5 inline-flex">
              {t('home.getStarted')}
            </Link>
          </div>
        ) : (
          <div className="space-y-2">
            {activations.map((act) => {
              const cfg = STATUS_CFG[act.status] || STATUS_CFG.pending;
              return (
                <div key={act.id} className="glass-card p-4 flex items-center gap-3 animate-slide-up">
                  <div className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      background: act.status === 'success' ? 'var(--accent-green)' :
                                  cfg.spin ? 'var(--accent-blue)' : 'var(--text-faint)',
                    }} />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {act.phone_full}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {act.flag_emoji} {act.country_name}
                      {act.created_at ? ` · ${new Date(act.created_at).toLocaleDateString()}` : ''}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <span className={cfg.badge}>
                      {cfg.spin && <Loader2 size={9} className="animate-spin inline mr-1" />}
                      {cfg.label}
                    </span>
                    {/* Bug-fix: show live countdown for active activations */}
                    {ACTIVE_STATUSES.has(act.status) && act.created_at && (
                      <p className="mt-0.5">
                        <CountdownBadge createdAt={act.created_at} />
                      </p>
                    )}
                    {act.status === 'success' && (
                      <p className="text-xs font-bold mt-0.5" style={{ color: 'var(--accent-green)' }}>
                        +${parseFloat(act.payout_amount || 0).toFixed(4)}
                      </p>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Pending notice ── */}
      {pendingCount > 0 && (
        <div className="flex items-center gap-3 p-3 rounded-xl animate-slide-up"
          style={{ background: 'var(--badge-warn-bg)', border: '1px solid var(--badge-warn-txt)', opacity: 0.9 }}>
          <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent-orange)' }} />
          <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>
            <span className="font-bold" style={{ color: 'var(--accent-orange)' }}>
              {pendingCount}
            </span>{' '}
            {t('home.inProgress', { n: pendingCount, s: pendingCount > 1 ? 'й' : 'я' }).replace(`${pendingCount} `, '')}
          </p>
        </div>
      )}
    </div>
  );
}
