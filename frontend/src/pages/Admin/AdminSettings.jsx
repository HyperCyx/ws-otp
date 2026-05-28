import React, { useEffect, useState } from 'react';
import { Loader2, Save, Globe, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useLang } from '../../context/LangContext';

export default function AdminSettings() {
  const { lang: currentLang, setLang, refreshSettings } = useLang();
  const [settings, setSettings] = useState({ default_language: 'en', min_withdrawal_amount: '1' });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/settings');
      const map = {};
      (data?.data || []).forEach((row) => { map[row.key] = row.value; });
      setSettings(map);
    } catch { }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveSetting(key, value) {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await api.patch(`/admin/settings/${key}`, { value });
      setSettings((s) => ({ ...s, [key]: value }));
      toast.success('Saved');
      if (key === 'default_language') setLang(value);
      // Re-fetch settings globally so minWithdrawal and language update everywhere
      await refreshSettings();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally {
      setSaving((s) => ({ ...s, [key]: false }));
    }
  }

  if (loading) return (
    <div className="flex items-center justify-center py-20">
      <Loader2 size={28} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
    </div>
  );

  return (
    <div className="space-y-4 animate-fade-in max-w-sm">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Settings</h1>

      {/* ── Default Language ── */}
      <div className="glass-card p-5 space-y-4">
        <div className="flex items-center gap-2 mb-1">
          <Globe size={16} style={{ color: 'var(--accent-blue)' }} />
          <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Default Language</p>
        </div>
        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
          Sets the default language for all users. Users can still override it with the toggle in the header.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {['en', 'ru'].map((l) => (
            <button key={l} type="button"
              onClick={() => saveSetting('default_language', l)}
              disabled={saving['default_language']}
              className="py-3 rounded-xl font-bold text-sm transition-all"
              style={{
                background: settings.default_language === l ? 'var(--accent-blue-soft)' : 'var(--bg-tertiary)',
                border: `2px solid ${settings.default_language === l ? 'var(--accent-blue)' : 'var(--border-subtle)'}`,
                color: settings.default_language === l ? 'var(--accent-blue)' : 'var(--text-muted)',
              }}>
              {saving['default_language'] && settings.default_language !== l
                ? <Loader2 size={14} className="animate-spin inline mr-1" />
                : null}
              {l === 'en' ? '🇬🇧 English' : '🇷🇺 Русский'}
              {settings.default_language === l && (
                <span className="ml-2 text-xs opacity-70">✓ active</span>
              )}
            </button>
          ))}
        </div>
      </div>

      {/* ── Minimum Withdrawal Amount ── */}
      <MinAmountCard
        value={settings.min_withdrawal_amount || '1'}
        saving={!!saving['min_withdrawal_amount']}
        onSave={(v) => saveSetting('min_withdrawal_amount', v)}
      />
    </div>
  );
}

function MinAmountCard({ value, saving, onSave }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  function handleSave(e) {
    e.preventDefault();
    const num = parseFloat(draft);
    if (isNaN(num) || num < 0.01) return toast.error('Minimum amount must be at least $0.01');
    onSave(String(num));
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <DollarSign size={16} style={{ color: 'var(--accent-green)' }} />
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Minimum Withdrawal Amount</p>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Users cannot withdraw less than this amount. Takes effect immediately.
      </p>
      <form onSubmit={handleSave} className="flex gap-2 items-center">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 font-bold text-sm"
            style={{ color: 'var(--text-muted)' }}>$</span>
          <input
            type="number"
            className="form-input pl-7"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            step="0.01" min="0.01" required
          />
        </div>
        <button type="submit" className="btn-primary py-2.5 px-4 flex-shrink-0" disabled={saving}>
          {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />}
          Save
        </button>
      </form>
      <p className="text-xs font-medium" style={{ color: 'var(--text-faint)' }}>
        Current minimum: <span style={{ color: 'var(--accent-green)' }}>${parseFloat(value).toFixed(2)}</span>
      </p>
    </div>
  );
}
