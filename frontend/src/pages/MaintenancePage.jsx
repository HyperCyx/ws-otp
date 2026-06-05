import React, { useEffect, useState } from 'react';
import { Wrench } from 'lucide-react';
import { useLang } from '../context/LangContext';

export default function MaintenancePage() {
  const { refreshSettings } = useLang();
  const [countdown, setCountdown] = useState(30);

  // Auto-retry every 30 s — if maintenance ends the settings refresh will
  // update maintenanceMode in LangContext and App.jsx will unmount this page.
  useEffect(() => {
    const tick = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          refreshSettings();
          return 30;
        }
        return c - 1;
      });
    }, 1000);
    return () => clearInterval(tick);
  }, [refreshSettings]);

  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center gap-6 px-6 text-center"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Glowing icon */}
      <div className="relative">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(251,146,60,0.25) 0%, rgba(239,68,68,0.2) 100%)',
            border: '2px solid rgba(251,146,60,0.45)',
            boxShadow: '0 0 40px rgba(251,146,60,0.25)',
          }}
        >
          <Wrench size={40} style={{ color: 'var(--accent-orange)' }} className="animate-bounce" />
        </div>
        {/* Pulse ring */}
        <div
          className="absolute -inset-3 rounded-3xl border-2 animate-ping"
          style={{ borderColor: 'rgba(251,146,60,0.2)' }}
        />
      </div>

      {/* Text */}
      <div className="space-y-2 max-w-xs">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          Under Maintenance
        </h1>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          We're making the platform better. This won't take long — please check back shortly.
        </p>
      </div>

      {/* Countdown pill */}
      <div
        className="px-5 py-2.5 rounded-2xl"
        style={{
          background: 'var(--bg-card)',
          border: '1px solid var(--border-subtle)',
        }}
      >
        <p className="text-xs" style={{ color: 'var(--text-faint)' }}>
          Checking again in{' '}
          <span className="font-bold tabular-nums" style={{ color: 'var(--accent-orange)' }}>
            {countdown}s
          </span>
        </p>
      </div>

      {/* Decorative dots */}
      <div className="flex gap-2 mt-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full animate-bounce"
            style={{
              background: 'var(--accent-orange)',
              animationDelay: `${i * 0.18}s`,
              opacity: 0.6,
            }}
          />
        ))}
      </div>
    </div>
  );
}
