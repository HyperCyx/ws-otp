import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Clock, X, Loader2, ToggleLeft, ToggleRight } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

const STATUS_CFG = {
  pending:   { badge: 'badge-warning', Icon: Clock },
  approved:  { badge: 'badge-success', Icon: CheckCircle },
  rejected:  { badge: 'badge-error',   Icon: XCircle },
  cancelled: { badge: 'badge-neutral', Icon: X },
};

export default function AdminWithdrawals() {
  const [withdrawals, setWithdrawals] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('pending');
  const [reviewing, setReviewing] = useState(null);
  const [adminNote, setAdminNote] = useState('');
  const [processing, setProcessing] = useState(false);

  const [paymentMethods, setPaymentMethods] = useState([]);
  const [togglingMethod, setTogglingMethod] = useState(null);

  async function load(f = filter) {
    setLoading(true);
    setWithdrawals([]); // clear stale entries immediately
    try {
      const { data } = await api.get(`/admin/withdrawals?status=${f}&limit=50`);
      setWithdrawals(Array.isArray(data?.data) ? data.data : []);
    } catch { setWithdrawals([]); }
    finally { setLoading(false); }
  }

  async function loadPaymentMethods() {
    try {
      const { data } = await api.get('/admin/payment-methods');
      setPaymentMethods(Array.isArray(data?.data) ? data.data : []);
    } catch { setPaymentMethods([]); }
  }

  useEffect(() => { load(filter); loadPaymentMethods(); }, [filter]);

  async function handleReview(action) {
    if (!reviewing) return;
    setProcessing(true);
    try {
      await api.post(`/admin/withdrawals/${reviewing.id}/review`, { action, admin_note: adminNote });
      toast.success(`Withdrawal ${action}d successfully`);
      setReviewing(null); setAdminNote('');
      load(filter);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setProcessing(false); }
  }

  async function handleToggleMethod(methodId, currentEnabled) {
    setTogglingMethod(methodId);
    try {
      const { data } = await api.patch(`/admin/payment-methods/${methodId}`, {
        is_enabled: !currentEnabled,
      });
      setPaymentMethods((prev) =>
        prev.map((m) => m.method_id === methodId ? { ...m, is_enabled: data.data.is_enabled } : m)
      );
      toast.success(`${methodId.replace(/_/g, ' ').toUpperCase()} ${data.data.is_enabled ? 'enabled' : 'disabled'}`);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setTogglingMethod(null); }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Withdrawals</h1>

      {/* ── Payment Methods Toggle ── */}
      <div className="glass-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Payment Methods
        </p>
        {paymentMethods.length === 0 ? (
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Loading…</p>
        ) : (
          <div className="space-y-2">
            {paymentMethods.map((m) => (
              <div key={m.method_id} className="flex items-center justify-between gap-3 py-1">
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{m.label}</p>
                  <p className="text-xs" style={{ color: m.is_enabled ? 'var(--accent-green)' : 'var(--text-faint)' }}>
                    {m.is_enabled ? 'Active' : 'Disabled'}
                  </p>
                </div>
                <button
                  onClick={() => handleToggleMethod(m.method_id, m.is_enabled)}
                  disabled={togglingMethod === m.method_id}
                  className="flex-shrink-0 transition-opacity"
                  style={{ opacity: togglingMethod === m.method_id ? 0.5 : 1 }}
                >
                  {togglingMethod === m.method_id ? (
                    <Loader2 size={22} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
                  ) : m.is_enabled ? (
                    <ToggleRight size={28} style={{ color: 'var(--accent-green)' }} />
                  ) : (
                    <ToggleLeft size={28} style={{ color: 'var(--text-faint)' }} />
                  )}
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Filter tabs */}
      <div className="flex gap-2 overflow-x-auto no-scrollbar pb-1">
        {['pending','approved','rejected','cancelled'].map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="py-1.5 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
            style={filter === f ? {
              background: 'var(--badge-purple-bg)',
              color: 'var(--badge-purple-txt)',
              border: '1.5px solid var(--badge-purple-txt)',
            } : {
              background: 'var(--bg-tertiary)',
              color: 'var(--text-faint)',
              border: '1px solid var(--border-subtle)',
            }}>
            {f}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : withdrawals.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color: 'var(--text-muted)' }}>No {filter} withdrawals</p>
        </div>
      ) : (
        <div className="space-y-2">
          {withdrawals.map((wd, idx) => {
            const cfg = STATUS_CFG[wd.status] || STATUS_CFG.pending;
            return (
              <div key={wd.id ?? idx} className="glass-card p-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-extrabold text-base" style={{ color: 'var(--text-primary)' }}>
                        ${parseFloat(wd.amount || 0).toFixed(4)}
                      </span>
                      <span className={cfg.badge}>{wd.status}</span>
                      <span className="text-xs px-2 py-0.5 rounded font-medium"
                        style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}>
                        {(wd.method || '').replace(/_/g,' ').toUpperCase()}
                      </span>
                    </div>
                    <p className="text-xs font-mono truncate" style={{ color: 'var(--text-muted)' }}>{wd.address}</p>
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>
                      {wd.first_name} @{wd.username || 'anon'} · {wd.created_at ? new Date(wd.created_at).toLocaleString() : '—'}
                    </p>
                    {wd.admin_note && (
                      <p className="text-xs mt-1 italic" style={{ color: 'var(--text-muted)' }}>
                        "{wd.admin_note}"
                      </p>
                    )}
                  </div>
                  {wd.status === 'pending' && (
                    <button onClick={() => { setReviewing(wd); setAdminNote(''); }}
                      className="btn-primary py-1.5 px-3 text-xs flex-shrink-0">
                      Review
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Review Modal */}
      {reviewing && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}>
          <div className="glass-card p-5 w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Review Withdrawal</p>
              <button onClick={() => setReviewing(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <div className="p-4 rounded-xl mb-4 space-y-1"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <p className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
                ${parseFloat(reviewing.amount || 0).toFixed(4)}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {(reviewing.method || '').replace(/_/g,' ').toUpperCase()}
              </p>
              <p className="text-xs font-mono break-all" style={{ color: 'var(--text-muted)' }}>
                {reviewing.address}
              </p>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                {reviewing.first_name} · {String(reviewing.telegram_id)}
              </p>
            </div>
            <textarea className="form-input w-full text-sm resize-none mb-4 h-20"
              placeholder="Admin note (optional)"
              value={adminNote} onChange={(e) => setAdminNote(e.target.value)} />
            <div className="flex gap-2">
              <button onClick={() => handleReview('reject')} disabled={processing}
                className="btn-danger flex-1 py-3">
                {processing ? <Loader2 size={14} className="animate-spin" /> : '✗'} Reject
              </button>
              <button onClick={() => handleReview('approve')} disabled={processing}
                className="btn-primary flex-1 py-3">
                {processing ? <Loader2 size={14} className="animate-spin" /> : '✓'} Approve
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
