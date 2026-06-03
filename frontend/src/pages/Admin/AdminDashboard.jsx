import React, { useEffect, useState } from 'react';
import { Users, Zap, ArrowUpRight, DollarSign, TrendingUp, Trophy } from 'lucide-react';
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

export default function AdminDashboard() {
  const [stats, setStats] = useState(null);
  const [chart, setChart] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get('/admin/stats'),
      api.get('/admin/revenue?days=7'),
    ]).then(([s, r]) => {
      setStats(s.data?.data || null);
      setChart(Array.isArray(r.data?.data) ? r.data.data : []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

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
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard Overview</h1>

      {/* Stat cards — 2-col grid, today payout spans full width as a highlight */}
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
      <div className="glass-card p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
          Platform Wallet Stats
        </p>
        {[
          { label: 'Total User Balances', v: stats.wallet?.total_balance,   c: 'var(--text-primary)' },
          { label: 'Locked (pending WD)', v: stats.wallet?.total_locked,    c: 'var(--accent-orange)' },
          { label: 'Total Withdrawn',     v: stats.wallet?.total_withdrawn,  c: 'var(--accent-red)' },
        ].map(({ label, v, c }) => (
          <div key={label} className="flex justify-between items-center text-sm">
            <span style={{ color: 'var(--text-muted)' }}>{label}</span>
            <span className="font-bold" style={{ color: c }}>${parseFloat(v || 0).toFixed(4)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
