import React, { useEffect, useState } from 'react';
import {
  Search, Ban, CheckCircle, DollarSign, X, Loader2,
  User, Globe, ArrowDownLeft, Zap, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

/* ─── Status badge helper ─────────────────────────────────────────────────── */
const STATUS_BADGE = {
  success:    'badge-success',
  failed:     'badge-error',
  expired:    'badge-neutral',
  pending:    'badge-warning',
  in_progress:'badge-info',
  otp_uploaded:'badge-info',
  approved:   'badge-success',
  rejected:   'badge-error',
  cancelled:  'badge-neutral',
};

/* ─── Small detail row ────────────────────────────────────────────────────── */
function Row({ label, value, accent }) {
  return (
    <div className="flex justify-between items-center gap-2 text-sm py-1.5"
      style={{ borderBottom: '1px solid var(--border-subtle)' }}>
      <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>{label}</span>
      <span className="font-semibold text-right" style={{ color: accent || 'var(--text-primary)', fontSize: 12 }}>
        {value}
      </span>
    </div>
  );
}

/* ─── Stat mini-card ──────────────────────────────────────────────────────── */
function MiniStat({ label, value, color }) {
  return (
    <div className="rounded-xl p-3 text-center" style={{ background: 'var(--bg-tertiary)' }}>
      <p className="font-extrabold text-base leading-none" style={{ color: color || 'var(--text-primary)' }}>{value}</p>
      <p className="text-[10px] mt-1" style={{ color: 'var(--text-faint)' }}>{label}</p>
    </div>
  );
}

/* ─── User Detail Drawer ──────────────────────────────────────────────────── */
function UserDetailDrawer({ userId, onClose, onAdjust, onToggleBan }) {
  const [detail, setDetail] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!userId) return;
    setLoading(true);
    api.get(`/admin/users/${userId}`)
      .then(({ data }) => setDetail(data?.data || null))
      .catch(() => toast.error('Failed to load user details'))
      .finally(() => setLoading(false));
  }, [userId]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'rgba(0,0,0,0.55)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}
    >
      <div
        className="glass-card w-full max-w-lg animate-slide-up"
        style={{ borderRadius: '20px 20px 0 0', maxHeight: '92vh', overflowY: 'auto' }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 z-10 flex items-center justify-between p-4 pb-3"
          style={{ background: 'var(--bg-secondary)', borderBottom: '1px solid var(--border-subtle)' }}>
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full flex items-center justify-center"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <User size={15} style={{ color: 'var(--text-muted)' }} />
            </div>
            <div>
              <p className="text-sm font-bold leading-none" style={{ color: 'var(--text-primary)' }}>
                {detail ? `${detail.first_name || ''} ${detail.last_name || ''}`.trim() || 'User' : 'Loading…'}
              </p>
              {detail && (
                <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  @{detail.username || '—'} · ID {String(detail.telegram_id)}
                </p>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg flex items-center justify-center"
            style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
          >
            <X size={14} />
          </button>
        </div>

        {loading ? (
          <div className="flex items-center justify-center h-48">
            <Loader2 size={28} className="animate-spin" style={{ color: 'var(--text-muted)' }} />
          </div>
        ) : !detail ? (
          <div className="p-8 text-center" style={{ color: 'var(--text-muted)' }}>Failed to load</div>
        ) : (
          <div className="p-4 space-y-5">

            {/* ── Account Info ── */}
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Account</p>
              <div className="glass-card p-3 space-y-0">
                <Row label="Joined"      value={detail.created_at ? new Date(detail.created_at).toLocaleDateString() : '—'} />
                <Row label="Status"      value={detail.is_banned ? '🚫 Banned' : '✅ Active'}
                  accent={detail.is_banned ? 'var(--accent-red)' : 'var(--accent-green)'} />
                {detail.is_banned && detail.ban_reason && (
                  <Row label="Ban reason" value={detail.ban_reason} accent="var(--accent-red)" />
                )}
                <Row label="Language"    value={detail.language_code || '—'} />
              </div>
            </section>

            {/* ── Wallet ── */}
            <section>
              <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Wallet</p>
              <div className="grid grid-cols-3 gap-2">
                <MiniStat label="Balance"   value={`$${parseFloat(detail.balance || 0).toFixed(4)}`}        color="var(--accent-green)" />
                <MiniStat label="Locked"    value={`$${parseFloat(detail.locked_balance || 0).toFixed(4)}`} color="var(--accent-orange)" />
                <MiniStat label="Withdrawn" value={`$${parseFloat(detail.total_withdrawn || 0).toFixed(4)}`} color="var(--accent-red)" />
              </div>
            </section>

            {/* ── Activation Stats ── */}
            {detail.activation_stats && (
              <section>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Activations</p>
                <div className="grid grid-cols-3 gap-2 mb-2">
                  <MiniStat label="Total"   value={Number(detail.activation_stats.total).toLocaleString()} />
                  <MiniStat label="Success" value={Number(detail.activation_stats.success).toLocaleString()} color="var(--accent-green)" />
                  <MiniStat label="Failed"  value={Number(detail.activation_stats.failed).toLocaleString()}  color="var(--accent-red)" />
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <MiniStat label="Active"  value={Number(detail.activation_stats.active).toLocaleString()}   color="var(--accent-blue)" />
                  <MiniStat label="Expired" value={Number(detail.activation_stats.expired).toLocaleString()}  color="var(--text-faint)" />
                  <MiniStat label="Earned"  value={`$${parseFloat(detail.activation_stats.total_earned_activations || 0).toFixed(4)}`} color="var(--accent-green)" />
                </div>
              </section>
            )}

            {/* ── Withdrawal Stats ── */}
            {detail.withdrawal_stats && (
              <section>
                <p className="text-[10px] font-bold uppercase tracking-wider mb-2" style={{ color: 'var(--text-muted)' }}>Withdrawals</p>
                <div className="grid grid-cols-4 gap-2">
                  <MiniStat label="Total"    value={Number(detail.withdrawal_stats.total).toLocaleString()} />
                  <MiniStat label="Approved" value={Number(detail.withdrawal_stats.approved).toLocaleString()} color="var(--accent-green)" />
                  <MiniStat label="Pending"  value={Number(detail.withdrawal_stats.pending).toLocaleString()}  color="var(--accent-orange)" />
                  <MiniStat label="Rejected" value={Number(detail.withdrawal_stats.rejected).toLocaleString()} color="var(--accent-red)" />
                </div>
              </section>
            )}

            {/* ── Country Breakdown ── */}
            {detail.country_breakdown?.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Globe size={13} style={{ color: 'var(--accent-blue)' }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Countries ({detail.country_breakdown.length})
                  </p>
                </div>
                <div className="space-y-2">
                  {detail.country_breakdown.map((c, idx) => {
                    const successRate = Number(c.total) > 0
                      ? ((Number(c.success) / Number(c.total)) * 100).toFixed(0)
                      : '0';
                    const maxTotal = Number(detail.country_breakdown[0].total);
                    const barPct = maxTotal > 0 ? (Number(c.total) / maxTotal) * 100 : 0;
                    return (
                      <div key={c.cc} className="rounded-xl p-2.5"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-xs font-bold w-5 text-center flex-shrink-0"
                            style={{ color: 'var(--text-faint)' }}>#{idx + 1}</span>
                          <span className="text-xs font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                            {c.flag_emoji} {c.country_name}
                          </span>
                          <span className="text-xs font-extrabold" style={{ color: 'var(--text-primary)' }}>
                            {Number(c.total).toLocaleString()}
                          </span>
                        </div>
                        <div className="h-1 rounded-full overflow-hidden mb-1"
                          style={{ background: 'var(--bg-secondary)' }}>
                          <div className="h-full rounded-full"
                            style={{ width: `${barPct}%`, background: 'linear-gradient(90deg,var(--accent-blue),var(--accent-purple))' }} />
                        </div>
                        <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-faint)' }}>
                          <span>✓ {c.success} success · {successRate}%</span>
                          <span className="ml-auto font-semibold" style={{ color: 'var(--accent-green)' }}>
                            ${parseFloat(c.payout).toFixed(4)}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Recent Activations ── */}
            {detail.recentActivations?.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <Zap size={13} style={{ color: 'var(--accent-purple)' }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Recent Activations
                  </p>
                </div>
                <div className="space-y-1.5">
                  {detail.recentActivations.map((a) => (
                    <div key={a.id} className="flex items-center gap-2 rounded-xl p-2.5"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono truncate" style={{ color: 'var(--text-primary)' }}>{a.phone_full}</p>
                        <p className="text-[10px]" style={{ color: 'var(--text-faint)' }}>
                          {a.flag_emoji} {a.country_name} · {a.created_at ? new Date(a.created_at).toLocaleDateString() : '—'}
                        </p>
                      </div>
                      <div className="flex-shrink-0 text-right">
                        <span className={STATUS_BADGE[a.status] || 'badge-neutral'} style={{ fontSize: 10 }}>
                          {a.status}
                        </span>
                        {a.status === 'success' && (
                          <p className="text-[10px] font-bold mt-0.5" style={{ color: 'var(--accent-green)' }}>
                            +${parseFloat(a.payout_amount || 0).toFixed(4)}
                          </p>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Recent Withdrawals ── */}
            {detail.recentWithdrawals?.length > 0 && (
              <section>
                <div className="flex items-center gap-2 mb-2">
                  <ArrowDownLeft size={13} style={{ color: 'var(--accent-orange)' }} />
                  <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                    Recent Withdrawals
                  </p>
                </div>
                <div className="space-y-1.5">
                  {detail.recentWithdrawals.map((w) => (
                    <div key={w.id} className="flex items-center gap-2 rounded-xl p-2.5"
                      style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                          ${parseFloat(w.amount || 0).toFixed(4)}
                          <span className="font-normal ml-1" style={{ color: 'var(--text-faint)' }}>
                            via {(w.method || '').replace(/_/g,' ').toUpperCase()}
                          </span>
                        </p>
                        <p className="text-[10px] font-mono truncate" style={{ color: 'var(--text-faint)' }}>{w.address}</p>
                      </div>
                      <span className={STATUS_BADGE[w.status] || 'badge-neutral'} style={{ fontSize: 10, flexShrink: 0 }}>
                        {w.status}
                      </span>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Admin Actions ── */}
            <section className="pt-1">
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => onAdjust(detail)}
                  className="btn-secondary flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5"
                >
                  <DollarSign size={13} /> Adjust Balance
                </button>
                <button
                  type="button"
                  onClick={() => onToggleBan(detail)}
                  className={`flex-1 py-2.5 text-xs flex items-center justify-center gap-1.5 ${
                    detail.is_banned ? 'btn-secondary' : 'btn-danger'
                  }`}
                >
                  {detail.is_banned ? <><CheckCircle size={13} /> Unban</> : <><Ban size={13} /> Ban</>}
                </button>
              </div>
            </section>

          </div>
        )}
      </div>
    </div>
  );
}

/* ─── Balance Adjust Modal ────────────────────────────────────────────────── */
function AdjustModal({ user, onClose, onDone }) {
  const [amount, setAmount] = useState('');
  const [note, setNote]     = useState('');
  const [busy, setBusy]     = useState(false);

  async function submit(e) {
    e.preventDefault();
    if (!amount || !note.trim()) return;
    setBusy(true);
    try {
      await api.post(`/admin/users/${user.id}/balance`, { amount: parseFloat(amount), note });
      toast.success(`Balance adjusted by $${amount}`);
      onDone();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed');
    } finally { setBusy(false); }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end justify-center p-4"
      style={{ background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(6px)' }}
      onClick={onClose}>
      <div className="glass-card p-5 w-full max-w-sm animate-slide-up" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Adjust Balance</p>
          <button onClick={onClose} style={{ color: 'var(--text-muted)' }}><X size={18} /></button>
        </div>
        <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
          {user.first_name} · Balance:{' '}
          <strong style={{ color: 'var(--accent-green)' }}>${parseFloat(user.balance || 0).toFixed(4)}</strong>
        </p>
        <form onSubmit={submit} className="space-y-3">
          <input type="number" className="form-input"
            placeholder="Amount (negative to deduct, e.g. -5)"
            value={amount} onChange={(e) => setAmount(e.target.value)} step="0.01" required />
          <input type="text" className="form-input"
            placeholder="Reason / admin note (required)"
            value={note} onChange={(e) => setNote(e.target.value)} required />
          <div className="flex gap-2">
            <button type="button" onClick={onClose} className="btn-secondary flex-1">Cancel</button>
            <button type="submit" className="btn-primary flex-1" disabled={busy}>
              {busy ? 'Saving…' : 'Apply'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ─── Main Page ───────────────────────────────────────────────────────────── */
export default function AdminUsers() {
  const [users, setUsers]         = useState([]);
  const [loading, setLoading]     = useState(true);
  const [search, setSearch]       = useState('');
  const [page, setPage]           = useState(1);
  const [pagination, setPagination] = useState({});
  const [detailUserId, setDetailUserId] = useState(null);
  const [adjustUser, setAdjustUser]     = useState(null);

  async function load(p = 1, q = search) {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/users?page=${p}&limit=20&search=${encodeURIComponent(q)}`);
      setUsers(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || {});
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to load users');
      setUsers([]);
    } finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); load(1, search); }, [search]); // eslint-disable-line

  async function toggleBan(user) {
    try {
      await api.patch(`/admin/users/${user.id}/ban`, { ban: !user.is_banned, reason: 'Admin action' });
      toast.success(user.is_banned ? 'User unbanned' : 'User banned');
      setDetailUserId(null);
      load(page);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Users</h1>
        <span className="badge-info">{pagination.total ?? 0} total</span>
      </div>

      {/* Search */}
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
        <input className="form-input pl-9 text-sm"
          placeholder="Search by name, username or Telegram ID…"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }} />
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-20 rounded-xl" />)}</div>
      ) : users.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color: 'var(--text-muted)' }}>No users found</p>
        </div>
      ) : (
        <div className="space-y-2">
          {users.map((u) => (
            <div
              key={u.id}
              className="glass-card p-4 transition-all cursor-pointer hover:scale-[1.01] active:scale-[0.99]"
              style={u.is_banned ? { borderColor: 'rgba(220,38,38,0.3)' } : {}}
              onClick={() => setDetailUserId(u.id)}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {u.first_name} {u.last_name || ''}
                    </p>
                    {u.is_banned && <span className="badge-error">Banned</span>}
                  </div>
                  <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                    @{u.username || '—'} · ID {String(u.telegram_id)}
                  </p>
                  <div className="flex gap-3 mt-1">
                    <span className="text-xs font-bold" style={{ color: 'var(--accent-green)' }}>
                      ${parseFloat(u.balance || 0).toFixed(2)}
                    </span>
                    <span className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      {u.activation_count ?? 0} activations
                    </span>
                  </div>
                </div>
                <ChevronRight size={16} style={{ color: 'var(--text-faint)', flexShrink: 0 }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Pagination */}
      {(pagination.pages || 1) > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => { const p = page - 1; setPage(p); load(p); }} disabled={page===1} className="btn-secondary py-1 px-3 text-xs">← Prev</button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{page} / {pagination.pages}</span>
          <button onClick={() => { const p = page + 1; setPage(p); load(p); }} disabled={page===pagination.pages} className="btn-secondary py-1 px-3 text-xs">Next →</button>
        </div>
      )}

      {/* User Detail Drawer */}
      {detailUserId && (
        <UserDetailDrawer
          userId={detailUserId}
          onClose={() => setDetailUserId(null)}
          onAdjust={(u) => { setAdjustUser(u); }}
          onToggleBan={(u) => toggleBan(u)}
        />
      )}

      {/* Balance Adjust Modal */}
      {adjustUser && (
        <AdjustModal
          user={adjustUser}
          onClose={() => setAdjustUser(null)}
          onDone={() => { setAdjustUser(null); setDetailUserId(null); load(page); }}
        />
      )}
    </div>
  );
}
