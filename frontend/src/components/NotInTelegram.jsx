import React from 'react';

const lang = localStorage.getItem('lang') || 'en';
const strings = {
  en: {
    title: 'OTP Activations',
    subtitle: 'This app runs inside Telegram',
    desc: 'Please open this app through the Telegram mini app to access all features.',
    button: 'Open in Telegram',
    or: 'or open the link on your mobile device',
  },
  ru: {
    title: 'OTP Активации',
    subtitle: 'Это приложение работает в Telegram',
    desc: 'Пожалуйста, откройте это приложение через мини-приложение Telegram.',
    button: 'Открыть в Telegram',
    or: 'или откройте ссылку на мобильном устройстве',
  },
};
const s = strings[lang] || strings.en;

export default function NotInTelegram() {
  return (
    <div
      className="min-h-screen flex flex-col items-center justify-center px-6 text-center gap-6"
      style={{ background: 'var(--bg-primary)' }}
    >
      {/* Logo */}
      <div className="relative mb-2">
        <div
          className="w-24 h-24 rounded-3xl flex items-center justify-center text-5xl shadow-2xl"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
            boxShadow: '0 12px 40px rgba(14,165,233,0.45)',
          }}
        >
          ⚡
        </div>
        <div
          className="absolute -inset-2 rounded-3xl border-2 animate-ping"
          style={{ borderColor: 'rgba(14,165,233,0.25)' }}
        />
      </div>

      {/* Text */}
      <div className="space-y-2 max-w-xs">
        <h1 className="text-2xl font-extrabold" style={{ color: 'var(--text-primary)' }}>
          {s.title}
        </h1>
        <p className="font-semibold text-base" style={{ color: 'var(--accent-blue)' }}>
          {s.subtitle}
        </p>
        <p className="text-sm leading-relaxed" style={{ color: 'var(--text-muted)' }}>
          {s.desc}
        </p>
      </div>

      {/* Telegram brand icon + button */}
      <a
        href="https://t.me"
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 px-8 py-4 rounded-2xl font-bold text-white text-base shadow-lg transition-transform active:scale-95"
        style={{
          background: 'linear-gradient(135deg, #2aabee, #229ed9)',
          boxShadow: '0 6px 24px rgba(42,171,238,0.4)',
        }}
      >
        <svg width="22" height="22" viewBox="0 0 240 240" fill="none">
          <circle cx="120" cy="120" r="120" fill="white" fillOpacity="0.15" />
          <path
            d="M98 149.5l-3.5 36.5c5 0 7.2-2.2 9.8-4.8l23.6-22.7 49 35.8c9 5 15.4 2.4 17.8-8.3l32.3-152.2c2.9-13.6-4.9-19-13.5-15.7L17 98.6c-13.2 5.2-13 12.7-2.4 16.1l45.5 14.2 105.6-66.5c5-3.1 9.5-1.4 5.8 2z"
            fill="white"
          />
        </svg>
        {s.button}
      </a>

      <p className="text-xs" style={{ color: 'var(--text-faint)' }}>{s.or}</p>
    </div>
  );
}
