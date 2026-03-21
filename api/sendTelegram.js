module.exports = async (req, res) => {
  // Habilitar CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,PATCH,DELETE,POST,PUT');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token, chat_id, message } = req.body;
    const effectiveToken = (token || '').trim() || process.env.TELEGRAM_BOT_TOKEN;
    const effectiveChatId = String(chat_id || '').trim() || process.env.TELEGRAM_CHAT_ID;

    if (!effectiveToken || !effectiveChatId || !message) {
      return res.status(400).json({ ok: false, error: 'Missing required fields' });
    }

    const url = `https://api.telegram.org/bot${effectiveToken}/sendMessage`;
    
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: effectiveChatId,
        text: message,
        parse_mode: 'HTML'
      })
    });

    const data = await response.json();

    if (data.ok) {
      res.status(200).json({ ok: true, result: data });
    } else {
      res.status(200).json({ ok: false, error: data.description || 'Telegram error' });
    }
  } catch (error) {
    console.error('Error:', error.message);
    res.status(200).json({ ok: false, error: error.message });
  }
};
