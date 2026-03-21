// API para monitorar preços e enviar alertas via Telegram
// Roda periodicamente via Cron Job do Vercel

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

module.exports = async (req, res) => {
  try {
    console.log('Monitor job rodando...');

    // TODO: Buscar chats que têm monitor ativo (de banco de dados)
    // Por enquanto, lista vazia
    const activeChats = await getActiveChats();

    for (const chat of activeChats) {
      try {
        await checkAndAlertOpportunities(chat);
      } catch (error) {
        console.error(`Error for chat ${chat.id}:`, error);
      }
    }

    res.status(200).json({ 
      ok: true,
      message: `Monitorou ${activeChats.length} chats`
    });
  } catch (error) {
    console.error('Monitor error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

async function getActiveChats() {
  // TODO: Implementar com banco de dados
  // Por enquanto, retorna array vazio
  return [];
}

async function checkAndAlertOpportunities(chat) {
  const { id, pairs, exchanges, minSpread, capital } = chat;

  // Buscar preços
  const prices = await fetchAllPrices(pairs || ['BTC/USDT', 'ETH/USDT']);

  // Detectar spreads
  for (const [pair, exPrices] of Object.entries(prices)) {
    const exList = Object.entries(exPrices).filter(([, p]) => p > 0);
    if (exList.length < 2) continue;

    let minPrice = Infinity, maxPrice = 0;
    let minEx = null, maxEx = null;

    for (const [ex, price] of exList) {
      if (price < minPrice) { minPrice = price; minEx = ex; }
      if (price > maxPrice) { maxPrice = price; maxEx = ex; }
    }

    const spread = ((maxPrice - minPrice) / minPrice) * 100;
    
    if (spread >= (minSpread || 1)) {
      const profit = (spread / 100) * (capital || 1000);
      
      const message = `🚀 <b>OPORTUNIDADE DE ARBITRAGEM</b>

💱 <b>Par:</b> ${pair}
📈 <b>Spread:</b> ${spread.toFixed(3)}%
💵 <b>Lucro Estimado:</b> $${profit.toFixed(2)}

📥 <b>Comprar em ${minEx}:</b> $${minPrice.toFixed(2)}
📤 <b>Vender em ${maxEx}:</b> $${maxPrice.toFixed(2)}

⚡ Detectado em ${new Date().toLocaleTimeString('pt-BR')}`;

      await sendTelegramMessage(id, message);

      // Registrar alerta
      await saveAlert(id, { pair, spread, minEx, maxEx, minPrice, maxPrice, profit });
    }
  }
}

async function fetchAllPrices(pairs) {
  const results = {};

  for (const pair of pairs) {
    results[pair] = {};

    const exchanges = ['binance', 'mexc', 'mercadobitcoin'];
    
    for (const ex of exchanges) {
      try {
        const price = await fetchPrice(ex, pair);
        if (price) results[pair][ex] = price;
      } catch (e) {
        console.error(`Error fetching ${ex} ${pair}:`, e.message);
      }
    }
  }

  return results;
}

async function fetchPrice(exchange, pair) {
  const sym = pair.replace('/', '');

  try {
    if (exchange === 'binance') {
      const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${sym}`);
      const d = await r.json();
      return parseFloat(d.price);
    } else if (exchange === 'mexc') {
      const r = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${sym}`);
      const d = await r.json();
      return parseFloat(d.price);
    } else if (exchange === 'mercadobitcoin') {
      const coin = pair.split('/')[0];
      const r = await fetch(`https://www.mercadobitcoin.net/api/${coin}/ticker/`);
      const d = await r.json();
      return parseFloat(d.ticker?.last);
    }
  } catch (e) {
    console.error(`Fetch error for ${exchange}:`, e);
  }
  
  return null;
}

async function sendTelegramMessage(chatId, text) {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML'
      })
    });
    return response.json();
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

async function saveAlert(chatId, alert) {
  // TODO: Implementar com banco de dados
  console.log(`Alert for ${chatId}:`, alert);
}
