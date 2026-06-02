import React, { useEffect, useState, useCallback } from 'react';
import {
  KeyRound, Save, Trash2, Loader2, Eye, EyeOff,
  CheckCircle2, AlertTriangle, RefreshCw, ShieldCheck,
  PlusCircle, ChevronDown, ChevronUp, X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import api from '../../api/client';

// ── Token status badge ──────────────────────────────────────────────────────
function TokenBadge({ status, expiresAt }) {
  if (status === 'active') {
    const exp = expiresAt ? new Date(expiresAt) : null;
    const timeLeft = exp ? Math.max(0, Math.round((exp - Date.now()) / 60000)) : null;
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
        style={{ background: 'var(--accent-green-soft)', color: 'var(--accent-green)', border: '1px solid var(--accent-green)' }}>
        <CheckCircle2 size={10} />
        Token active {timeLeft !== null ? `· ${timeLeft}m` : ''}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold"
      style={{ background: 'var(--accent-red-soft)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}>
      <AlertTriangle size={10} />
      No token
    </span>
  );
}

// ── Add New Country Form ────────────────────────────────────────────────────
function AddCountryForm({ onAdded }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [form, setForm] = useState({
    cc: '', country_name: '', iso_code: '', flag_emoji: '',
    payout_amount: '', api_account: '', api_password: '', api_identity: 'Member',
  });

  function setField(key, val) { setForm((f) => ({ ...f, [key]: val })); }

  async function submit() {
    if (!form.cc || !form.country_name || !form.iso_code || !form.api_account || !form.api_password) {
      toast.error('Country code, name, ISO code, username and password are all required');
      return;
    }
    setSaving(true);
    try {
      const { data } = await api.post('/admin/countries', form);
      if (data.warning) {
        toast.error(`⚠️ ${data.message}`);
      } else {
        toast.success(`✅ ${data.message}`);
      }
      setForm({ cc: '', country_name: '', iso_code: '', flag_emoji: '', payout_amount: '', api_account: '', api_password: '', api_identity: 'Member' });
      setOpen(false);
      onAdded();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to add country');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="glass-card overflow-hidden"
      style={{ border: '2px dashed var(--accent-purple)', background: 'var(--accent-purple-soft, rgba(139,92,246,0.04))' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center gap-3 p-4 text-left transition-all hover:opacity-80">
        <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
          style={{ background: 'var(--accent-purple)', color: '#fff' }}>
          <PlusCircle size={16} />
        </div>
        <div className="flex-1">
          <p className="text-sm font-bold" style={{ color: 'var(--accent-purple)' }}>Add New Country</p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            Set country info + API credentials. Token is generated immediately.
          </p>
        </div>
        {open ? <ChevronUp size={16} style={{ color: 'var(--text-faint)' }} /> : <ChevronDown size={16} style={{ color: 'var(--text-faint)' }} />}
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <div className="grid grid-cols-2 gap-3 pt-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Country Code *</label>
              <input className="form-input w-full text-sm" placeholder="e.g. 7" value={form.cc}
                onChange={(e) => setField('cc', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>ISO Code *</label>
              <input className="form-input w-full text-sm" placeholder="e.g. RU" value={form.iso_code}
                onChange={(e) => setField('iso_code', e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Country Name *</label>
              <input className="form-input w-full text-sm" placeholder="e.g. Russia" value={form.country_name}
                onChange={(e) => setField('country_name', e.target.value)} />
            </div>
            <div>
              <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Flag Emoji</label>
              <input className="form-input w-full text-sm" placeholder="🇷🇺" value={form.flag_emoji}
                onChange={(e) => setField('flag_emoji', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Payout Amount ($)</label>
            <input type="number" step="0.01" min="0" className="form-input w-full text-sm" placeholder="0.30"
              value={form.payout_amount} onChange={(e) => setField('payout_amount', e.target.value)} />
          </div>
          <div className="border-t pt-3" style={{ borderColor: 'var(--border-subtle)' }}>
            <p className="text-xs font-bold mb-2" style={{ color: 'var(--accent-purple)' }}>API Credentials</p>
            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Username *</label>
                <input className="form-input w-full text-sm" placeholder="e.g. RU_USER" value={form.api_account}
                  onChange={(e) => setField('api_account', e.target.value)} />
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Password *</label>
                <div className="relative">
                  <input type={showPass ? 'text' : 'password'} className="form-input w-full text-sm pr-10"
                    placeholder="Enter password" value={form.api_password}
                    onChange={(e) => setField('api_password', e.target.value)} />
                  <button type="button" onClick={() => setShowPass((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2"
                    style={{ color: 'var(--text-faint)' }}>
                    {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                  </button>
                </div>
              </div>
              <div>
                <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Identity</label>
                <input className="form-input w-full text-sm" placeholder="Member" value={form.api_identity}
                  onChange={(e) => setField('api_identity', e.target.value)} />
              </div>
            </div>
          </div>
          <button onClick={submit} disabled={saving}
            className="btn-primary w-full py-2 text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <PlusCircle size={14} />}
            {saving ? 'Adding…' : 'Add Country & Generate Token'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Single country row ──────────────────────────────────────────────────────
function CredentialRow({ country, onSaved }) {
  const [editing, setEditing] = useState(false);
  const [showPass, setShowPass] = useState(false);
  const [saving, setSaving] = useState(false);
  const [removing, setRemoving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [form, setForm] = useState({
    api_account: country.api_account || '',
    api_password: '',
    api_identity: country.api_identity || 'Member',
  });

  const hasCredentials = !!country.api_account;

  async function save() {
    if (!form.api_account.trim()) { toast.error('Username is required'); return; }
    if (!hasCredentials && !form.api_password.trim()) { toast.error('Password is required'); return; }
    setSaving(true);
    try {
      await api.post(`/admin/country-credentials/${country.cc}`, form);
      toast.success(`✅ Credentials saved for +${country.cc}`);
      setEditing(false);
      setForm((f) => ({ ...f, api_password: '' }));
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save');
    } finally { setSaving(false); }
  }

  async function removeCredentials() {
    if (!window.confirm(`Remove credentials for +${country.cc} (${country.country_name})?\nThis country will stop accepting activations.`)) return;
    setRemoving(true);
    try {
      await api.delete(`/admin/country-credentials/${country.cc}`);
      toast.success(`Credentials removed for +${country.cc}`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to remove credentials');
    } finally { setRemoving(false); }
  }

  async function deleteCountry() {
    if (!window.confirm(`Delete country +${country.cc} (${country.country_name}) entirely?\nThis cannot be undone.`)) return;
    setDeleting(true);
    try {
      await api.delete(`/admin/countries/${country.cc}`);
      toast.success(`Country +${country.cc} deleted`);
      onSaved();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to delete country');
    } finally { setDeleting(false); }
  }

  return (
    <div className="glass-card overflow-hidden transition-all"
      style={{ border: hasCredentials ? '1px solid var(--accent-purple)' : '1px solid var(--accent-red)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 p-4">
        <span className="text-2xl flex-shrink-0">{country.flag_emoji || '🌍'}</span>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-bold truncate" style={{ color: 'var(--text-primary)' }}>
            {country.country_name}
          </p>
          <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
            +{country.cc} &nbsp;·&nbsp;
            {hasCredentials ? (
              <span style={{ color: 'var(--accent-purple)' }}>
                <ShieldCheck size={10} className="inline mr-0.5" />
                {country.api_account}
              </span>
            ) : (
              <span style={{ color: 'var(--accent-red)' }}>
                <AlertTriangle size={10} className="inline mr-0.5" />
                No credentials — unavailable
              </span>
            )}
          </p>
        </div>

        <TokenBadge status={country.token_status} expiresAt={country.token_expires_at} />

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Delete country entirely */}
          <button onClick={deleteCountry} disabled={deleting}
            className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
            style={{ background: 'var(--accent-red-soft)', color: 'var(--accent-red)', border: '1px solid var(--accent-red)' }}
            title="Delete country">
            {deleting ? <Loader2 size={12} className="animate-spin" /> : <X size={12} />}
          </button>
          {/* Remove credentials only */}
          {hasCredentials && !editing && (
            <button onClick={removeCredentials} disabled={removing}
              className="w-7 h-7 rounded-lg flex items-center justify-center transition-all hover:scale-110"
              style={{ background: 'var(--bg-tertiary)', color: 'var(--text-muted)', border: '1px solid var(--border-subtle)' }}
              title="Remove credentials only">
              {removing ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
            </button>
          )}
          <button
            onClick={() => { setEditing((e) => !e); setShowPass(false); }}
            className="btn-primary py-1.5 px-3 text-xs"
            style={editing ? { background: 'var(--bg-tertiary)', color: 'var(--text-muted)' } : {}}>
            {editing ? 'Cancel' : hasCredentials ? 'Edit' : 'Set Credentials'}
          </button>
        </div>
      </div>

      {/* Edit form */}
      {editing && (
        <div className="px-4 pb-4 pt-0 space-y-3 border-t" style={{ borderColor: 'var(--border-subtle)' }}>
          <p className="text-xs pt-3" style={{ color: 'var(--text-muted)' }}>
            Credentials for +{country.cc}. Token is cached and refreshed automatically.
          </p>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Username</label>
            <input type="text" className="form-input w-full text-sm" placeholder="e.g. RU_USER"
              value={form.api_account} onChange={(e) => setForm((f) => ({ ...f, api_account: e.target.value }))} />
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>
              Password {hasCredentials && <span style={{ color: 'var(--text-faint)' }}>(leave blank to keep existing)</span>}
            </label>
            <div className="relative">
              <input type={showPass ? 'text' : 'password'} className="form-input w-full text-sm pr-10"
                placeholder={hasCredentials ? '••••••••' : 'Enter password'}
                value={form.api_password} onChange={(e) => setForm((f) => ({ ...f, api_password: e.target.value }))} />
              <button type="button" onClick={() => setShowPass((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }}>
                {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
              </button>
            </div>
          </div>
          <div>
            <label className="text-xs font-semibold mb-1 block" style={{ color: 'var(--text-muted)' }}>Identity</label>
            <input type="text" className="form-input w-full text-sm" placeholder="Member"
              value={form.api_identity} onChange={(e) => setForm((f) => ({ ...f, api_identity: e.target.value }))} />
          </div>
          <button onClick={save} disabled={saving}
            className="btn-primary w-full py-2 text-sm flex items-center justify-center gap-2">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {saving ? 'Saving…' : 'Save & Generate Token'}
          </button>
        </div>
      )}
    </div>
  );
}

// ── Main page ───────────────────────────────────────────────────────────────
export default function AdminCredentials() {
  const [countries, setCountries] = useState([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(() => {
    setLoading(true);
    api.get('/admin/country-credentials')
      .then(({ data }) => setCountries(Array.isArray(data?.data) ? data.data : []))
      .catch(() => toast.error('Failed to load countries'))
      .finally(() => setLoading(false));
  }, []);

  useEffect(() => { load(); }, [load]);

  const configured = countries.filter((c) => c.api_account);
  const unconfigured = countries.filter((c) => !c.api_account);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <KeyRound size={18} style={{ color: 'var(--accent-purple)' }} />
          <h1 className="text-lg font-bold" style={{ color: 'var(--text-primary)' }}>Countries & Credentials</h1>
        </div>
        <button onClick={load} disabled={loading}
          className="w-8 h-8 rounded-lg flex items-center justify-center transition-all hover:scale-110"
          style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)' }}>
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>

      <p className="text-xs leading-relaxed" style={{ color: 'var(--text-faint)' }}>
        Each country must have its own API username and password. Countries without credentials are unavailable — users cannot submit numbers for them.
        Tokens are cached automatically and refreshed on expiry or 401.
      </p>

      {/* Summary bar */}
      {!loading && (
        <div className="glass-card p-3 flex items-center gap-4">
          <div className="text-center">
            <p className="text-lg font-black" style={{ color: 'var(--accent-purple)' }}>{configured.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Active</p>
          </div>
          <div className="h-8 w-px" style={{ background: 'var(--border-subtle)' }} />
          <div className="text-center">
            <p className="text-lg font-black" style={{ color: 'var(--accent-green)' }}>
              {countries.filter((c) => c.token_status === 'active').length}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Tokens live</p>
          </div>
          <div className="h-8 w-px" style={{ background: 'var(--border-subtle)' }} />
          <div className="text-center">
            <p className="text-lg font-black" style={{ color: 'var(--accent-red)' }}>{unconfigured.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Unavailable</p>
          </div>
          <div className="h-8 w-px" style={{ background: 'var(--border-subtle)' }} />
          <div className="text-center">
            <p className="text-lg font-black" style={{ color: 'var(--text-muted)' }}>{countries.length}</p>
            <p className="text-xs" style={{ color: 'var(--text-faint)' }}>Total</p>
          </div>
        </div>
      )}

      {/* Add new country */}
      <AddCountryForm onAdded={load} />

      {/* Country list */}
      {loading ? (
        <div className="space-y-2">
          {[1, 2, 3, 4, 5].map((i) => <div key={i} className="skeleton h-16 rounded-xl" />)}
        </div>
      ) : (
        <>
          {configured.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide px-1" style={{ color: 'var(--accent-purple)' }}>
                Configured & Active ({configured.length})
              </p>
              {configured.map((c) => <CredentialRow key={c.cc} country={c} onSaved={load} />)}
            </div>
          )}

          {unconfigured.length > 0 && (
            <div className="space-y-2">
              <p className="text-xs font-bold uppercase tracking-wide px-1" style={{ color: 'var(--accent-red)' }}>
                No Credentials — Unavailable ({unconfigured.length})
              </p>
              {unconfigured.map((c) => <CredentialRow key={c.cc} country={c} onSaved={load} />)}
            </div>
          )}

          {countries.length === 0 && (
            <div className="glass-card p-8 text-center">
              <p className="text-sm font-semibold" style={{ color: 'var(--text-muted)' }}>No countries configured</p>
              <p className="text-xs mt-1" style={{ color: 'var(--text-faint)' }}>Use the form above to add your first country.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
