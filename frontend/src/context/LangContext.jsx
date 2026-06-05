import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import translations from '../i18n/translations';
import api from '../api/client';

const LangContext = createContext(null);

export function LangProvider({ children }) {
  const [lang, setLangState] = useState(() => localStorage.getItem('lang') || 'en');
  const [minWithdrawal, setMinWithdrawal] = useState(1);
  const [startupMessage, setStartupMessage] = useState('');
  const [maintenanceMode, setMaintenanceMode] = useState(false);
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  const refreshSettings = useCallback(() => {
    return api.get('/settings')
      .then(({ data }) => {
        const s = data?.data || {};
        if (s.default_language && !localStorage.getItem('lang')) {
          setLangState(s.default_language);
        }
        if (s.min_withdrawal_amount) {
          setMinWithdrawal(parseFloat(s.min_withdrawal_amount));
        }
        if (s.startup_message !== undefined) {
          const enabled = s.startup_message_enabled !== '0';
          setStartupMessage(enabled ? (s.startup_message || '') : '');
        }
        setMaintenanceMode(s.maintenance_mode === '1');
      })
      .catch((err) => {
        // If the server itself is in maintenance and somehow the settings
        // endpoint was blocked, still activate the maintenance UI.
        if (err?.response?.status === 503 && err?.response?.data?.maintenance) {
          setMaintenanceMode(true);
        }
      })
      .finally(() => setSettingsLoaded(true));
  }, []);

  useEffect(() => {
    // Safety net: if the settings fetch never resolves (network down, etc.)
    // unblock the app after 5 s so the user isn't stuck on LoadingScreen.
    const timeout = setTimeout(() => setSettingsLoaded(true), 5000);
    refreshSettings().finally(() => clearTimeout(timeout));
  }, [refreshSettings]);


  const setLang = useCallback((l) => {
    localStorage.setItem('lang', l);
    setLangState(l);
  }, []);

  const t = useCallback((key, vars = {}) => {
    let str = translations[lang]?.[key] ?? translations.en?.[key] ?? key;
    Object.entries(vars).forEach(([k, v]) => {
      str = str.replace(`{${k}}`, String(v));
    });
    return str;
  }, [lang]);

  return (
    <LangContext.Provider value={{ lang, setLang, t, minWithdrawal, startupMessage, maintenanceMode, settingsLoaded, refreshSettings }}>
      {children}
    </LangContext.Provider>
  );
}

export function useLang() {
  const ctx = useContext(LangContext);
  if (!ctx) throw new Error('useLang must be used within LangProvider');
  return ctx;
}
