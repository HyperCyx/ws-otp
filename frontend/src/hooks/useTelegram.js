/**
 * useTelegram — wraps window.Telegram.WebApp
 * Provides safe access to Telegram Mini App APIs.
 */
export function useTelegram() {
  const tg = window.Telegram?.WebApp;

  const initData = tg?.initData || '';
  const user = tg?.initDataUnsafe?.user || null;
  const colorScheme = tg?.colorScheme || 'dark';
  const isExpanded = tg?.isExpanded ?? false;

  const close = () => tg?.close();
  const expand = () => tg?.expand();
  const NOTIFY_TYPES = new Set(['success', 'error', 'warning']);
  const haptic = (type = 'light') => {
    try {
      if (NOTIFY_TYPES.has(type)) {
        tg?.HapticFeedback?.notificationOccurred(type);
      } else {
        tg?.HapticFeedback?.impactOccurred(type);
      }
    } catch (_) {}
  };
  const showAlert = (msg, cb) => tg?.showAlert(msg, cb);
  const showConfirm = (msg, cb) => tg?.showConfirm(msg, cb);

  const setMainButton = ({ text, isActive = true, isVisible = true, onClick } = {}) => {
    if (!tg?.MainButton) return;
    tg.MainButton.setText(text);
    tg.MainButton.onClick(onClick);
    if (isActive) tg.MainButton.enable(); else tg.MainButton.disable();
    if (isVisible) tg.MainButton.show(); else tg.MainButton.hide();
  };

  const hideMainButton = () => tg?.MainButton?.hide();

  return {
    tg,
    initData,
    user,
    colorScheme,
    isExpanded,
    close,
    expand,
    haptic,
    showAlert,
    showConfirm,
    setMainButton,
    hideMainButton,
  };
}
