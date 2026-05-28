import React from 'react';

const lang = localStorage.getItem('lang') || 'en';
const text = {
  en: { title: 'OTP Activations', init: 'Initializing…' },
  ru: { title: 'OTP Активации',   init: 'Загрузка…' },
}[lang] || { title: 'OTP Activations', init: 'Initializing…' };

export default function LoadingScreen() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
      style={{ background: 'var(--bg-primary)' }}>
      <div className="relative">
        <div className="w-20 h-20 rounded-2xl flex items-center justify-center text-4xl"
          style={{
            background: 'linear-gradient(135deg, #0ea5e9, #8b5cf6)',
            boxShadow: '0 8px 32px rgba(14,165,233,0.4)',
          }}>
          ⚡
        </div>
        <div className="absolute -inset-2 rounded-2xl border-2 animate-ping"
          style={{ borderColor: 'rgba(14,165,233,0.3)' }} />
      </div>

      <div className="text-center">
        <p className="font-bold text-xl" style={{ color: 'var(--text-primary)' }}>{text.title}</p>
        <p className="text-sm mt-1" style={{ color: 'var(--text-muted)' }}>{text.init}</p>
      </div>

      <div className="flex gap-2">
        {[0,1,2].map((i) => (
          <div key={i} className="w-2 h-2 rounded-full animate-bounce"
            style={{ background: 'var(--accent-blue)', animationDelay: `${i * 0.15}s`, opacity: 0.7 }} />
        ))}
      </div>
    </div>
  );
}
