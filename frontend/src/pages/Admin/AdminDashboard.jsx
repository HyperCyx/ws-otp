import React, { useEffect, useState, useCallback } from 'react';
import { Users, Zap, ArrowUpRight, DollarSign, TrendingUp, Trophy, RefreshCw } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts';
import api from '../../api/client';

function StatCard({ icon: Icon, label, value, sub, accent }) {
  return (
    <div className="glass-card p-4">
      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-3"
        style={{ background: `${accent}18` }}>
        <Icon size={18} style={{ color: accent }} />
      </div>
      <p className="text-xs mb-1" style={{ color: 'var(--text-faint)' }}>{label}</p>
      <p className="font-extrabold text-xl leading-none" style={{ color: 'var(--text-primary)' }}>{value}</p>
      {sub && <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</p>}
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs shadow-xl">
      <p className="mb-1 font-medium" style={{ color: 'var(--text-muted)' }}>{label}</p>
      <p style={{ color: 'var(--accent-blue)' }}>Activations: <strong>{payload[0]?.value}</strong></p>
      <p style={{ color: 'var(--accent-green)' }}>Revenue: <strong>${parseFloat(payload[1]?.value || 0).toFixed(2)}</strong></p>
    </div>
  );
};

// Rank medal colors for top 3
const RANK_STYLES = [
  { bg: 'rgba(255,197,0,0.15)',  border: 'rgba(255,197,0,0.5)',  text: '#FFD700', label: '🥇' },
  { bg: 'rgba(192,192,192,0.15)',border: 'rgba(192,192,192,0.5)',text: '#C0C0C0', label: '🥈' },
  { bg: 'rgba(205,127,50,0.15)', border: 'rgba(205,127,50,0.5)', text: '#CD7F32', label: '🥉' },
];

function TopCountriesCard({ countries }) {
  if (!countries?.length) return null;

  // Find max total for relative bar width
  const maxTotal = Math.max(...countries.map((c) => Number(c.total)));

  return (
    <div className="glass-card p-4">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(139,92,246,0.15)' }}>
          <Trophy size={15} style={{ color: 'var(--accent-purple)' }} />
        </div>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          Top 10 Countries
        </p>
        <span className="text-[10px] px-2 py-0.5 rounded-full ml-auto font-semibold"
          style={{ background: 'var(--badge-purple-bg)', color: 'var(--badge-purple-txt)' }}>
          by activations
        </span>
      </div>

      <div className="space-y-2.5">
        {countries.map((c, idx) => {
          const rank = idx + 1;
          const rankStyle = RANK_STYLES[idx] || null;
          const barPct = maxTotal > 0 ? (Number(c.total) / maxTotal) * 100 : 0;
          const successRate = Number(c.total) > 0
            ? ((Number(c.success) / Number(c.total)) * 100).toFixed(0)
            : '0';

          return (
            <div
              key={c.cc}
              className="rounded-xl p-3 transition-all"
              style={{
                background: rankStyle ? rankStyle.bg : 'var(--bg-tertiary)',
                border: `1px solid ${rankStyle ? rankStyle.border : 'var(--border-subtle)'}`,
              }}
            >
              <div className="flex items-center gap-2 mb-1.5">
                {/* Rank badge */}
                <span
                  className="flex-shrink-0 w-6 h-6 rounded-md flex items-center justify-center text-xs font-extrabold"
                  style={{
                    background: rankStyle ? 'transparent' : 'var(--bg-secondary)',
                    color: rankStyle ? rankStyle.text : 'var(--text-faint)',
                    border: rankStyle ? `1px solid ${rankStyle.border}` : '1px solid var(--border-subtle)',
                  }}
                >
                  {rankStyle ? rankStyle.label : rank}
                </span>

                {/* Flag + name */}
                <span className="text-sm font-semibold flex-1 truncate" style={{ color: 'var(--text-primary)' }}>
                  {c.flag_emoji} {c.country_name}
                </span>

                {/* Total count */}
                <span className="text-xs font-extrabold tabular-nums flex-shrink-0" style={{ color: 'var(--text-primary)' }}>
                  {Number(c.total).toLocaleString()}
                </span>
              </div>

              {/* Progress bar */}
              <div className="h-1 rounded-full overflow-hidden mb-1.5"
                style={{ background: 'var(--bg-secondary)' }}>
                <div
                  className="h-full rounded-full transition-all"
                  style={{
                    width: `${barPct}%`,
                    background: rankStyle
                      ? rankStyle.text
                      : 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))',
                  }}
                />
              </div>

              {/* Sub-stats */}
              <div className="flex gap-3 text-[10px]" style={{ color: 'var(--text-faint)' }}>
                <span>✓ {Number(c.success).toLocaleString()} success</span>
                <span>· {successRate}% rate</span>
                <span className="ml-auto font-semibold" style={{ color: 'var(--accent-green)' }}>
                  ${parseFloat(c.payout).toFixed(2)}
                </span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ── Withdrawal Stats Section ───────────────────────────────────────────────
function WithdrawalStatsSection({ wdStats }) {
  const [detailView, setDetailView] = useState('yesterday'); // 'yesterday' | '7days' | 'custom'
  const [customDate, setCustomDate] = useState(() => {
    const d = new Date();
    return d.toISOString().split('T')[0]; // YYYY-MM-DD
  });
  const [customData, setCustomData] = useState(null);
  const [loadingCustom, setLoadingCustom] = useState(false);

  const fetchCustomData = useCallback(async (dateStr) => {
    if (!dateStr) return;
    setLoadingCustom(true);
    try {
      const { data } = await api.get(`/admin/withdrawal-stats?date=${dateStr}`);
      if (data?.success && data?.data?.custom) {
        setCustomData(data.data.custom);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoadingCustom(false);
    }
  }, []);

  useEffect(() => {
    if (detailView === 'custom' && customDate) {
      fetchCustomData(customDate);
    }
  }, [detailView, customDate, fetchCustomData]);

  if (!wdStats) return null;

  const todayAmt  = parseFloat(wdStats.today?.amount   || 0);
  const todayCnt  = Number(wdStats.today?.count        || 0);
  const totalAmt  = parseFloat(wdStats.total?.amount   || 0);
  const totalCnt  = Number(wdStats.total?.count        || 0);

  let detailAmt = 0;
  let detailCnt = 0;
  let detailLabel = '';

  if (detailView === 'yesterday') {
    detailAmt = parseFloat(wdStats.yesterday?.amount || 0);
    detailCnt = Number(wdStats.yesterday?.count || 0);
    detailLabel = 'Yesterday';
  } else if (detailView === '7days') {
    detailAmt = parseFloat(wdStats.seven_days?.amount || 0);
    detailCnt = Number(wdStats.seven_days?.count || 0);
    detailLabel = 'Last 7 Days';
  } else if (detailView === 'custom') {
    detailAmt = parseFloat(customData?.amount || 0);
    detailCnt = Number(customData?.count || 0);
    detailLabel = `On ${customDate}`;
  }

  return (
    <div className="space-y-3">
      {/* Section header */}
      <div className="flex items-center gap-2">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(239,68,68,0.15)' }}
        >
          <ArrowUpRight size={15} style={{ color: 'var(--accent-red)' }} />
        </div>
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
          Withdrawal Statistics
        </p>
      </div>

      {/* Today + Total highlight row */}
      <div className="grid grid-cols-2 gap-3">
        {/* Today */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(239,68,68,0.18) 0%, rgba(251,146,60,0.10) 100%)',
            border: '1.5px solid rgba(239,68,68,0.35)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-red)' }}>
            Withdrawn Today
          </p>
          <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>
            ${todayAmt.toFixed(4)}
          </p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {todayCnt} withdrawal{todayCnt !== 1 ? 's' : ''}
          </p>
          <div className="mt-2 flex items-center gap-1">
            <span
              className="inline-block w-1.5 h-1.5 rounded-full"
              style={{ background: todayCnt > 0 ? 'var(--accent-red)' : 'var(--text-faint)' }}
            />
            <span className="text-[10px]" style={{ color: todayCnt > 0 ? 'var(--accent-red)' : 'var(--text-faint)' }}>
              {todayCnt > 0 ? 'Active today' : 'None yet'}
            </span>
          </div>
        </div>

        {/* All-time total */}
        <div
          className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg, rgba(99,102,241,0.18) 0%, rgba(139,92,246,0.10) 100%)',
            border: '1.5px solid rgba(99,102,241,0.35)',
          }}
        >
          <p className="text-[10px] font-bold uppercase tracking-widest mb-1" style={{ color: 'var(--accent-purple)' }}>
            Total Withdrawn
          </p>
          <p className="text-2xl font-extrabold leading-none tabular-nums" style={{ color: 'var(--text-primary)' }}>
            ${totalAmt.toFixed(4)}
          </p>
          <p className="text-xs mt-1.5" style={{ color: 'var(--text-muted)' }}>
            {totalCnt} withdrawal{totalCnt !== 1 ? 's' : ''} ever
          </p>
          <div className="mt-2 flex items-center gap-1">
            <span className="inline-block w-1.5 h-1.5 rounded-full" style={{ background: 'var(--accent-purple)' }} />
            <span className="text-[10px]" style={{ color: 'var(--accent-purple)' }}>All-time</span>
          </div>
        </div>
      </div>

      {/* Detail toggle card */}
      <div className="glass-card p-4">
        {/* Toggle */}
        <div
          className="flex rounded-xl overflow-hidden mb-4"
          style={{ background: 'var(--bg-tertiary)', padding: '3px', gap: '2px' }}
        >
          {[
            { key: 'yesterday', label: 'Yesterday' },
            { key: '7days',     label: 'Last 7 Days' },
            { key: 'custom',    label: 'Custom Date' },
          ].map(({ key, label }) => (
            <button
              key={key}
              onClick={() => setDetailView(key)}
              className="flex-1 text-xs font-semibold py-1.5 rounded-lg transition-all"
              style={{
                background: detailView === key ? 'var(--bg-primary)' : 'transparent',
                color: detailView === key ? 'var(--text-primary)' : 'var(--text-faint)',
                border: detailView === key ? '1px solid var(--border-subtle)' : '1px solid transparent',
              }}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Custom date input */}
        {detailView === 'custom' && (
          <div className="mb-4">
            <input
              type="date"
              value={customDate}
              onChange={(e) => setCustomDate(e.target.value)}
              className="form-input text-xs font-semibold"
              style={{
                background: 'var(--bg-tertiary)',
                color: 'var(--text-primary)',
                border: '1px solid var(--border-subtle)',
              }}
            />
          </div>
        )}

        {/* Detail figures */}
        <div className="flex items-center justify-between">
          <div className={loadingCustom && detailView === 'custom' ? 'opacity-40 transition-opacity' : 'transition-opacity'}>
            <p className="text-[10px] uppercase font-semibold tracking-wider mb-0.5" style={{ color: 'var(--text-faint)' }}>
              {detailLabel}
            </p>
            <p className="text-3xl font-extrabold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              ${detailAmt.toFixed(4)}
            </p>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
              {detailCnt} approved withdrawal{detailCnt !== 1 ? 's' : ''}
            </p>
          </div>

          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0"
            style={{
              background: detailView === 'yesterday'
                ? 'rgba(14,165,233,0.15)'
                : detailView === '7days'
                  ? 'rgba(16,185,129,0.15)'
                  : 'rgba(139,92,246,0.15)',
              border: `1px solid ${
                detailView === 'yesterday'
                  ? 'rgba(14,165,233,0.35)'
                  : detailView === '7days'
                    ? 'rgba(16,185,129,0.35)'
                    : 'rgba(139,92,246,0.35)'
              }`,
            }}
          >
            <DollarSign
              size={26}
              style={{
                color: detailView === 'yesterday'
                  ? 'var(--accent-blue)'
                  : detailView === '7days'
                    ? 'var(--accent-green)'
                    : 'var(--accent-purple)'
              }}
            />
          </div>
        </div>

        {/* Mini progress vs total */}
        {totalAmt > 0 && (
          <div className="mt-4">
            <div className="flex justify-between text-[10px] mb-1" style={{ color: 'var(--text-faint)' }}>
              <span>{detailLabel} share</span>
              <span className="font-semibold">
                {((detailAmt / totalAmt) * 100).toFixed(1)}% of all-time
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--bg-tertiary)' }}>
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${Math.min(100, (detailAmt / totalAmt) * 100)}%`,
                  background: detailView === 'yesterday'
                    ? 'linear-gradient(90deg, var(--accent-blue), var(--accent-purple))'
                    : detailView === '7days'
                      ? 'linear-gradient(90deg, var(--accent-green), var(--accent-blue))'
                      : 'linear-gradient(90deg, var(--accent-purple), var(--accent-blue))',
                }}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState([]);
  const [wdStats, setWdStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    else setRefreshing(true);
    try {
      const [s, r, w] = await Promise.all([
        api.get('/admin/stats'),
        api.get('/admin/revenue?days=7'),
        api.get('/admin/withdrawal-stats'),
      ]);
      setStats(s.data?.data || null);
      setChart(Array.isArray(r.data?.data) ? r.data.data : []);
      setWdStats(w.data?.data || null);
      setLastUpdated(new Date());
    } catch {
      // keep previous data on error during silent refresh
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Initial load
  useEffect(() => { fetchData(false); }, [fetchData]);

  // Auto-refresh every 60 seconds
  useEffect(() => {
    const id = setInterval(() => fetchData(true), 60_000);
    return () => clearInterval(id);
  }, [fetchData]);

  if (loading) {
    return (
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          {[1,2,3,4,5].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="skeleton h-48 rounded-xl" />
        <div className="skeleton h-64 rounded-xl" />
      </div>
    );
  }

  if (!stats) {
    return (
      <div className="glass-card p-10 text-center">
        <p style={{ color: 'var(--text-muted)' }}>Failed to load stats</p>
      </div>
    );
  }

  const successRate = stats.activations?.total > 0
    ? ((stats.activations.success / stats.activations.total) * 100).toFixed(1)
    : '0.0';

  const todayAmount = parseFloat(stats.today_payouts?.amount || 0);
  const todayCount  = Number(stats.today_payouts?.count || 0);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header with refresh */}
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard Overview</h1>
        <div className="flex items-center gap-2">
          {lastUpdated && (
            <p className="text-[10px] tabular-nums" style={{ color: 'var(--text-faint)' }}>
              {lastUpdated.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </p>
          )}
          <button
            id="dashboard-refresh-btn"
            onClick={() => fetchData(true)}
            disabled={refreshing || loading}
            className="w-8 h-8 rounded-xl flex items-center justify-center transition-all"
            style={{
              background: 'var(--bg-tertiary)',
              border: '1px solid var(--border-subtle)',
              color: refreshing ? 'var(--accent-blue)' : 'var(--text-muted)',
              opacity: loading ? 0.4 : 1,
            }}
            aria-label="Refresh dashboard"
          >
            <RefreshCw size={14} className={refreshing ? 'animate-spin' : ''} />
          </button>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users}       label="Total Users"          value={stats.users?.total_users ?? 0}
          sub={`+${stats.users?.new_today ?? 0} today`}           accent="var(--accent-blue)" />
        <StatCard icon={Zap}         label="Activations"          value={stats.activations?.total ?? 0}
          sub={`${stats.activations?.today_count ?? 0} today`}    accent="var(--accent-purple)" />
        <StatCard icon={DollarSign}  label="Total Payouts"        value={`$${parseFloat(stats.activations?.total_payouts || 0).toFixed(2)}`}
          sub={`${successRate}% success`}                         accent="var(--accent-green)" />
        <StatCard icon={ArrowUpRight} label="Pending Withdrawals" value={stats.pending_withdrawals?.count ?? 0}
          sub={`$${parseFloat(stats.pending_withdrawals?.total || 0).toFixed(2)}`} accent="var(--accent-orange)" />
      </div>

      {/* ── Withdrawal Stats ── */}
      <WithdrawalStatsSection wdStats={wdStats} />

      {/* ── Today's Payout Highlight ── */}
      <div
        className="rounded-2xl p-4 flex items-center gap-4 animate-pulse-glow"
        style={{
          background: 'linear-gradient(135deg, rgba(16,185,129,0.18) 0%, rgba(14,165,233,0.10) 100%)',
          border: '1.5px solid rgba(16,185,129,0.35)',
        }}
      >
        <div className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
          style={{ background: 'rgba(16,185,129,0.2)', border: '1px solid rgba(16,185,129,0.4)' }}>
          <TrendingUp size={22} style={{ color: 'var(--accent-green)' }} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-bold uppercase tracking-widest mb-0.5"
            style={{ color: 'var(--accent-green)' }}>
            Paid Out Today
          </p>
          <p className="text-2xl font-extrabold leading-none" style={{ color: 'var(--text-primary)' }}>
            ${todayAmount.toFixed(4)}
          </p>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>
            {todayCount} successful activation{todayCount !== 1 ? 's' : ''} today
          </p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-[10px] uppercase font-semibold" style={{ color: 'var(--text-faint)' }}>USD</p>
          <p className="text-xs font-bold mt-0.5" style={{ color: todayCount > 0 ? 'var(--accent-green)' : 'var(--text-faint)' }}>
            {todayCount > 0 ? '● Live' : '○ None yet'}
          </p>
        </div>
      </div>

      {/* Breakdown */}
      <div className="glass-card p-4">
        <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
          Activation Breakdown
        </p>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Active',   v: stats.activations?.active   ?? 0, color: 'var(--accent-blue)'   },
            { label: 'Success',  v: stats.activations?.success  ?? 0, color: 'var(--accent-green)'  },
            { label: 'Failed',   v: stats.activations?.failed   ?? 0, color: 'var(--accent-red)'    },
            { label: 'Invalid',  v: stats.activations?.invalid  ?? 0, color: 'var(--accent-orange)' },
          ].map(({ label, v, color }) => (
            <div key={label} className="text-center p-3 rounded-xl"
              style={{ background: 'var(--bg-tertiary)' }}>
              <p className="font-extrabold text-lg" style={{ color }}>{v}</p>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Revenue chart */}
      {chart.length > 0 && (
        <div className="glass-card p-4">
          <p className="font-semibold text-sm mb-4" style={{ color: 'var(--text-primary)' }}>
            7-Day Revenue Chart
          </p>
          <ResponsiveContainer width="100%" height={160}>
            <AreaChart data={chart}>
              <defs>
                <linearGradient id="gBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#0ea5e9" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#0ea5e9" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="gGreen" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="#10b981" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border-subtle)" />
              <XAxis dataKey="date"
                tick={{ fill: 'var(--text-faint)', fontSize: 10 }} tickLine={false} axisLine={false} />
              <YAxis
                tick={{ fill: 'var(--text-faint)', fontSize: 10 }} tickLine={false} axisLine={false} width={28} />
              <Tooltip content={<CustomTooltip />} />
              <Area type="monotone" dataKey="activations" stroke="#0ea5e9" strokeWidth={2} fill="url(#gBlue)" />
              <Area type="monotone" dataKey="revenue"     stroke="#10b981" strokeWidth={2} fill="url(#gGreen)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── Top 10 Countries ── */}
      <TopCountriesCard countries={stats.top_countries} />

      {/* Wallet summary */}
      {(() => {
        const earned   = parseFloat(stats.wallet?.total_earned    || 0);
        const balance  = parseFloat(stats.wallet?.total_balance   || 0);
        const locked   = parseFloat(stats.wallet?.total_locked    || 0);
        const withdrawn = parseFloat(stats.wallet?.total_withdrawn || 0);
        // balance + locked + withdrawn should equal total_earned
        const accounted = balance + locked + withdrawn;
        const discrepancy = Math.abs(earned - accounted) > 0.0001;
        // Bar widths (% of total_earned)
        const bPct = earned > 0 ? (balance   / earned) * 100 : 0;
        const lPct = earned > 0 ? (locked    / earned) * 100 : 0;
        const wPct = earned > 0 ? (withdrawn / earned) * 100 : 0;

        return (
          <div className="glass-card p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
              <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                Platform Wallet Stats
              </p>
              {discrepancy && (
                <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(239,68,68,0.15)', color: 'var(--accent-red)', border: '1px solid rgba(239,68,68,0.35)' }}>
                  ⚠ discrepancy
                </span>
              )}
            </div>

            {/* Total Earned — headline */}
            <div className="rounded-xl p-3 flex items-center justify-between"
              style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
              <div>
                <p className="text-[10px] uppercase font-semibold tracking-wider mb-0.5" style={{ color: 'var(--text-faint)' }}>
                  Total Earned (All Users)
                </p>
                <p className="text-xl font-extrabold tabular-nums" style={{ color: 'var(--accent-green)' }}>
                  ${earned.toFixed(4)}
                </p>
              </div>
              <span className="text-[10px] font-semibold px-2 py-1 rounded-lg"
                style={{ background: 'rgba(16,185,129,0.15)', color: 'var(--accent-green)', border: '1px solid rgba(16,185,129,0.3)' }}>
                lifetime
              </span>
            </div>

            {/* Stacked flow bar */}
            {earned > 0 && (
              <div>
                <div className="h-2.5 rounded-full overflow-hidden flex gap-px" style={{ background: 'var(--bg-tertiary)' }}>
                  <div className="h-full rounded-l-full transition-all duration-500"
                    style={{ width: `${bPct}%`, background: 'var(--accent-blue)' }} />
                  {lPct > 0 && (
                    <div className="h-full transition-all duration-500"
                      style={{ width: `${lPct}%`, background: 'var(--accent-orange)' }} />
                  )}
                  <div className="h-full rounded-r-full transition-all duration-500"
                    style={{ width: `${wPct}%`, background: 'var(--accent-red)' }} />
                </div>
                <div className="flex gap-3 mt-1.5 text-[10px]" style={{ color: 'var(--text-faint)' }}>
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent-blue)' }} />
                    Available {bPct.toFixed(0)}%
                  </span>
                  {lPct > 0 && (
                    <span className="flex items-center gap-1">
                      <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent-orange)' }} />
                      Locked {lPct.toFixed(0)}%
                    </span>
                  )}
                  <span className="flex items-center gap-1">
                    <span className="w-1.5 h-1.5 rounded-full inline-block" style={{ background: 'var(--accent-red)' }} />
                    Withdrawn {wPct.toFixed(0)}%
                  </span>
                </div>
              </div>
            )}

            {/* Row metrics */}
            {[
              { label: 'Available Balance', v: balance,   c: 'var(--accent-blue)',   dot: 'var(--accent-blue)'   },
              { label: 'Locked (pending WD)', v: locked,  c: 'var(--accent-orange)', dot: 'var(--accent-orange)' },
              { label: 'Total Withdrawn',  v: withdrawn,  c: 'var(--accent-red)',    dot: 'var(--accent-red)'    },
            ].map(({ label, v, c, dot }) => (
              <div key={label} className="flex justify-between items-center text-sm">
                <span className="flex items-center gap-1.5" style={{ color: 'var(--text-muted)' }}>
                  <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: dot }} />
                  {label}
                </span>
                <span className="font-bold tabular-nums" style={{ color: c }}>
                  ${v.toFixed(4)}
                </span>
              </div>
            ))}

            {/* Integrity check footnote */}
            <p className="text-[10px] text-right pt-1" style={{ color: discrepancy ? 'var(--accent-red)' : 'var(--text-faint)', borderTop: '1px solid var(--border-subtle)' }}>
              {discrepancy
                ? `⚠ ${balance.toFixed(4)} + ${locked.toFixed(4)} + ${withdrawn.toFixed(4)} = ${accounted.toFixed(4)} ≠ ${earned.toFixed(4)} earned`
                : `✓ ${balance.toFixed(4)} + ${locked.toFixed(4)} + ${withdrawn.toFixed(4)} = ${earned.toFixed(4)}`}
            </p>
          </div>
        );
      })()}

    </div>
  );
}
