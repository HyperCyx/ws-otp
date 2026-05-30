const express = require('express');
const { sendMessage } = require('../services/telegramBot');

const router = express.Router();

function getChatId(update) {
  return update?.message?.chat?.id || update?.callback_query?.message?.chat?.id || null;
}

function getStartPayload(update) {
  const text = update?.message?.text || '';
  if (!text.startsWith('/start')) return null;
  return text.slice('/start'.length).trim();
}

router.post('/webhook', async (req, res) => {
  const update = req.body || {};
  const chatId = getChatId(update);
  const payload = getStartPayload(update);

  if (chatId && payload !== null) {
    const firstName = update?.message?.from?.first_name || 'there';
    const welcomeText =
      `👋 Привет! ${firstName}!\n\n` +
      'Добро пожаловать в НомерМаркет! Откройте мини-приложение и начните зарабатывать уже сегодня. 💰🚀';
    await sendMessage(chatId, welcomeText);
  }

  res.status(200).json({ ok: true });
});

module.exports = router;
