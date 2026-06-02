import React, { useEffect, useState } from 'react';
import { Search, Ban, CheckCircle, DollarSign, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selected, setSelected] = useState(null);
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustNote, setAdjustNote] = useState('');
  const [adjusting, setAdjusting] = useState(false);

  async function load(p = 1, q = search) {
    setLoading(true);
    try {
      const { data } = await api.get(`/admin/users?page=${p}&limit=20&search=${encodeURIComponent(q)}`);
      setUsers(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || {});
    } catch (err) {
      console.error('Failed to load admin users', err);
      toast.error(err.response?.data?.message || 'Failed to load users');
      setUsers([]);
    }
    finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); load(1, search); }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  async function toggleBan(user) {
    try {
      await api.patch(`/admin/users/${user.id}/ban`, { ban: !user.is_banned, reason: 'Admin action' });
      toast.success(user.is_banned ? 'User unbanned' : 'User banned');
      load(page);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
  }

  async function handleAdjust(e) {
    e.preventDefault();
    if (!selected || !adjustAmount || !adjustNote.trim()) return;
    setAdjusting(true);
    try {
      await api.post(`/admin/users/${selected.id}/balance`, { amount: parseFloat(adjustAmount), note: adjustNote });
      toast.success(`Balance adjusted by $${adjustAmount}`);
      setSelected(null); setAdjustAmount(''); setAdjustNote('');
      load(page);
    } catch (err) { toast.error(err.response?.data?.message || 'Failed'); }
    finally { setAdjusting(false); }
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
          placeholder="Search by name, username or ID…"
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
            <div key={u.id} className="glass-card p-4"
              style={u.is_banned ? { borderColor: 'rgba(220,38,38,0.3)' } : {}}>
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-0.5">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {u.first_name} {u.last_name || ''}
                    </p>
                    {u.is_banned ? <span className="badge-error">Banned</span> : null}
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
                <div className="flex gap-2 flex-shrink-0">
                  <button onClick={() => setSelected(u)} className="btn-secondary py-1.5 px-2.5 text-xs">
                    <DollarSign size={12} />
                  </button>
                  <button onClick={() => toggleBan(u)}
                    className={u.is_banned ? 'btn-secondary py-1.5 px-2.5 text-xs' : 'btn-danger py-1.5 px-2.5 text-xs'}>
                    {u.is_banned ? <CheckCircle size={12} /> : <Ban size={12} />}
                  </button>
                </div>
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

      {/* Balance Adjust Modal */}
      {selected && (
        <div className="fixed inset-0 z-50 flex items-end justify-center p-4"
          style={{ background: 'rgba(0,0,0,0.5)', backdropFilter: 'blur(6px)' }}>
          <div className="glass-card p-5 w-full max-w-sm animate-slide-up">
            <div className="flex items-center justify-between mb-4">
              <p className="font-bold" style={{ color: 'var(--text-primary)' }}>Adjust Balance</p>
              <button onClick={() => setSelected(null)} style={{ color: 'var(--text-muted)' }}>
                <X size={18} />
              </button>
            </div>
            <p className="text-xs mb-4" style={{ color: 'var(--text-muted)' }}>
              User: <span style={{ color: 'var(--text-primary)', fontWeight: 600 }}>{selected.first_name}</span>
              {' '}· Balance:{' '}
              <span style={{ color: 'var(--accent-green)', fontWeight: 600 }}>
                ${parseFloat(selected.balance || 0).toFixed(4)}
              </span>
            </p>
            <form onSubmit={handleAdjust} className="space-y-3">
              <input type="number" className="form-input"
                placeholder="Amount (negative to deduct, e.g. -5)"
                value={adjustAmount} onChange={(e) => setAdjustAmount(e.target.value)}
                step="0.01" required />
              <input type="text" className="form-input"
                placeholder="Reason / admin note (required)"
                value={adjustNote} onChange={(e) => setAdjustNote(e.target.value)} required />
              <div className="flex gap-2">
                <button type="button" onClick={() => setSelected(null)} className="btn-secondary flex-1">Cancel</button>
                <button type="submit" className="btn-primary flex-1" disabled={adjusting}>
                  {adjusting ? 'Saving…' : 'Apply'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
