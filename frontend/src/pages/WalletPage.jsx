import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { TrendingUp, ArrowUpRight, Lock, ArrowDownLeft, RefreshCw } from 'lucide-react';
import { useWalletStore } from '../store/walletStore';
import { useLang } from '../context/LangContext';
import api from '../api/client';

export default function WalletPage() {
  const { balance, lockedBalance, totalEarned, totalWithdrawn, fetchWallet } = useWalletStore();
  const { t } = useLang();
  const [txs, setTxs] = useState([]);
  const [txLoading, setTxLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const TX_LABELS = {
    activation_reward:  { label: t('tx.activation_reward'),  color: 'var(--accent-green)',  sign: '+' },
    withdrawal:         { label: t('tx.withdrawal'),         color: 'var(--accent-red)',    sign: '-' },
    admin_adjustment:   { label: t('tx.admin_adjustment'),   color: 'var(--accent-orange)', sign: '' },
    refund:             { label: t('tx.refund'),             color: 'var(--accent-green)',  sign: '+' },
    withdrawal_lock:    { label: t('tx.withdrawal_lock'),    color: 'var(--text-faint)',    sign: '-' },
    withdrawal_unlock:  { label: t('tx.withdrawal_unlock'),  color: 'var(--text-faint)',    sign: '+' },
  };

  async function loadTxs() {
    setTxLoading(true);
    try {
      const { data } = await api.get('/wallet/transactions?limit=30');
      setTxs(Array.isArray(data?.data) ? data.data : []);
    } catch { setTxs([]); }
    finally { setTxLoading(false); }
  }

  async function handleRefresh() {
    setRefreshing(true);
    await Promise.all([fetchWallet(), loadTxs()]);
    setRefreshing(false);
  }

  useEffect(() => { fetchWallet(); loadTxs(); }, []);

  const bal = parseFloat(balance || '0');
  const locked = parseFloat(lockedBalance || '0');
  const earned = parseFloat(totalEarned || '0');
  const withdrawn = parseFloat(totalWithdrawn || '0');
  const available = Math.max(0, bal - locked);

  return (
    <div className="space-y-5 animate-fade-in">

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('wallet.title')}</h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('wallet.subtitle')}</p>
        </div>
        <button onClick={handleRefresh} disabled={refreshing} className="btn-secondary py-2 px-3">
          <RefreshCw size={15} className={refreshing ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* ── Balance Card ── */}
      <div className="rounded-2xl p-6 animate-pulse-glow"
        style={{
          background: 'linear-gradient(135deg, #0ea5e9 0%, #0284c7 50%, #8b5cf6 100%)',
          boxShadow: '0 8px 32px rgba(14,165,233,0.35)',
        }}>
        <p className="text-blue-100 text-xs font-semibold uppercase tracking-widest mb-1">
          {t('wallet.availableBalance')}
        </p>
        <div className="flex items-end gap-2 mb-1">
          <span className="text-5xl font-extrabold text-white">${available.toFixed(2)}</span>
          <span className="text-blue-200 text-sm mb-2">USD</span>
        </div>
        {locked > 0 && (
          <div className="flex items-center gap-1.5 mt-1 mb-3">
            <Lock size={11} className="text-blue-200" />
            <p className="text-blue-200 text-xs">${locked.toFixed(4)} {t('wallet.locked')}</p>
          </div>
        )}
        <div className="h-px bg-white/20 my-3" />
        <div className="flex gap-6">
          <div>
            <p className="text-blue-200 text-xs">{t('wallet.totalEarned')}</p>
            <p className="text-white font-bold text-sm">${earned.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs">{t('wallet.withdrawn')}</p>
            <p className="text-white font-bold text-sm">${withdrawn.toFixed(4)}</p>
          </div>
          <div>
            <p className="text-blue-200 text-xs">{t('wallet.allTime')}</p>
            <p className="text-white font-bold text-sm">${earned.toFixed(2)}</p>
          </div>
        </div>
      </div>

      {/* ── Stats Row ── */}
      <div className="grid grid-cols-3 gap-3">
        {[
          { label: t('wallet.available'), value: `$${available.toFixed(2)}`, color: 'var(--accent-green)',  icon: '✅' },
          { label: t('wallet.earned'),    value: `$${earned.toFixed(2)}`,    color: 'var(--accent-blue)',   icon: '📈' },
          { label: t('wallet.withdrawn'), value: `$${withdrawn.toFixed(2)}`, color: 'var(--accent-red)',    icon: '💸' },
        ].map(({ label, value, color, icon }) => (
          <div key={label} className="glass-card p-3 text-center">
            <p className="text-lg mb-0.5">{icon}</p>
            <p className="font-bold text-sm" style={{ color }}>{value}</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{label}</p>
          </div>
        ))}
      </div>

      <Link to="/withdraw" className="btn-primary w-full py-4 text-base">
        <ArrowUpRight size={20} />
        {t('wallet.withdrawEarnings')}
      </Link>

      {/* ── Transaction History ── */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('wallet.txHistory')}
        </h2>

        {txLoading ? (
          <div className="space-y-2">
            {[1,2,3,4].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
          </div>
        ) : txs.length === 0 ? (
          <div className="glass-card p-10 text-center">
            <p className="text-4xl mb-2">💳</p>
            <p className="font-medium" style={{ color: 'var(--text-muted)' }}>{t('wallet.noTxs')}</p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{t('wallet.noTxsDesc')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {txs.map((tx, idx) => {
              const cfg = TX_LABELS[tx.type] || { label: tx.type, color: 'var(--text-muted)', sign: '' };
              const amount = parseFloat(tx.amount || 0);
              const balAfter = parseFloat(tx.balance_after || 0);
              const isPositive = amount > 0;
              return (
                <div key={tx.id ?? idx} className="glass-card p-4 flex items-center justify-between gap-3 animate-slide-up">
                  <div className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 text-base"
                    style={{ background: isPositive ? 'var(--badge-success-bg)' : 'var(--badge-error-bg)' }}>
                    {isPositive
                      ? <ArrowDownLeft size={16} style={{ color: 'var(--accent-green)' }} />
                      : <ArrowUpRight  size={16} style={{ color: 'var(--accent-red)' }} />}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {cfg.label}
                    </p>
                    {tx.note && (
                      <p className="text-xs truncate" style={{ color: 'var(--text-faint)' }}>{tx.note}</p>
                    )}
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      {tx.created_at ? new Date(tx.created_at).toLocaleString() : '—'}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="font-bold text-sm" style={{ color: cfg.color }}>
                      {amount > 0 ? '+' : ''}{amount.toFixed(4)}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      {t('wallet.balAfter')} ${balAfter.toFixed(2)}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
