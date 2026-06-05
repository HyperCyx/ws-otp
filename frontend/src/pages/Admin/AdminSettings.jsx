import React, { useEffect, useState } from 'react';
import { Loader2, Save, Globe, DollarSign, MessageSquare, Send, Bell, AlertCircle, ShieldAlert } from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';
import { useLang } from '../../context/LangContext';

export default function AdminSettings() {
  const { lang: currentLang, setLang, refreshSettings } = useLang();
  const [settings, setSettings] = useState({
    default_language: 'en',
    min_withdrawal_amount: '1',
    startup_message: '',
    bot_welcome_message: '',
    startup_message_enabled: '1',
    maintenance_mode: '0',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState({});

  async function load() {
    setLoading(true);
    try {
      const { data } = await api.get('/admin/settings');
      const map = {};
      (data?.data || []).forEach((row) => { map[row.key] = row.value; });
      setSettings((prev) => ({ ...prev, ...map }));
    } catch { }
    finally { setLoading(false); }
  }

  useEffect(() => { load(); }, []);

  async function saveSetting(key, value) {
    setSaving((s) => ({ ...s, [key]: true }));
    try {
      await api.patch(`/admin/settings/${key}`, { value });
      setSettings((s) => ({ ...s, [key]: value }));
      toast.success('Saved successfully');
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
    <div className="space-y-5 animate-fade-in max-w-sm">
      <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>System Settings & Broadcasts</h1>

      {/* ── Maintenance Mode ── */}
      <MaintenanceModeCard
        enabled={settings.maintenance_mode !== '0'}
        saving={!!saving['maintenance_mode']}
        onToggle={(val) => saveSetting('maintenance_mode', val ? '1' : '0')}
      />

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

      {/* ── Web App Startup Message ── */}
      <TextSettingCard
        title="Web App Announcement Banner"
        icon={Bell}
        desc="Shown as a prominent announcement banner at the top of the user homepage."
        value={settings.startup_message || ''}
        saving={!!saving['startup_message']}
        onSave={(v) => saveSetting('startup_message', v)}
        placeholder="e.g. 📢 Big updates today! Check prices..."
      />

      {/* ── Announcement Toggle ── */}
      <AnnouncementToggleCard
        enabled={settings.startup_message_enabled !== '0'}
        saving={!!saving['startup_message_enabled']}
        onToggle={(val) => saveSetting('startup_message_enabled', val ? '1' : '0')}
      />

      {/* ── Bot Startup Welcome Message ── */}
      <TextSettingCard
        title="Telegram Bot Welcome Message"
        icon={MessageSquare}
        desc="Sent automatically to new users when they type /start. Use {first_name} to customize."
        value={settings.bot_welcome_message || ''}
        saving={!!saving['bot_welcome_message']}
        onSave={(v) => saveSetting('bot_welcome_message', v)}
        placeholder="👋 Привет {first_name}! Добро пожаловать..."
      />

      {/* ── Telegram Bot Broadcast Section ── */}
      <BroadcastCard />
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

function AnnouncementToggleCard({ enabled, saving, onToggle }) {
  return (
    <div className="glass-card p-5" style={{ borderColor: enabled ? 'rgba(34,197,94,0.35)' : 'var(--border-subtle)' }}>
      <div className="flex items-center justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Bell size={16} style={{ color: enabled ? 'var(--accent-green)' : 'var(--text-muted)' }} />
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Announcement Banner
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
              style={{
                background: enabled ? 'var(--badge-success-bg)' : 'var(--bg-tertiary)',
                color: enabled ? 'var(--badge-success-txt)' : 'var(--text-faint)',
                border: `1px solid ${enabled ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
                transition: 'all 0.25s',
              }}
            >
              {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {enabled
              ? 'The announcement banner is visible to all users on the homepage.'
              : 'The banner is hidden from users. Text is preserved for when you re-enable it.'}
          </p>
        </div>

        {/* Pill toggle */}
        <button
          type="button"
          onClick={() => !saving && onToggle(!enabled)}
          disabled={saving}
          aria-pressed={enabled}
          aria-label="Toggle announcement banner"
          style={{
            width: 52,
            height: 28,
            borderRadius: 999,
            background: enabled ? 'var(--accent-green)' : 'var(--bg-tertiary)',
            border: `2px solid ${enabled ? 'var(--accent-green)' : 'var(--border-subtle)'}`,
            position: 'relative',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.25s, border-color 0.25s',
            opacity: saving ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          {saving ? (
            <Loader2
              size={14}
              className="animate-spin"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: enabled ? '#fff' : 'var(--text-muted)',
              }}
            />
          ) : (
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: enabled ? 26 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                transition: 'left 0.22s cubic-bezier(.4,0,.2,1)',
              }}
            />
          )}
        </button>
      </div>
    </div>
  );
}

function TextSettingCard({ title, icon: Icon, desc, value, saving, onSave, placeholder }) {
  const [draft, setDraft] = useState(value);

  useEffect(() => { setDraft(value); }, [value]);

  function handleSave(e) {
    e.preventDefault();
    onSave(draft);
  }

  return (
    <div className="glass-card p-5 space-y-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon size={16} style={{ color: 'var(--accent-blue)' }} />
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>{title}</p>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{desc}</p>
      <form onSubmit={handleSave} className="space-y-3">
        <textarea
          className="form-input text-xs leading-relaxed w-full h-24 resize-none"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={placeholder}
          required
        />
        <button type="submit" className="btn-primary py-2 px-4 text-xs ml-auto flex items-center justify-center gap-1.5" disabled={saving}>
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
          Save Setting
        </button>
      </form>
    </div>
  );
}

function BroadcastCard() {
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);
  // Inline confirm state — two-step send instead of window.confirm() which
  // exposes the page URL in its native dialog title bar on Android WebViews.
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  async function handleSend(e) {
    e.preventDefault();
    if (!message.trim()) return toast.error('Please enter a message to broadcast');

    // First press: enter confirm state
    if (!awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }

    // Second press: confirmed — execute broadcast
    setAwaitingConfirm(false);
    setSending(true);
    try {
      const { data } = await api.post('/admin/broadcast', { message });
      toast.success(data.message || 'Broadcast completed!');
      setMessage('');
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to send broadcast');
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="glass-card p-5 space-y-4" style={{ borderColor: 'rgba(139,92,246,0.3)' }}>
      <div className="flex items-center gap-2 mb-1">
        <Send size={16} style={{ color: 'var(--accent-purple)' }} />
        <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>Send Telegram Broadcast</p>
      </div>
      <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
        Sends an immediate message via the Telegram Bot to all active, non-banned users in batch chunks. Personalize using <code style={{ color: 'var(--accent-purple)' }}>{"{first_name}"}</code>.
      </p>
      <form onSubmit={handleSend} className="space-y-3">
        <textarea
          className="form-input text-xs leading-relaxed w-full h-24 resize-none"
          placeholder="👋 Hi {first_name}!\nWe have added new payout structures today! Check the app to activate now! 🚀"
          value={message}
          onChange={(e) => setMessage(e.target.value)}
          required
        />
        {awaitingConfirm && (
          <div
            className="flex items-center gap-2 p-3 rounded-xl animate-slide-up"
            style={{ background: 'var(--badge-error-bg)', border: '1.5px solid var(--accent-red)' }}
          >
            <AlertCircle size={14} style={{ color: 'var(--accent-red)' }} className="flex-shrink-0" />
            <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>
              This will message ALL active users. Press Send again to confirm.
            </p>
            <button
              type="button"
              onClick={() => setAwaitingConfirm(false)}
              className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
            >Cancel</button>
          </div>
        )}
        <button type="submit" className="btn-primary w-full py-2.5 text-sm flex items-center justify-center gap-2"
          style={awaitingConfirm
            ? { background: 'var(--accent-red)', borderColor: 'var(--accent-red)' }
            : { background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)', borderColor: 'var(--accent-purple)' }}
          disabled={sending}>
          {sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}
          {sending ? 'Broadcasting…' : awaitingConfirm ? 'Tap again to confirm broadcast' : 'Send Broadcast to All Users'}
        </button>
      </form>
    </div>
  );
}

function MaintenanceModeCard({ enabled, saving, onToggle }) {
  const [awaitingConfirm, setAwaitingConfirm] = useState(false);

  function handleToggle() {
    if (saving) return;
    if (!enabled && !awaitingConfirm) {
      setAwaitingConfirm(true);
      return;
    }
    setAwaitingConfirm(false);
    onToggle(!enabled);
  }

  return (
    <div
      className="glass-card p-5"
      style={{
        borderColor: enabled ? 'rgba(239,68,68,0.5)' : 'rgba(251,146,60,0.3)',
        background: enabled
          ? 'linear-gradient(135deg, rgba(239,68,68,0.08) 0%, rgba(251,146,60,0.05) 100%)'
          : undefined,
      }}
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <ShieldAlert size={16} style={{ color: enabled ? 'var(--accent-red)' : 'var(--accent-orange)' }} />
            <p className="font-semibold text-sm" style={{ color: 'var(--text-primary)' }}>
              Maintenance Mode
            </p>
            <span
              className="text-[10px] font-bold px-2 py-0.5 rounded-full ml-1"
              style={{
                background: enabled ? 'rgba(239,68,68,0.15)' : 'var(--bg-tertiary)',
                color: enabled ? 'var(--accent-red)' : 'var(--text-faint)',
                border: `1px solid ${enabled ? 'rgba(239,68,68,0.4)' : 'var(--border-subtle)'}`,
                transition: 'all 0.25s',
              }}
            >
              {enabled ? 'ON' : 'OFF'}
            </span>
          </div>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            {enabled
              ? 'Site is under maintenance. Regular users are blocked \u2014 you (admin) can still access everything normally.'
              : 'When enabled, all regular users will see a maintenance page and be blocked from the app until you turn this off.'}
          </p>

          {awaitingConfirm && (
            <div
              className="flex items-center gap-2 mt-3 p-2.5 rounded-xl animate-slide-up"
              style={{ background: 'rgba(239,68,68,0.12)', border: '1.5px solid rgba(239,68,68,0.4)' }}
            >
              <AlertCircle size={13} style={{ color: 'var(--accent-red)' }} className="flex-shrink-0" />
              <p className="text-xs flex-1" style={{ color: 'var(--accent-red)' }}>
                This will immediately block all users. Tap the toggle again to confirm.
              </p>
              <button
                type="button"
                onClick={() => setAwaitingConfirm(false)}
                className="text-xs px-2 py-1 rounded-lg flex-shrink-0"
                style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
              >
                Cancel
              </button>
            </div>
          )}
        </div>

        {/* Pill toggle */}
        <button
          type="button"
          onClick={handleToggle}
          disabled={saving}
          aria-pressed={enabled}
          aria-label="Toggle maintenance mode"
          style={{
            width: 52,
            height: 28,
            borderRadius: 999,
            background: enabled ? 'var(--accent-red)' : 'var(--bg-tertiary)',
            border: `2px solid ${enabled ? 'var(--accent-red)' : 'var(--border-subtle)'}`,
            position: 'relative',
            cursor: saving ? 'not-allowed' : 'pointer',
            transition: 'background 0.25s, border-color 0.25s',
            opacity: saving ? 0.6 : 1,
            flexShrink: 0,
          }}
        >
          {saving ? (
            <Loader2
              size={14}
              className="animate-spin"
              style={{
                position: 'absolute',
                top: '50%',
                left: '50%',
                transform: 'translate(-50%, -50%)',
                color: enabled ? '#fff' : 'var(--text-muted)',
              }}
            />
          ) : (
            <span
              style={{
                position: 'absolute',
                top: 3,
                left: enabled ? 26 : 3,
                width: 18,
                height: 18,
                borderRadius: '50%',
                background: '#fff',
                boxShadow: '0 1px 4px rgba(0,0,0,0.25)',
                transition: 'left 0.22s cubic-bezier(.4,0,.2,1)',
              }}
            />
          )}
        </button>
      </div>
    </div>
  );
}
