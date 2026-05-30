import React, { useState, useEffect } from 'react';
import { Send, Smartphone, CheckCircle, Loader2, Phone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useTelegram } from '../hooks/useTelegram.js';
import { useLang } from '../context/LangContext';
import api from '../api/client.js';
import { useWebSocket } from '../hooks/useWebSocket.js';

const STATUS_TO_STEP = {
  pending:       0,
  in_progress:   1,
  awaiting_otp:  1,
  otp_uploaded:  2,
  success:       3,
  failed:        2,
  invalid:       1,
  expired:       2,
};

export default function ActivatePage() {
  const { haptic } = useTelegram();
  const { on, connected } = useWebSocket();
  const { t } = useLang();
  const [phone, setPhone] = useState('');
  const [countries, setCountries] = useState([]);
  const [detectedCountry, setDetectedCountry] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [currentActivation, setCurrentActivation] = useState(null);
  const [otp, setOtp] = useState('');
  const [submittingOtp, setSubmittingOtp] = useState(false);
  const [syncError, setSyncError] = useState('');
  const [wrongOtpError, setWrongOtpError] = useState(false);
  const [cooldownSecs, setCooldownSecs] = useState(0); // seconds remaining on 3-min block

  function getStatusMessage(status, fallback = '') {
    const key = `status.msg.${status}`;
    const msg = t(key);
    return msg !== key ? msg : fallback;
  }

  useEffect(() => {
    api.get('/countries').then(({ data }) => setCountries(data.data || []));
  }, []);

  // Cooldown countdown ticker
  useEffect(() => {
    if (cooldownSecs <= 0) return;
    const id = setInterval(() => setCooldownSecs((s) => Math.max(0, s - 1)), 1000);
    return () => clearInterval(id);
  }, [cooldownSecs]);

  useEffect(() => {
    let mounted = true;
    async function restoreLatestActivation() {
      try {
        const { data } = await api.get('/activations?limit=1');
        const latest = Array.isArray(data?.data) ? data.data[0] : null;
        if (!mounted || !latest) return;
        if (['pending', 'in_progress', 'awaiting_otp', 'otp_uploaded'].includes(latest.status)) {
          setCurrentActivation({
            id: latest.id,
            phone: latest.phone_full,
            payout: parseFloat(latest.payout_amount).toFixed(4),
            status: latest.status,
            otp: latest.otp_code || '',
            message: latest.message || getStatusMessage(latest.status),
          });
        }
      } catch { }
    }
    restoreLatestActivation();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!currentActivation?.id) return;
    const stop = on('activation:update', (payload) => {
      if (!payload || Number(payload.id) !== Number(currentActivation.id)) return;
      if (payload.status === 'deleted') {
        toast.error(payload.message || t('activate.removed'));
        resetFlow();
        return;
      }
      setCurrentActivation((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...payload,
          otp: payload.otp !== undefined ? payload.otp : prev.otp,
          message: payload.message || getStatusMessage(payload.status, prev.message),
        };
      });
      if (payload.wrongOtp) {
        setWrongOtpError(true);
        setOtp((prev) => (prev.length === 0 ? '' : prev));
      } else if (payload.otp) {
        setOtp((prev) => (prev.length === 0 ? String(payload.otp) : prev));
        setWrongOtpError(false);
        toast(t('activate.otpHint'), { icon: '🔑' });
      } else if (payload.otp === null) {
        setOtp('');
      }
      setSyncError('');
      if (payload.status === 'success') {
        toast.success(t('activate.successToast'));
      } else if (['failed', 'invalid', 'expired'].includes(payload.status)) {
        toast.error(payload.message || 'Activation ended');
      }
    });
    return stop;
  }, [currentActivation?.id, on]);

  useEffect(() => {
    if (!currentActivation?.id) return;
    const terminalStatuses = new Set(['success', 'failed', 'invalid', 'expired']);
    if (terminalStatuses.has(currentActivation.status)) return;
    const timer = setInterval(async () => {
      try {
        const { data } = await api.get(`/activations/${currentActivation.id}`);
        const latest = data?.data;
        if (latest) {
          setCurrentActivation((prev) => ({
            ...prev,
            id: latest.id,
            phone: latest.phone_full,
            payout: parseFloat(latest.payout_amount).toFixed(4),
            status: latest.status,
            otp: latest.otp_code || prev?.otp || '',
            message: latest.message || getStatusMessage(latest.status, prev?.message),
          }));
          setSyncError('');
        }
      } catch (err) {
        if (err.response?.status === 404) {
          toast.error('Activation removed');
          resetFlow();
          return;
        }
        setSyncError('We are still checking, but live refresh is temporarily unavailable.');
      }
    }, 5000);
    return () => clearInterval(timer);
  // Bug-fix: depend only on id so the interval is NOT torn down and restarted
  // on every status change. The terminal check inside the callback stops it when done.
  }, [currentActivation?.id]);

  useEffect(() => {
    const raw = phone.replace(/^\+/, '');
    if (raw.length >= 1) {
      const match =
        countries.find((c) => raw.startsWith(c.cc) && c.cc.length === 3) ||
        countries.find((c) => raw.startsWith(c.cc) && c.cc.length === 2) ||
        countries.find((c) => raw.startsWith(c.cc) && c.cc.length === 1);
      setDetectedCountry(match || null);
    } else {
      setDetectedCountry(null);
    }
  }, [phone, countries]);

  async function handleSubmitPhone(e) {
    e.preventDefault();
    if (!phone.trim()) return toast.error(t('activate.enterPhone'));
    if (cooldownSecs > 0) return toast.error(`Please wait ${Math.ceil(cooldownSecs / 60)} minute(s) before resubmitting this number.`);
    setSubmitting(true);
    haptic?.('light');
    try {
      const { data } = await api.post('/activations', { phone });
      setCurrentActivation({
        id: data.data.id,
        phone: data.data.phone,
        payout: parseFloat(data.data.payout).toFixed(4),
        status: data.data.status || 'pending',
        otp: '',
        message: data.data.message || getStatusMessage(data.data.status || 'pending'),
      });
      setCooldownSecs(0);
      toast.success(data.data.message || 'Number submitted! Waiting for OTP...');
      haptic?.('success');
    } catch (err) {
      const errData = err.response?.data;
      if (err.response?.status === 429 && errData?.cooldown) {
        setCooldownSecs(errData.cooldown_remaining_seconds || 180);
        toast.error(errData.message || 'This number is temporarily blocked. Please wait 3 minutes.');
      } else {
        toast.error(errData?.message || 'Failed to submit number');
      }
    } finally { setSubmitting(false); }
  }

  async function handleSubmitOtp(e) {
    e.preventDefault();
    if (otp.length < 6) return toast.error(t('activate.enterOtp'));
    setSubmittingOtp(true);
    haptic?.('light');
    try {
      const { data } = await api.post(`/activations/${currentActivation.id}/otp`, { otp });
      toast.success(data.message || 'OTP submitted! Verifying...');
      setCurrentActivation((prev) => ({
        ...prev,
        status: data.data?.status || 'otp_uploaded',
        otp,
        message: data.message || prev?.message || 'OTP submitted.',
      }));
      setOtp('');
      // Bug-fix: do NOT clear phone/detectedCountry here — only resetFlow() should do that
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to submit OTP');
    } finally { setSubmittingOtp(false); }
  }

  const [cancelling, setCancelling] = useState(false);

  async function handleCancel() {
    if (!currentActivation?.id) return;
    setCancelling(true);
    haptic?.('medium');
    try {
      await api.delete(`/activations/${currentActivation.id}`);
      toast.success(t('activate.cancelled'));
      resetFlow();
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to cancel activation');
    } finally { setCancelling(false); }
  }

  function resetFlow() {
    setCurrentActivation(null);
    setPhone(''); setOtp('');
    setDetectedCountry(null);
    setWrongOtpError(false);
    // do NOT reset cooldownSecs — the block follows the number, not the flow
  }

  const statusStep = STATUS_TO_STEP[currentActivation?.status] ?? 0;
  const isSuccess = currentActivation?.status === 'success';
  const isTerminal = ['success', 'failed', 'invalid', 'expired', 'deleted'].includes(currentActivation?.status);
  const isErrorTerminal = ['failed', 'invalid', 'expired'].includes(currentActivation?.status);
  // OTP input is only shown when the provider has confirmed IN_PROGRESS (registrationStatus = 2)
  const canSubmitOtp = !isTerminal && currentActivation?.status === 'in_progress';
  const statusMessage = currentActivation?.message || getStatusMessage(currentActivation?.status);

  // Format MM:SS countdown string
  const cooldownDisplay = cooldownSecs > 0
    ? `${String(Math.floor(cooldownSecs / 60)).padStart(2, '0')}:${String(cooldownSecs % 60).padStart(2, '0')}`
    : null;

  const steps = [
    { label: t('activate.step.submitted'), desc: t('activate.step.submittedDesc') },
    { label: t('activate.step.waiting'),   desc: t('activate.step.waitingDesc') },
    { label: t('activate.step.otpSent'),   desc: t('activate.step.otpSentDesc') },
    { label: t('activate.step.success'),   desc: t('activate.step.successDesc') },
  ];

  return (
    <div className="space-y-5 animate-fade-in">
      <div>
        <h1 className="text-xl font-bold" style={{ color: 'var(--text-primary)' }}>{t('activate.title')}</h1>
        <p className="text-sm mt-0.5" style={{ color: 'var(--text-muted)' }}>{t('activate.subtitle')}</p>
      </div>

      {!currentActivation ? (
        <form onSubmit={handleSubmitPhone} className="space-y-4">
          <div className="glass-card p-5 space-y-4">
            <div className="space-y-2">
              <label className="text-xs font-semibold uppercase tracking-wider" style={{ color: 'var(--text-muted)' }}>
                {t('activate.phoneLabel')}
              </label>
              <div className="relative">
                <Phone size={16} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: 'var(--text-faint)' }} />
                <input type="tel" className="form-input pl-9"
                  placeholder="+79183957013"
                  value={phone} onChange={(e) => setPhone(e.target.value)} required />
              </div>
              <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{t('activate.phoneHint')}</p>
            </div>

            {detectedCountry && (
              <div className="flex items-center justify-between p-3 rounded-xl animate-slide-up"
                style={{ background: 'var(--accent-blue-soft)', border: '1.5px solid var(--border-color)' }}>
                <div className="flex items-center gap-3">
                  <span className="text-2xl">{detectedCountry.flag_emoji}</span>
                  <div>
                    <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{detectedCountry.country_name}</p>
                    <p className="text-xs" style={{ color: 'var(--text-muted)' }}>+{detectedCountry.cc}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-base" style={{ color: 'var(--accent-green)' }}>
                    +${parseFloat(detectedCountry.payout_amount).toFixed(4)}
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('activate.perActivation')}</p>
                </div>
              </div>
            )}

            {/* Cooldown banner — shown when this number was recently blocked */}
            {cooldownDisplay && (
              <div className="flex items-center gap-3 p-3 rounded-xl animate-slide-up"
                style={{ background: 'var(--badge-danger-bg)', border: '1.5px solid var(--badge-danger-txt)' }}>
                <span className="text-xl">⏳</span>
                <div className="flex-1">
                  <p className="text-sm font-semibold" style={{ color: 'var(--badge-danger-txt)' }}>
                    Number temporarily blocked
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    You can resubmit after{' '}
                    <span className="font-bold tabular-nums" style={{ color: 'var(--badge-danger-txt)' }}>
                      {cooldownDisplay}
                    </span>
                  </p>
                </div>
              </div>
            )}
          </div>

          <button type="submit" className="btn-primary w-full py-4 text-base" disabled={submitting}>
            {submitting ? <Loader2 size={20} className="animate-spin" /> : <Send size={20} />}
            {submitting ? t('activate.submitting') : t('activate.submitNumber')}
          </button>

          <div className="glass-card p-4">
            <p className="text-xs font-semibold uppercase tracking-wider mb-3" style={{ color: 'var(--text-muted)' }}>
              {t('activate.payoutsByCountry')}
            </p>
            <div className="grid grid-cols-2 gap-2">
              {countries.map((c) => (
                <button key={c.cc} type="button" onClick={() => setPhone('+' + c.cc)}
                  className="flex items-center justify-between p-2.5 rounded-xl text-left transition-all hover:scale-[1.02]"
                  style={{ background: 'var(--bg-tertiary)', border: '1px solid var(--border-subtle)' }}>
                  <span className="flex items-center gap-1.5 text-sm">
                    {c.flag_emoji}
                    <span className="text-xs font-medium" style={{ color: 'var(--text-secondary)' }}>
                      {c.country_name}
                    </span>
                  </span>
                  <span className="text-xs font-bold" style={{ color: 'var(--accent-green)' }}>
                    ${parseFloat(c.payout_amount).toFixed(2)}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {/* ── Step tracker — hidden entirely on success (success card replaces it) ── */}
          {!isSuccess && (
            <div className="glass-card p-5">
              <div className="flex items-center gap-3 mb-5">
                <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'var(--accent-blue-soft)' }}>
                  <Smartphone size={20} style={{ color: 'var(--accent-blue)' }} />
                </div>
                <div>
                  <p className="font-semibold" style={{ color: 'var(--text-primary)' }}>{currentActivation.phone}</p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    {t('activate.payout')}{' '}
                    <span className="font-bold" style={{ color: 'var(--accent-green)' }}>
                      ${currentActivation.payout}
                    </span>
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                {steps.map((step, idx) => {
                  // On success all steps are done; never spin the last step
                  const isDone = idx < statusStep;
                  const isActive = !isSuccess && idx === statusStep;
                  return (
                    <div key={idx}
                      className={`flex items-center gap-3 p-3 rounded-xl transition-all ${isActive ? '' : isDone ? '' : 'opacity-35'}`}
                      style={isActive ? {
                        background: 'var(--accent-blue-soft)',
                        border: '1.5px solid var(--border-color)',
                      } : isDone ? { background: 'var(--badge-success-bg)' } : {}}>
                      <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{
                          background: isDone ? 'var(--badge-success-bg)' : isActive ? 'var(--accent-blue-soft)' : 'var(--bg-tertiary)',
                        }}>
                        {isDone
                          ? <CheckCircle size={14} style={{ color: 'var(--accent-green)' }} />
                          : isActive
                            ? <Loader2 size={14} className="animate-spin" style={{ color: 'var(--accent-blue)' }} />
                            : <span className="text-xs font-bold" style={{ color: 'var(--text-faint)' }}>{idx + 1}</span>}
                      </div>
                      <div>
                        <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>{step.label}</p>
                        <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{step.desc}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
          {/* Sync error warning — shown when fallback poll fails temporarily */}
          {syncError && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-xl animate-slide-up"
              style={{ background: 'var(--badge-warn-bg)', border: '1px solid var(--badge-warn-txt)' }}>
              <span className="text-sm">⚠️</span>
              <p className="text-xs" style={{ color: 'var(--text-secondary)' }}>{syncError}</p>
            </div>
          )}

          {/* OTP input — only when provider has confirmed IN_PROGRESS (registrationStatus = 2) */}
          {canSubmitOtp && !isTerminal && (
            <form onSubmit={handleSubmitOtp} className="glass-card p-5 space-y-4 animate-slide-up">
              <div>
                <p className="font-semibold mb-0.5" style={{ color: 'var(--text-primary)' }}>{t('activate.otpTitle')}</p>
                <p className="text-xs" style={{ color: 'var(--text-muted)' }}>{t('activate.otpSubtitle')}</p>
              </div>
              <input type="text" inputMode="numeric" autoComplete="one-time-code"
                className="form-input text-center text-3xl font-bold tracking-widest"
                placeholder="123456" value={otp}
                onChange={(e) => {
                  setOtp(e.target.value.replace(/\D/g, '').slice(0, 8));
                  if (wrongOtpError) setWrongOtpError(false);
                }}
                style={wrongOtpError ? { border: '1.5px solid var(--badge-danger-txt)' } : {}} />
              <button type="submit" className="btn-primary w-full py-3.5"
                disabled={submittingOtp || otp.length < 6}>
                {submittingOtp ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
                {submittingOtp ? t('activate.submittingOtp') : t('activate.submitOtp')}
              </button>
            </form>
          )}

          {/* OTP submitted — waiting for provider verification */}
          {!isTerminal && currentActivation?.status === 'otp_uploaded' && (
            <div className="glass-card p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    OTP submitted — verifying with provider
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    Please wait while we confirm the code. This usually takes a few seconds.
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Pending state — waiting for provider to confirm IN_PROGRESS */}
          {!isTerminal && currentActivation?.status === 'pending' && (
            <div className="glass-card p-4 animate-slide-up">
              <div className="flex items-center gap-3">
                <Loader2 size={16} className="animate-spin flex-shrink-0" style={{ color: 'var(--accent-blue)' }} />
                <div>
                  <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>
                    Waiting for provider confirmation
                  </p>
                  <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                    OTP entry will unlock once the network confirms this number is active.
                  </p>
                </div>
              </div>
            </div>
          )}

          {currentActivation && !isTerminal && !isSuccess && (
            <button onClick={handleCancel} disabled={cancelling}
              className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
              style={{
                background: 'var(--badge-danger-bg)',
                border: '1.5px solid var(--badge-danger-txt)',
                color: 'var(--badge-danger-txt)',
                opacity: cancelling ? 0.6 : 1,
              }}>
              {cancelling && <Loader2 size={14} className="animate-spin inline mr-1.5" />}
              {cancelling ? t('activate.cancelling') : t('activate.cancel')}
            </button>
          )}

          {isSuccess && (
            <div className="space-y-3 animate-slide-up">
              <div className="p-6 rounded-2xl text-center"
                style={{ background: 'var(--badge-success-bg)', border: '1.5px solid var(--badge-success-txt)' }}>
                <p className="text-5xl mb-3">🎉</p>
                <p className="font-bold text-lg" style={{ color: 'var(--accent-green)' }}>{t('activate.successTitle')}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>
                  <span className="font-bold" style={{ color: 'var(--accent-green)' }}>
                    ${currentActivation.payout}
                  </span>{' '}{t('activate.successMsg')}
                </p>
              </div>
              <button onClick={resetFlow} className="btn-secondary w-full py-3">
                {t('activate.startNew')}
              </button>
            </div>
          )}

          {isErrorTerminal && (
            <div className="space-y-3 animate-slide-up">
              <div className="p-6 rounded-2xl text-center"
                style={{ background: 'var(--badge-danger-bg)', border: '1.5px solid var(--badge-danger-txt)' }}>
                <p className="text-5xl mb-3">⚠️</p>
                <p className="font-bold text-lg" style={{ color: 'var(--badge-danger-txt)' }}>{t('activate.failedTitle')}</p>
                <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{statusMessage}</p>
              </div>
              <button onClick={resetFlow} className="btn-secondary w-full py-3">
                {t('activate.startNew')}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
