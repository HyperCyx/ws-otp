import React, { useEffect, useState } from 'react';
import { DollarSign, Save, ToggleLeft, ToggleRight, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

export default function AdminPricing() {
  const [prices, setPrices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState({});
  const [saving, setSaving] = useState(null);

  useEffect(() => {
    api.get('/admin/prices').then(({ data }) => {
      const list = Array.isArray(data?.data) ? data.data : [];
      setPrices(list);
      const init = {};
      list.forEach((p) => {
        init[p.cc] = { payout_amount: p.payout_amount, is_active: !!p.is_active };
      });
      setEditing(init);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, []);

  async function save(cc) {
    setSaving(cc);
    try {
      await api.patch(`/admin/prices/${cc}`, editing[cc]);
      toast.success(`Price for +${cc} updated`);
      setPrices((prev) => prev.map((p) => p.cc === cc ? { ...p, ...editing[cc] } : p));
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setSaving(null); }
  }

  async function toggle(cc) {
    const newActive = !editing[cc]?.is_active;
    setEditing((prev) => ({
      ...prev,
      [cc]: { ...prev[cc], is_active: newActive },
    }));
    // Auto-save the active toggle immediately so it sticks
    setSaving(cc);
    try {
      await api.patch(`/admin/prices/${cc}`, { is_active: newActive });
      setPrices((prev) => prev.map((p) => p.cc === cc ? { ...p, is_active: newActive } : p));
      toast.success(`+${cc} ${newActive ? 'enabled' : 'disabled'}`);
    } catch (err) {
      // Revert the toggle on failure
      setEditing((prev) => ({
        ...prev,
        [cc]: { ...prev[cc], is_active: !newActive },
      }));
      toast.error(err.response?.data?.message || 'Failed to update');
    } finally { setSaving(null); }
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-2">
        <DollarSign size={18} style={{ color: 'var(--text-muted)' }} />
        <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Country Pricing</h1>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
        Edit payout amounts per country. Changes take effect immediately.
      </p>

      {loading ? (
        <div className="space-y-2">{[1,2,3,4,5].map(i => <div key={i} className="skeleton h-16 rounded-xl" />)}</div>
      ) : (
        <div className="space-y-2">
          {prices.map((p) => {
            const ed = editing[p.cc] || {};
            const inactive = !ed.is_active;
            return (
              <div key={p.cc} className="glass-card p-4 transition-opacity"
                style={{ opacity: inactive ? 0.55 : 1 }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl flex-shrink-0">{p.flag_emoji}</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                      {p.country_name}
                    </p>
                    <p className="text-xs" style={{ color: 'var(--text-faint)' }}>+{p.cc}</p>
                  </div>
                  {/* Payout input */}
                  <div className="flex items-center gap-1.5">
                    <span className="text-sm font-bold" style={{ color: 'var(--text-muted)' }}>$</span>
                    <input type="number" step="0.01" min="0"
                      className="form-input w-20 py-1.5 px-2 text-sm text-right font-bold"
                      value={ed.payout_amount ?? ''}
                      onChange={(e) => setEditing((prev) => ({
                        ...prev,
                        [p.cc]: { ...prev[p.cc], payout_amount: e.target.value },
                      }))} />
                  </div>
                  {/* Active toggle */}
                  <button onClick={() => toggle(p.cc)} className="transition-transform hover:scale-110">
                    {ed.is_active
                      ? <ToggleRight size={26} style={{ color: 'var(--accent-green)' }} />
                      : <ToggleLeft  size={26} style={{ color: 'var(--text-faint)' }} />}
                  </button>
                  {/* Save */}
                  <button onClick={() => save(p.cc)} disabled={saving === p.cc} className="btn-primary py-1.5 px-3 text-xs">
                    {saving === p.cc ? <Loader2 size={13} className="animate-spin" /> : <Save size={13} />}
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
