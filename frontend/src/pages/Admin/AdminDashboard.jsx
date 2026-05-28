import React, { useEffect, useState } from 'react';
import { Users, Zap, ArrowUpRight, DollarSign } from 'lucide-react';
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
          {[1,2,3,4].map((i) => <div key={i} className="skeleton h-28 rounded-xl" />)}
        </div>
        <div className="skeleton h-48 rounded-xl" />
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

  return (
    <div className="space-y-5 animate-fade-in">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Dashboard Overview</h1>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3">
        <StatCard icon={Users}       label="Total Users"           value={stats.users?.total_users ?? 0}
          sub={`+${stats.users?.new_today ?? 0} today`}            accent="var(--accent-blue)" />
        <StatCard icon={Zap}         label="Activations"           value={stats.activations?.total ?? 0}
          sub={`${stats.activations?.today_count ?? 0} today`}     accent="var(--accent-purple)" />
        <StatCard icon={DollarSign}  label="Total Payouts"         value={`$${parseFloat(stats.activations?.total_payouts || 0).toFixed(2)}`}
          sub={`${successRate}% success`}                           accent="var(--accent-green)" />
        <StatCard icon={ArrowUpRight} label="Pending Withdrawals"  value={stats.pending_withdrawals?.count ?? 0}
          sub={`$${parseFloat(stats.pending_withdrawals?.total || 0).toFixed(2)}`} accent="var(--accent-orange)" />
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
