import axios from 'axios';

export default async function handler(req, res) {
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

    if (!token || !chat_id || !message) {
      return res.status(400).json({ error: 'Missing required fields: token, chat_id, message' });
    }

    const url = `https://api.telegram.org/bot${token}/sendMessage`;
    
    const response = await axios.post(url, {
      chat_id,
      text: message,
      parse_mode: 'HTML'
    });

    res.status(200).json({ ok: true, result: response.data });
  } catch (error) {
    console.error('Error sending telegram message:', error.message);
    res.status(500).json({ ok: false, error: error.message });
  }
}
