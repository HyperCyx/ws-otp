import React, { useState, useEffect } from 'react';
import { ArrowUpRight, Clock, CheckCircle, XCircle, Info, X, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../api/client';
import { useWalletStore } from '../store/walletStore';
import { useLang } from '../context/LangContext';

const WD_STATUS = {
  pending:   { badge: 'badge-warning', icon: Clock },
  approved:  { badge: 'badge-success', icon: CheckCircle },
  rejected:  { badge: 'badge-error',   icon: XCircle },
  cancelled: { badge: 'badge-neutral', icon: X },
};

export default function WithdrawPage() {
  const { balance, lockedBalance, fetchWallet } = useWalletStore();
  const { t, minWithdrawal } = useLang();
  const [methods, setMethods] = useState([]);
  const [method, setMethod] = useState('');
  const [amount, setAmount] = useState('');
  const [address, setAddress] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);

  const bal = parseFloat(balance || '0');
  const locked = parseFloat(lockedBalance || '0');
  const available = Math.max(0, bal - locked);

  async function loadMethods() {
    try {
      const { data } = await api.get('/payment-methods');
      const list = Array.isArray(data?.data) ? data.data : [];
      setMethods(list);
      if (list.length > 0) setMethod(list[0].method_id);
    } catch { setMethods([]); }
  }

  async function loadWithdrawals() {
    setLoading(true);
    try {
      const { data } = await api.get('/withdrawals?limit=15');
      setWithdrawals(Array.isArray(data?.data) ? data.data : []);
    } catch { setWithdrawals([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { fetchWallet(); loadMethods(); loadWithdrawals(); }, []);

  async function handleSubmit(e) {
    e.preventDefault();
    const amt = parseFloat(amount);
    if (isNaN(amt) || amt < minWithdrawal)
      return toast.error(t('withdraw.minError', { min: minWithdrawal }));
    if (amt > available)
      return toast.error(t('withdraw.insufficientBalance'));
    if (!address.trim())
      return toast.error(t('withdraw.enterAddress'));

    setSubmitting(true);
    try {
      await api.post('/withdrawals', { amount: amt, method, address: address.trim() });
      toast.success(t('withdraw.successToast'));
      setAmount(''); setAddress('');
      fetchWallet(); loadWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit withdrawal');
    } finally { setSubmitting(false); }
  }

  async function handleCancel(id) {
    try {
      await api.delete(`/withdrawals/${id}`);
      toast.success(t('withdraw.cancelSuccess'));
      fetchWallet(); loadWithdrawals();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel');
    }
  }

  const selectedMethod = methods.find((m) => m.method_id === method);

  return (
    <div className="space-y-5 animate-fade-in">

      {/* ── Header ── */}
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('withdraw.title')}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>
          {t('withdraw.available')}{' '}
          <span className="font-bold" style={{ color: 'var(--accent-green)' }}>
            ${available.toFixed(4)}
          </span>
        </p>
      </div>

      {/* ── Form Card ── */}
      {methods.length === 0 ? (
        <div className="glass-card p-8 text-center space-y-2">
          <p className="text-2xl">🚫</p>
          <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{t('withdraw.noMethods')}</p>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>{t('withdraw.disabled')}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="glass-card p-5 space-y-5">

          {/* Method selector */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              {t('withdraw.methodLabel')}
            </p>
            <div className="grid gap-2" style={{ gridTemplateColumns: `repeat(${Math.min(methods.length, 3)}, 1fr)` }}>
              {methods.map((m) => (
                <button key={m.method_id} type="button" onClick={() => setMethod(m.method_id)}
                  className="py-2.5 px-2 rounded-xl text-xs font-semibold transition-all"
                  style={{
                    background: method === m.method_id ? 'var(--accent-blue-soft)' : 'var(--bg-tertiary)',
                    border: `1.5px solid ${method === m.method_id ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                    color: method === m.method_id ? 'var(--accent-blue)' : 'var(--text-muted)',
                  }}>
                  {m.label}
                </button>
              ))}
            </div>
          </div>

          {/* Amount */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              {t('withdraw.amountLabel')}
            </p>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm"
                style={{ color: 'var(--text-muted)' }}>$</span>
              <input type="number" className="form-input pl-7"
                placeholder={`${t('withdraw.minLabel')} $${minWithdrawal}`}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                step="0.01" min={minWithdrawal} max={available} required />
            </div>
            {available >= minWithdrawal && (
              <button type="button" className="text-xs mt-1.5 font-medium"
                style={{ color: 'var(--accent-blue)' }}
                onClick={() => setAmount(available.toFixed(2))}>
                {t('withdraw.useMax', { max: `$${available.toFixed(2)}` })}
              </button>
            )}
          </div>

          {/* Address */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>
              {selectedMethod?.label || ''} {t('withdraw.addressLabel')}
            </p>
            <input type="text" className="form-input font-mono text-xs"
              placeholder={`${selectedMethod?.label || ''} address`}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              required />
          </div>

          {/* Info box */}
          <div className="flex items-start gap-2.5 p-3 rounded-xl"
            style={{ background: 'var(--badge-warn-bg)', border: '1px solid var(--badge-warn-txt)', opacity: 0.9 }}>
            <Info size={14} className="flex-shrink-0 mt-0.5" style={{ color: 'var(--accent-orange)' }} />
            <p className="text-xs leading-relaxed" style={{ color: 'var(--text-secondary)' }}>
              {t('withdraw.infoText', { min: minWithdrawal })}
            </p>
          </div>

          <button type="submit" className="btn-primary w-full py-4 text-base"
            disabled={submitting || available < minWithdrawal}>
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <ArrowUpRight size={20} />}
            {submitting ? t('withdraw.submitting') : t('withdraw.submit')}
          </button>

          {available < minWithdrawal && (
            <p className="text-center text-xs" style={{ color: 'var(--text-faint)' }}>
              {t('withdraw.minNote', { min: minWithdrawal })}
            </p>
          )}
        </form>
      )}

      {/* ── Withdrawal History ── */}
      <div>
        <h2 className="text-sm font-bold mb-3" style={{ color: 'var(--text-primary)' }}>
          {t('withdraw.history')}
        </h2>

        {loading ? (
          <div className="space-y-2">{[1,2].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
        ) : withdrawals.length === 0 ? (
          <div className="glass-card p-8 text-center">
            <p className="text-3xl mb-2">💸</p>
            <p style={{ color: 'var(--text-muted)' }} className="text-sm">{t('withdraw.noHistory')}</p>
          </div>
        ) : (
          <div className="space-y-2">
            {withdrawals.map((wd, idx) => {
              const cfg = WD_STATUS[wd.status] || WD_STATUS.pending;
              const Icon = cfg.icon;
              const amt = parseFloat(wd.amount || 0);
              return (
                <div key={wd.id ?? idx} className="glass-card p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 mb-1 flex-wrap">
                        <span className="font-bold" style={{ color: 'var(--text-primary)' }}>
                          ${amt.toFixed(4)}
                        </span>
                        <span className={cfg.badge}>{wd.status}</span>
                        <span className="text-xs font-medium px-2 py-0.5 rounded"
                          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                          {(wd.method || '').replace(/_/g, ' ').toUpperCase()}
                        </span>
                      </div>
                      <p className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>
                        {wd.address}
                      </p>
                      <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                        {wd.created_at ? new Date(wd.created_at).toLocaleString() : '—'}
                      </p>
                      {wd.admin_note && (
                        <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>
                          "{wd.admin_note}"
                        </p>
                      )}
                    </div>
                    {wd.status === 'pending' && (
                      <button onClick={() => handleCancel(wd.id)}
                        className="btn-danger py-1.5 px-3 text-xs flex-shrink-0">
                        <X size={12} /> {t('withdraw.cancel')}
                      </button>
                    )}
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
