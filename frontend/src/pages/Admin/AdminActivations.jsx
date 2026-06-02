import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle, Eye, Trash2, X } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

const STATUS_CFG = {
  success:      { badge: 'badge-success', spin: false },
  failed:       { badge: 'badge-error',   spin: false },
  invalid:      { badge: 'badge-error',   spin: false },
  pending:      { badge: 'badge-warning', spin: true  },
  in_progress:  { badge: 'badge-info',    spin: true  },
  otp_uploaded: { badge: 'badge-purple',  spin: true  },
  expired:      { badge: 'badge-neutral', spin: false },
};

const FILTERS = ['all','pending','in_progress','otp_uploaded','success','failed','invalid','expired'];

export default function AdminActivations() {
  const [activations, setActivations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const [selected, setSelected] = useState(null);
  const [deletingId, setDeletingId] = useState(null);

  async function load(p = 1, f = filter) {
    setLoading(true);
    try {
      const statusParam = f === 'all' ? '' : `&status=${f}`;
      const { data } = await api.get(`/admin/activations?page=${p}&limit=25${statusParam}`);
      setActivations(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || {});
    } catch (err) {
      console.error('Failed to load admin activations', err);
      toast.error(err.response?.data?.message || 'Failed to load activations');
      setActivations([]);
    }
    finally { setLoading(false); }
  }

  useEffect(() => { setPage(1); load(1, filter); }, [filter]);

  async function removeActivation(act) {
    if (!window.confirm(`Delete activation #${act.id} for ${act.phone_full}?`)) return;
    setDeletingId(act.id);
    try {
      await api.delete(`/admin/activations/${act.id}`);
      toast.success(`Deleted activation #${act.id}`);
      setSelected((curr) => (curr?.id === act.id ? null : curr));
      load(page, filter);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete activation');
    } finally {
      setDeletingId(null);
    }
  }

  function openDetails(act) {
    setSelected(act);
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Activations</h1>
        <span className="badge-info">{pagination.total ?? 0}</span>
      </div>

      {/* Filters */}
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar pb-1">
        {FILTERS.map((f) => (
          <button key={f} onClick={() => setFilter(f)}
            className="py-1 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-all flex-shrink-0"
            style={filter === f ? {
              background: 'var(--badge-purple-bg)',
              color: 'var(--badge-purple-txt)',
              border: '1.5px solid var(--badge-purple-txt)',
            } : {
              background: 'var(--bg-tertiary)',
              color: 'var(--text-faint)',
              border: '1px solid var(--border-subtle)',
            }}>
            {f.replace(/_/g, ' ')}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="space-y-2">{[1,2,3].map(i => <div key={i} className="skeleton h-24 rounded-xl" />)}</div>
      ) : activations.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <p style={{ color: 'var(--text-muted)' }}>No activations</p>
        </div>
      ) : (
        <div className="space-y-2">
          {activations.map((act, idx) => {
            const cfg = STATUS_CFG[act.status] || STATUS_CFG.pending;
            return (
              <div key={act.id ?? idx} className="glass-card p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <div className="w-1.5 h-1.5 rounded-full flex-shrink-0"
                        style={{
                          background: act.status === 'success' ? 'var(--accent-green)' :
                                      cfg.spin ? 'var(--accent-blue)' : 'var(--text-faint)',
                        }} />
                      <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                        {act.phone_full}
                      </p>
                    </div>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                      {act.flag_emoji} {act.country_name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                      @{act.username || act.first_name || '—'}
                      {act.created_at ? ` · ${new Date(act.created_at).toLocaleString()}` : ''}
                    </p>
                    {act.otp_code && (
                      <p className="text-xs font-mono mt-0.5" style={{ color: 'var(--accent-purple)' }}>
                        OTP: {act.otp_code}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0 space-y-2">
                    <span className={cfg.badge}>
                      {cfg.spin && <Loader2 size={9} className="animate-spin inline mr-1" />}
                      {(act.status || '').replace(/_/g,' ')}
                    </span>
                    {act.status === 'success' && (
                      <p className="text-xs font-bold mt-1" style={{ color: 'var(--badge-success-txt)' }}>
                        +${parseFloat(act.payout_amount || 0).toFixed(4)}
                      </p>
                    )}
                    <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>#{act.id}</p>
                    <div className="flex items-center justify-end gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() => openDetails(act)}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                        style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
                        title="View details"
                      >
                        <Eye size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => removeActivation(act)}
                        disabled={deletingId === act.id}
                        className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-105"
                        style={{ background: 'var(--accent-red-soft)', border: '1px solid var(--accent-red)', color: 'var(--accent-red)' }}
                        title="Delete activation"
                      >
                        {deletingId === act.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/40 p-3" onClick={() => setSelected(null)}>
          <div
            className="glass-card w-full max-w-lg p-4 sm:p-5 max-h-[85vh] overflow-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-xs font-semibold" style={{ color: 'var(--accent-purple)' }}>Activation details</p>
                <h2 className="text-base font-bold" style={{ color: 'var(--text-primary)' }}>#{selected.id} · {selected.phone_full}</h2>
              </div>
              <button
                type="button"
                onClick={() => setSelected(null)}
                className="w-8 h-8 rounded-lg flex items-center justify-center"
                style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}
              >
                <X size={14} />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <Detail label="Country" value={`${selected.flag_emoji || ''} ${selected.country_name || '—'}`} />
              <Detail label="Status" value={(selected.status || '').replace(/_/g, ' ')} />
              <Detail label="Username" value={selected.username || '—'} />
              <Detail label="Name" value={selected.first_name || '—'} />
              <Detail label="Full number" value={selected.phone_full || '—'} />
              <Detail label="Local number" value={selected.phone_local || '—'} />
              <Detail label="Payout" value={selected.payout_amount ? `$${parseFloat(selected.payout_amount).toFixed(4)}` : '—'} />
              <Detail label="OTP" value={selected.otp_code || '—'} />
            </div>

            {selected.api_add_response && (
              <div className="mt-4">
                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-muted)' }}>API response</p>
                <pre className="text-xs p-3 rounded-xl overflow-auto" style={{ background: 'var(--bg-tertiary)', color: 'var(--text-primary)', border: '1px solid var(--border-subtle)' }}>
                  {typeof selected.api_add_response === 'string'
                    ? selected.api_add_response
                    : JSON.stringify(selected.api_add_response, null, 2)}
                </pre>
              </div>
            )}

            <div className="mt-4 flex gap-2 justify-end">
              <button
                type="button"
                onClick={() => removeActivation(selected)}
                disabled={deletingId === selected.id}
                className="btn-primary py-2 px-4 text-sm flex items-center gap-2"
                style={{ background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }}
              >
                {deletingId === selected.id ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {(pagination.pages || 1) > 1 && (
        <div className="flex justify-center items-center gap-3">
          <button onClick={() => { const p = page - 1; setPage(p); load(p, filter); }} disabled={page===1} className="btn-secondary py-1 px-3 text-xs">← Prev</button>
          <span className="text-xs" style={{ color: 'var(--text-muted)' }}>{page} / {pagination.pages}</span>
          <button onClick={() => { const p = page + 1; setPage(p); load(p, filter); }} disabled={page===pagination.pages} className="btn-secondary py-1 px-3 text-xs">Next →</button>
        </div>
      )}
    </div>
  );
}

function Detail({ label, value }) {
  return (
    <div className="rounded-xl p-3" style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
      <p className="text-[11px] font-semibold uppercase tracking-wide" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p className="text-sm break-words" style={{ color: 'var(--text-primary)' }}>{value}</p>
    </div>
  );
}
