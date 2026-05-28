import React, { useEffect, useState } from 'react';
import { CheckCircle, XCircle, Loader2, AlertCircle, Clock } from 'lucide-react';
import { useWebSocket } from '../hooks/useWebSocket.js';
import { useLang } from '../context/LangContext';
import api from '../api/client';

const STATUS_CFG = {
  success:      { badge: 'badge-success', spin: false, Icon: CheckCircle },
  failed:       { badge: 'badge-error',   spin: false, Icon: XCircle },
  invalid:      { badge: 'badge-error',   spin: false, Icon: XCircle },
  pending:      { badge: 'badge-warning', spin: true,  Icon: Loader2 },
  in_progress:  { badge: 'badge-info',    spin: true,  Icon: Loader2 },
  otp_uploaded: { badge: 'badge-purple',  spin: true,  Icon: Loader2 },
  expired:      { badge: 'badge-neutral', spin: false, Icon: AlertCircle },
};

export default function HistoryPage() {
  const { t } = useLang();
  const [activations, setActivations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({});
  const { on } = useWebSocket();

  async function load(p = 1) {
    setLoading(true);
    try {
      const { data } = await api.get(`/activations?page=${p}&limit=20`);
      setActivations(Array.isArray(data?.data) ? data.data : []);
      setPagination(data?.pagination || {});
    } catch { setActivations([]); }
    finally { setLoading(false); }
  }

  useEffect(() => { load(page); }, [page]);

  useEffect(() => {
    const refresh = () => load(page);
    const offActivation = on('activation:update', refresh);
    const timer = setInterval(refresh, 8000);
    return () => { clearInterval(timer); offActivation?.(); };
  }, [on, page]);

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <Clock size={20} style={{ color: 'var(--text-muted)' }} />
          {t('history.title')}
        </h1>
        {pagination.total > 0 && (
          <span className="badge-info">{t('history.total', { n: pagination.total })}</span>
        )}
      </div>

      {loading ? (
        <div className="space-y-2">
          {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-20 rounded-xl" />)}
        </div>
      ) : activations.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <Clock size={36} className="mx-auto mb-3" style={{ color: 'var(--text-faint)' }} />
          <p className="font-medium" style={{ color: 'var(--text-muted)' }}>{t('history.noActivations')}</p>
          <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>{t('history.noActivationsDesc')}</p>
        </div>
      ) : (
        <>
          <div className="space-y-2">
            {activations.map((act, idx) => {
              const cfg = STATUS_CFG[act.status] || STATUS_CFG.pending;
              const { Icon } = cfg;
              const payout = parseFloat(act.payout_amount || 0);
              return (
                <div key={act.id ?? idx} className="glass-card p-4 animate-slide-up">
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex items-start gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
                        style={{
                          background: act.status === 'success' ? 'var(--badge-success-bg)' :
                                      cfg.spin ? 'var(--badge-info-bg)' : 'var(--bg-tertiary)',
                        }}>
                        <Icon size={14} className={cfg.spin ? 'animate-spin' : ''}
                          style={{
                            color: act.status === 'success' ? 'var(--badge-success-txt)' :
                                   cfg.spin ? 'var(--badge-info-txt)' : 'var(--text-faint)',
                          }} />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                          {act.phone_full}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                          {act.flag_emoji} {act.country_name}
                        </p>
                        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
                          {act.created_at ? new Date(act.created_at).toLocaleString() : '—'}
                        </p>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <span className={cfg.badge}>{(act.status || '').replace(/_/g, ' ')}</span>
                      {act.status === 'success' && payout > 0 && (
                        <p className="text-xs font-bold mt-1" style={{ color: 'var(--badge-success-txt)' }}>
                          +${payout.toFixed(4)}
                        </p>
                      )}
                      <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>#{act.id}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {(pagination.pages || 1) > 1 && (
            <div className="flex justify-center items-center gap-3 pt-2">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1} className="btn-secondary py-1.5 px-4 text-xs">
                {t('history.prev')}
              </button>
              <span className="text-xs font-medium" style={{ color: 'var(--text-muted)' }}>
                {page} / {pagination.pages}
              </span>
              <button onClick={() => setPage((p) => Math.min(pagination.pages, p + 1))}
                disabled={page === pagination.pages} className="btn-secondary py-1.5 px-4 text-xs">
                {t('history.next')}
              </button>
            </div>
          )}
        </>
      )}
    </div>
  );
}
