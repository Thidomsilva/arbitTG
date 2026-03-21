// Monitor 24/7 por backend (independente da aba web)
// Executado por Vercel Cron e pode ser acionado manualmente.

const EMBEDDED_BOT_TOKEN = '8643686608:AAGaAzT1mtcuNhBCDPq0JZomu6jIWM9IWgw';
const EMBEDDED_CHAT_ID = '5214189267';

const lastAlertByKey = {};

module.exports = async (req, res) => {
  try {
    const isCron = String(req.headers['x-vercel-cron'] || '') === '1';
    const apiKey = process.env.MONITOR_API_KEY || '';
    const reqKey = String((req.query && req.query.key) || (req.body && req.body.key) || '');

    if (apiKey && !isCron && reqKey !== apiKey) {
      return res.status(401).json({ ok: false, error: 'Unauthorized' });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN || EMBEDDED_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID || EMBEDDED_CHAT_ID;
    if (!token || !chatId) {
      return res.status(200).json({ ok: false, error: 'Telegram não configurado' });
    }

    const pairs = parseList(process.env.MONITOR_PAIRS, ['BTC/USDT', 'ETH/USDT', 'SOL/USDT', 'XRP/USDT']);
    const exchanges = parseList(process.env.MONITOR_EXCHANGES, ['binance', 'mexc', 'mercadobitcoin']);
    const minSpread = toNum(process.env.MONITOR_MIN_SPREAD, 1.0);
    const capital = toNum(process.env.MONITOR_CAPITAL, 1000);
    const cooldownMs = toNum(process.env.MONITOR_COOLDOWN_MS, 5 * 60 * 1000);
    const maxAlerts = Math.max(1, Math.floor(toNum(process.env.MONITOR_MAX_ALERTS_PER_RUN, 3)));

    const usdtBrl = await fetchUsdtBrl();
    const priceData = await fetchAllPrices(pairs, exchanges, usdtBrl);
    const opportunities = calcArbitrage(priceData, capital)
      .filter(o => o.spread >= minSpread)
      .sort((a, b) => b.spread - a.spread)
      .slice(0, maxAlerts);

    let sent = 0;
    for (const opp of opportunities) {
      const key = `${opp.pair}_${opp.minEx}_${opp.maxEx}`;
      const last = lastAlertByKey[key] || 0;
      if (Date.now() - last < cooldownMs) continue;

      lastAlertByKey[key] = Date.now();
      const msg = buildAlertMessage(opp, capital);
      const ok = await sendTelegram(token, chatId, msg);
      if (ok) sent++;
    }

    return res.status(200).json({
      ok: true,
      source: isCron ? 'vercel-cron' : 'manual',
      pairsChecked: pairs.length,
      candidates: opportunities.length,
      alertsSent: sent,
      minSpread,
      capital,
    });
  } catch (error) {
    console.error('Monitor error:', error);
    return res.status(500).json({ ok: false, error: error.message });
  }
};

function parseList(raw, fallback) {
  if (!raw || !String(raw).trim()) return fallback;
  return String(raw)
    .split(',')
    .map(v => v.trim())
    .filter(Boolean);
}

function toNum(raw, fallback) {
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

async function fetchUsdtBrl() {
  try {
    const r = await fetch('https://api.binance.com/api/v3/ticker/price?symbol=USDTBRL');
    const d = await r.json();
    const v = parseFloat(d.price);
    if (v > 0) return v;
  } catch {}

  return 5.5;
}

async function fetchAllPrices(pairs, exchanges, usdtBrl) {
  const results = {};

  for (const pair of pairs) {
    results[pair] = {};
    const tasks = exchanges.map(async ex => {
      try {
        const price = await fetchPrice(ex, pair, usdtBrl);
        if (price && price > 0) results[pair][ex] = price;
      } catch {}
    });
    await Promise.allSettled(tasks);
  }

  return results;
}

async function fetchPrice(exchange, pair, usdtBrl) {
  if (exchange === 'binance') return fetchBinancePrice(pair);
  if (exchange === 'mexc') return fetchMexcPrice(pair);
  if (exchange === 'mercadobitcoin') return fetchMercadoBitcoinPrice(pair, usdtBrl);
  return null;
}

async function fetchBinancePrice(pair) {
  const symbol = pair.replace('/', '');
  const r = await fetch(`https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`);
  const d = await r.json();
  return parseFloat(d.price);
}

async function fetchMexcPrice(pair) {
  const symbol = pair.replace('/', '');
  const r = await fetch(`https://api.mexc.com/api/v3/ticker/price?symbol=${symbol}`);
  const d = await r.json();
  return parseFloat(d.price);
}

async function fetchMercadoBitcoinPrice(pair, usdtBrl) {
  const [base, quote] = pair.split('/');
  const r = await fetch(`https://www.mercadobitcoin.net/api/${base}/ticker/`);
  const d = await r.json();
  const priceBrl = parseFloat((d.ticker || {}).last);
  if (!priceBrl || priceBrl <= 0) return null;

  if (quote === 'BRL') return priceBrl;
  if (quote === 'USDT') return priceBrl / usdtBrl;
  return null;
}

function calcArbitrage(priceData, capital) {
  const out = [];

  for (const [pair, prices] of Object.entries(priceData)) {
    const entries = Object.entries(prices).filter(([, p]) => p && p > 0);
    if (entries.length < 2) continue;

    let minEx = '', maxEx = '';
    let minP = Infinity, maxP = -Infinity;

    for (const [ex, p] of entries) {
      if (p < minP) { minP = p; minEx = ex; }
      if (p > maxP) { maxP = p; maxEx = ex; }
    }

    const spread = ((maxP - minP) / minP) * 100;
    const afterFees = capital * (1 - 0.002) * (maxP / minP) * (1 - 0.002);
    const profit = afterFees - capital;

    out.push({ pair, minEx, maxEx, minP, maxP, spread, profit });
  }

  return out;
}

function buildAlertMessage(opp, capital) {
  const now = new Date().toLocaleTimeString('pt-BR');
  return `🚀 <b>OPORTUNIDADE DE ARBITRAGEM</b>\n\n` +
    `💱 <b>Par:</b> ${opp.pair}\n` +
    `📈 <b>Spread:</b> ${opp.spread.toFixed(3)}%\n` +
    `💵 <b>Lucro Estimado:</b> $${opp.profit.toFixed(2)} (capital $${capital})\n\n` +
    `📥 <b>Comprar em ${opp.minEx}:</b> $${opp.minP.toFixed(6)}\n` +
    `📤 <b>Vender em ${opp.maxEx}:</b> $${opp.maxP.toFixed(6)}\n\n` +
    `🛠️ Origem: Backend 24/7\n` +
    `⚡ ${now}`;
}

async function sendTelegram(token, chatId, text) {
  try {
    const r = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
    const d = await r.json();
    return !!d.ok;
  } catch {
    return false;
  }
}
