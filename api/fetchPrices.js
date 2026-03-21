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

  try {
    const { exchange, pair } = req.query;

    if (!exchange || !pair) {
      return res.status(400).json({ error: 'Missing exchange or pair' });
    }

    let price;

    // Binance
    if (exchange === 'binance') {
      const response = await axios.get(`https://api.binance.com/api/v3/ticker/price?symbol=${pair}`);
      price = response.data.price;
    }
    // Coinbase
    else if (exchange === 'coinbase') {
      const response = await axios.get(`https://api.coinbase.com/v2/prices/${pair}/spot`);
      price = response.data.data.amount;
    }
    // Kraken (requer tratamento especial)
    else if (exchange === 'kraken') {
      const krakenPair = pair.replace('USD', 'Z').replace('USDT', 'ZU');
      const response = await axios.get(`https://api.kraken.com/0/public/Ticker?pair=${krakenPair}`);
      const key = Object.keys(response.data.result)[0];
      price = response.data.result[key].c[0];
    }
    // OKX
    else if (exchange === 'okx') {
      const okxPair = pair.replace('USDT', '-USDT');
      const response = await axios.get(`https://www.okx.com/api/v5/market/ticker?instId=${okxPair}`);
      price = response.data.data[0].last;
    }
    // Bybit
    else if (exchange === 'bybit') {
      const response = await axios.get(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${pair}`);
      price = response.data.result.list[0].lastPrice;
    }
    else {
      return res.status(400).json({ error: 'Unsupported exchange' });
    }

    res.status(200).json({ exchange, pair, price, timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Error fetching price:', error.message);
    res.status(500).json({ error: error.message });
  }
}
