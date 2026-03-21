module.exports = async (req, res) => {
  // CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const hasServerToken = !!process.env.TELEGRAM_BOT_TOKEN;
  const serverChatId = process.env.TELEGRAM_CHAT_ID || '';

  return res.status(200).json({
    ok: true,
    hasServerToken,
    serverChatId,
  });
};
