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

  try {
    const { exchange, pair } = req.query;

    if (!exchange || !pair) {
      return res.status(400).json({ error: 'Missing exchange or pair' });
    }

    let price;
    const usdtBrl = await fetchUsdtBrl();

    // Binance
    if (exchange === 'binance') {
      const response = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
      const data = await response.json();
      price = data.price;
    }
    // Coinbase
    else if (exchange === 'coinbase') {
      const response = await fetch(`https://api.coinbase.com/v2/prices/${pair}/spot`);
      const data = await response.json();
      price = data.data.amount;
    }
    // Kraken
    else if (exchange === 'kraken') {
      const krakenPair = pair.replace('USD', 'Z').replace('USDT', 'ZU');
      const response = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`);
      const data = await response.json();
      const key = Object.keys(data.result)[0];
      price = data.result[key].c[0];
    }
    // OKX
    else if (exchange === 'okx') {
      const okxPair = pair.replace('USDT', '-USDT');
      const response = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${okxPair}`);
      const data = await response.json();
      price = data.data[0].last;
    }
    // Bybit
    else if (exchange === 'bybit') {
      const response = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${pair}`);
      const data = await response.json();
      price = data.result.list[0].lastPrice;
    }
    // Mercado Bitcoin (precos em BRL convertidos quando necessario)
    else if (exchange === 'mercadobitcoin') {
      const [base, quote] = splitPair(pair);
      const response = await fetch(`https://www.mercadobitcoin.net/api/${base}/ticker/`);
      const data = await response.json();
      const priceBrl = parseFloat(data?.ticker?.last);

      if (!priceBrl || priceBrl <= 0) {
        return res.status(502).json({ error: 'No price data from mercadobitcoin' });
      }

      if (quote === 'BRL') price = priceBrl;
      else if (quote === 'USDT') price = priceBrl / usdtBrl;
      else return res.status(400).json({ error: `Unsupported quote for mercadobitcoin: ${quote}` });
    }
    else {
      return res.status(400).json({ error: 'Unsupported exchange' });
    }

    res.status(200).json({ exchange, pair, price, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching price:', error.message);
    res.status(500).json({ error: error.message });
  }
};

function splitPair(pair) {
  if (pair.includes('/')) {
    const [base, quote] = pair.split('/');
    return [base, quote];
  }

  // Fallback para simbolos sem separador (ex: BTCUSDT)
  const quotes = ['USDT', 'USD', 'BRL'];
  for (const q of quotes) {
    if (pair.endsWith(q) && pair.length > q.length) {
      return [pair.slice(0, -q.length), q];
    }
  }

  return [pair, 'USDT'];
}

async function fetchUsdtBrl() {
  try {
    const response = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL');
    const data = await response.json();
    const value = parseFloat(data.price);
    if (value > 0) return value;
  } catch {}

  return 5.7;
}
