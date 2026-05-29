const axios = require('axios');
const logger = require('../utils/logger');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

function isEnabled(value) {
  return String(value || '').toLowerCase() === 'true';
}

async function sendMessage(chatId, text) {
  if (!BOT_TOKEN || !chatId) return;
  try {
    await axios.post(`${TG_API}/sendMessage`, {
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }, { timeout: 8000 });
  } catch (err) {
    logger.warn('Telegram notification failed', { chatId, error: err.message });
  }
}

async function notifyNumberDeleted({ telegramId, username, firstName, phone, reason }) {
  const name = username ? `@${username}` : (firstName || 'User');
  const text =
    `🗑 <b>Number Deleted</b>\n\n` +
    `👤 ${name}\n` +
    `📱 <code>${phone}</code>\n` +
    `📌 Reason: ${reason}`;
  await sendMessage(telegramId, text);
}

async function deleteWebhook() {
  if (!BOT_TOKEN) return null;
  const response = await axios.post(`${TG_API}/deleteWebhook`, {
    drop_pending_updates: true,
  }, { timeout: 8000 });
  return response.data;
}

async function setWebhook(url) {
  if (!BOT_TOKEN || !url) return null;
  const response = await axios.post(`${TG_API}/setWebhook`, { url }, { timeout: 8000 });
  return response.data;
}

async function getWebhookInfo() {
  if (!BOT_TOKEN) return null;
  const response = await axios.get(`${TG_API}/getWebhookInfo`, { timeout: 8000 });
  return response.data;
}

async function ensureTelegramWebhook() {
  const auto = isEnabled(process.env.TELEGRAM_AUTO_WEBHOOK);
  const webhookUrl = process.env.TELEGRAM_WEBHOOK_URL;

  if (!auto) {
    return { enabled: false };
  }

  if (!BOT_TOKEN || !webhookUrl) {
    logger.warn('Telegram webhook auto-setup skipped (missing token or URL)');
    return { enabled: true, ok: false };
  }

  try {
    await deleteWebhook();
    const setResult = await setWebhook(webhookUrl);
    const info = await getWebhookInfo();
    const isMatching = info?.result?.url === webhookUrl;

    logger.info('Telegram webhook configured', {
      ok: setResult?.ok,
      url: info?.result?.url,
      pendingUpdates: info?.result?.pending_update_count,
      matches: isMatching,
    });

    return { enabled: true, ok: Boolean(setResult?.ok), matches: isMatching };
  } catch (err) {
    logger.warn('Telegram webhook auto-setup failed', { error: err.message });
    return { enabled: true, ok: false };
  }
}

module.exports = {
  sendMessage,
  notifyNumberDeleted,
  ensureTelegramWebhook,
  deleteWebhook,
  setWebhook,
  getWebhookInfo,
};
