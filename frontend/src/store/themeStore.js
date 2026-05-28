import { create } from 'zustand';

export const useThemeStore = create((set, get) => ({
  theme: 'light', // default: light/white

  toggleTheme: () => {
    const next = get().theme === 'light' ? 'dark' : 'light';
    set({ theme: next });
    document.documentElement.setAttribute('data-theme', next);
    localStorage.setItem('otp-theme', next);
  },

  initTheme: () => {
    const saved = localStorage.getItem('otp-theme') || 'light';
    set({ theme: saved });
    document.documentElement.setAttribute('data-theme', saved);
  },
}));
