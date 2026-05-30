import React, { useEffect, useState } from 'react';
import { FileText, Server, Trash2, Loader2, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

function LogEntry({ log, type }) {
  const [expanded, setExpanded] = useState(false);

  if (type === 'api') {
    const code = log.status_code || 0;
    const codeColor = code >= 400 ? 'var(--accent-red)' : code >= 300 ? 'var(--accent-orange)' : 'var(--accent-green)';
    return (
      <div className="glass-card p-3 cursor-pointer transition-all hover:border-opacity-50"
        onClick={() => setExpanded(!expanded)}>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="font-mono font-extrabold text-xs" style={{ color: codeColor }}>
                {code}
              </span>
              <span className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
                {log.method} {log.endpoint}
              </span>
            </div>
            <p className="text-xs mt-0.5" style={{ color: 'var(--text-faint)' }}>
              {log.duration_ms}ms · {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
            </p>
            {log.error && (
              <p className="text-xs mt-1" style={{ color: 'var(--accent-red)' }}>{log.error}</p>
            )}
          </div>
          <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
            {expanded ? '▲' : '▼'}
          </span>
        </div>
        {expanded && (log.response_data || log.request_data) && (
          <pre className="mt-2 p-2 rounded-lg text-xs overflow-x-auto leading-relaxed"
            style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
            {JSON.stringify(log.response_data || log.request_data, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  return (
    <div className="glass-card p-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>
            {log.action}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {log.first_name} @{log.username} · {log.target_type} #{log.target_id}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            {log.created_at ? new Date(log.created_at).toLocaleString() : '—'}
          </p>
        </div>
        <span className="text-xs flex-shrink-0" style={{ color: 'var(--text-faint)' }}>
          {expanded ? '▲' : '▼'}
        </span>
      </div>
      {expanded && log.meta && (
        <pre className="mt-2 p-2 rounded-lg text-xs overflow-x-auto"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-secondary)' }}>
          {JSON.stringify(log.meta, null, 2)}
        </pre>
      )}
    </div>
  );
}

export default function AdminLogs() {
  const [tab, setTab] = useState('api');
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [clearing, setClearing] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  async function load(t = tab) {
    setLoading(true);
    setConfirmClear(false);
    try {
      const endpoint = t === 'api' ? '/admin/api-logs' : '/admin/admin-logs';
      const { data } = await api.get(`${endpoint}?limit=50`);
      setLogs(Array.isArray(data?.data) ? data.data : []);
    } catch { setLogs([]); }
    finally { setLoading(false); }
  }

  async function handleClear() {
    setClearing(true);
    try {
      const endpoint = tab === 'api' ? '/admin/api-logs' : '/admin/admin-logs';
      const { data } = await api.delete(endpoint);
      toast.success(data?.message || 'Logs cleared');
      setLogs([]);
      setConfirmClear(false);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to clear logs');
    } finally {
      setClearing(false);
    }
  }

  useEffect(() => { load(tab); }, [tab]);

  return (
    <div className="space-y-4 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold flex items-center gap-2" style={{ color: 'var(--text-primary)' }}>
          <FileText size={18} style={{ color: 'var(--text-muted)' }} />
          System Logs
        </h1>
        <button
          onClick={() => load(tab)}
          className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
          style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
          title="Refresh"
        >
          <RefreshCw size={12} />
          Refresh
        </button>
      </div>

      {/* Tabs + Clear button */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex gap-2">
          {[
            { id: 'api',   label: 'API Logs',    Icon: Server },
            { id: 'admin', label: 'Admin Audit', Icon: FileText },
          ].map(({ id, label, Icon }) => (
            <button key={id} onClick={() => { setTab(id); setConfirmClear(false); }}
              className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
              style={tab === id ? {
                background: 'var(--badge-purple-bg)',
                color: 'var(--badge-purple-txt)',
                border: '1.5px solid var(--badge-purple-txt)',
              } : {
                background: 'var(--bg-tertiary)',
                color: 'var(--text-faint)',
                border: '1px solid var(--border-subtle)',
              }}>
              <Icon size={12} />
              {label}
            </button>
          ))}
        </div>

        {/* Clear button / confirm */}
        {!confirmClear ? (
          <button
            onClick={() => setConfirmClear(true)}
            disabled={logs.length === 0 || loading}
            className="flex items-center gap-1.5 py-1.5 px-3 rounded-lg text-xs font-semibold transition-all"
            style={{
              background: logs.length === 0 || loading ? 'var(--bg-tertiary)' : 'var(--badge-danger-bg)',
              color: logs.length === 0 || loading ? 'var(--text-faint)' : 'var(--badge-danger-txt)',
              border: `1px solid ${logs.length === 0 || loading ? 'var(--border-subtle)' : 'var(--badge-danger-txt)'}`,
              opacity: logs.length === 0 || loading ? 0.5 : 1,
              cursor: logs.length === 0 || loading ? 'not-allowed' : 'pointer',
            }}
          >
            <Trash2 size={12} />
            Clear Logs
          </button>
        ) : (
          <div className="flex items-center gap-1.5 p-1.5 rounded-xl animate-slide-up"
            style={{ background: 'var(--badge-danger-bg)', border: '1.5px solid var(--badge-danger-txt)' }}>
            <span className="text-xs font-semibold px-1" style={{ color: 'var(--badge-danger-txt)' }}>
              Delete all {tab === 'api' ? 'API' : 'Admin'} logs?
            </span>
            <button
              onClick={handleClear}
              disabled={clearing}
              className="flex items-center gap-1 py-1 px-2.5 rounded-lg text-xs font-bold transition-all"
              style={{ background: 'var(--badge-danger-txt)', color: '#fff' }}
            >
              {clearing ? <Loader2 size={10} className="animate-spin" /> : <Trash2 size={10} />}
              {clearing ? 'Clearing…' : 'Yes, clear'}
            </button>
            <button
              onClick={() => setConfirmClear(false)}
              className="py-1 px-2 rounded-lg text-xs font-semibold"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)' }}
            >
              Cancel
            </button>
          </div>
        )}
      </div>

      {/* Log count */}
      {!loading && logs.length > 0 && (
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Showing {logs.length} most recent log{logs.length !== 1 ? 's' : ''}
        </p>
      )}

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-14 rounded-xl" />)}</div>
      ) : logs.length === 0 ? (
        <div className="glass-card p-8 text-center">
          <Trash2 size={28} className="mx-auto mb-2" style={{ color: 'var(--text-faint)' }} />
          <p style={{ color: 'var(--text-muted)' }}>No logs available</p>
        </div>
      ) : (
        <div className="space-y-1.5">
          {logs.map((log, idx) => (
            <LogEntry key={log.id ?? idx} log={log} type={tab} />
          ))}
        </div>
      )}
    </div>
  );
}
