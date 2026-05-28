const axios = require('axios');
const logger = require('../utils/logger');

const BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

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

module.exports = { sendMessage, notifyNumberDeleted };
