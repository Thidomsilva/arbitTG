// Monitor 24/7 por backend (independente da aba web)
// Executado por Vercel Cron e pode ser acionado manualmente.

const EMBEDDED_BOT_TOKEN = '8643686608:AAGaAzT1mtcuNhBCDPq0JZomu6jIWM9IWgw';
const EMBEDDED_CHAT_ID = '5214189267';

const lastAlertByKey = {};
const SUPPORTED_EXCHANGES = ['binance', 'mexc', 'mercadobitcoin', 'bybit', 'okx', 'kucoin', 'coinbase', 'kraken'];
const EXCHANGE_FEES = {
  binance: 0.002,
  mexc: 0.002,
  mercadobitcoin: 0.002,
  bybit: 0.002,
  okx: 0.002,
  kucoin: 0.002,
  coinbase: 0.002,
  kraken: 0.002,
};

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

    const mode = parseMode(process.env.MONITOR_MODE, 'both');
    const defaultCoins = ['BTC', 'ETH', 'SOL', 'XRP'];
    const coins = parseCoins(process.env.MONITOR_COINS, defaultCoins);
    const pairs = parsePairs(process.env.MONITOR_PAIRS, coins);
    const exchanges = parseExchanges(process.env.MONITOR_EXCHANGES, ['binance', 'mexc', 'mercadobitcoin']);
    const minSpread = toNum(process.env.MONITOR_MIN_SPREAD, 1.0);
    const capital = toNum(process.env.MONITOR_CAPITAL, 1000);
    const cooldownMs = toNum(process.env.MONITOR_COOLDOWN_MS, 5 * 60 * 1000);
    const maxAlerts = Math.max(1, Math.floor(toNum(process.env.MONITOR_MAX_ALERTS_PER_RUN, 3)));
    const maxTriAlerts = Math.max(1, Math.floor(toNum(process.env.MONITOR_MAX_TRI_ALERTS_PER_RUN, 3)));

    const usdtBrl = await fetchUsdtBrl();
    const priceData = await fetchAllPrices(pairs, exchanges, usdtBrl);
    const crossOpportunities = mode !== 'triangular'
      ? calcArbitrage(priceData, capital)
          .filter(o => o.profitPct >= minSpread)
          .sort((a, b) => b.profitPct - a.profitPct)
          .slice(0, maxAlerts)
      : [];

    const triangularRoutes = mode !== 'cross'
      ? calcTriangularArbitrage(priceData, capital, minSpread)
          .sort((a, b) => b.profitPct - a.profitPct)
          .slice(0, maxTriAlerts)
      : [];

    let sent = 0;
    for (const opp of crossOpportunities) {
      const key = `${opp.pair}_${opp.minEx}_${opp.maxEx}`;
      const last = lastAlertByKey[key] || 0;
      if (Date.now() - last < cooldownMs) continue;

      lastAlertByKey[key] = Date.now();
      const msg = buildAlertMessage(opp, capital);
      const ok = await sendTelegram(token, chatId, msg);
      if (ok) sent++;
    }

    for (const route of triangularRoutes) {
      const key = `tri_${route.route}_${route.leg1.ex}_${route.leg2.ex}_${route.leg3.ex}`;
      const last = lastAlertByKey[key] || 0;
      if (Date.now() - last < cooldownMs) continue;

      lastAlertByKey[key] = Date.now();
      const msg = buildTriangularAlertMessage(route, capital);
      const ok = await sendTelegram(token, chatId, msg);
      if (ok) sent++;
    }

    return res.status(200).json({
      ok: true,
      source: isCron ? 'vercel-cron' : 'manual',
      mode,
      coins,
      exchanges,
      pairsChecked: pairs.length,
      crossCandidates: crossOpportunities.length,
      triangularCandidates: triangularRoutes.length,
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

function parsePairs(rawPairs, coins) {
  if (rawPairs && String(rawPairs).trim()) {
    return parseList(rawPairs, []);
  }

  const out = [];
  for (const coin of coins) {
    if (!coin || coin === 'USDT' || coin === 'BRL') continue;
    out.push(`${coin}/USDT`);
    out.push(`${coin}/BRL`);
  }
  out.push('USDT/BRL');

  return Array.from(new Set(out));
}

function parseCoins(rawCoins, fallback) {
  const list = parseList(rawCoins, fallback)
    .map(v => String(v).trim().toUpperCase())
    .filter(Boolean);

  return Array.from(new Set(list));
}

function parseExchanges(rawExchanges, fallback) {
  const parsed = parseList(rawExchanges, fallback)
    .map(v => String(v).trim().toLowerCase())
    .filter(v => SUPPORTED_EXCHANGES.includes(v));

  return parsed.length ? Array.from(new Set(parsed)) : fallback;
}

function parseMode(rawMode, fallback) {
  const value = String(rawMode || fallback).trim().toLowerCase();
  if (value === 'cross' || value === 'triangular' || value === 'both') return value;
  return fallback;
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
  if (exchange === 'coinbase') return fetchCoinbasePrice(pair);
  if (exchange === 'kraken') return fetchKrakenPrice(pair);
  if (exchange === 'okx') return fetchOkxPrice(pair);
  if (exchange === 'bybit') return fetchBybitPrice(pair);
  if (exchange === 'kucoin') return fetchKucoinPrice(pair);
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

async function fetchCoinbasePrice(pair) {
  const [base, quote] = pair.split('/');
  if (!base || !quote) return null;
  const r = await fetch(`https://api.coinbase.com/v2/prices/${base}-${quote}/spot`);
  const d = await r.json();
  return parseFloat(d?.data?.amount);
}

async function fetchKrakenPrice(pair) {
  const [base, quote] = pair.split('/');
  if (!base || !quote) return null;
  const r = await fetch(`https://api.kraken.com/0/public/Ticker?pair=${base}${quote}`);
  const d = await r.json();
  const key = Object.keys(d?.result || {})[0];
  if (!key) return null;
  return parseFloat(d.result[key].c?.[0]);
}

async function fetchOkxPrice(pair) {
  const [base, quote] = pair.split('/');
  if (!base || !quote) return null;
  const r = await fetch(`https://www.okx.com/api/v5/market/ticker?instId=${base}-${quote}`);
  const d = await r.json();
  return parseFloat(d?.data?.[0]?.last);
}

async function fetchBybitPrice(pair) {
  const symbol = pair.replace('/', '');
  const r = await fetch(`https://api.bybit.com/v5/market/tickers?category=spot&symbol=${symbol}`);
  const d = await r.json();
  return parseFloat(d?.result?.list?.[0]?.lastPrice);
}

async function fetchKucoinPrice(pair) {
  const symbol = pair.replace('/', '-');
  const r = await fetch(`https://api.kucoin.com/api/v1/market/orderbook/level1?symbol=${symbol}`);
  const d = await r.json();
  return parseFloat(d?.data?.price);
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
    const buyFee = EXCHANGE_FEES[minEx] ?? 0.002;
    const sellFee = EXCHANGE_FEES[maxEx] ?? 0.002;
    const effectiveBuyPrice = minP * (1 + buyFee);
    const effectiveSellPrice = maxP * (1 - sellFee);
    const netSpread = ((effectiveSellPrice - effectiveBuyPrice) / effectiveBuyPrice) * 100;
    const afterFees = capital * (effectiveSellPrice / effectiveBuyPrice);
    const profit = afterFees - capital;
    const profitPct = (profit / capital) * 100;

    out.push({ pair, minEx, maxEx, minP, maxP, spread, netSpread, profit, profitPct });
  }

  return out;
}

function calcTriangularArbitrage(priceData, capital, minSpread) {
  const routes = [];
  const tokens = new Set();

  for (const pair of Object.keys(priceData)) {
    const [base, quote] = pair.split('/');
    if (quote === 'USDT' && base && base !== 'USDT' && base !== 'BRL') {
      tokens.add(base);
    }
  }

  const leg1 = findBestLeg(priceData, 'BRL', 'USDT');
  if (!leg1) return routes;

  for (const token of tokens) {
    const leg2 = findBestLeg(priceData, 'USDT', token);
    const leg3 = findBestLeg(priceData, token, 'BRL');
    if (!leg2 || !leg3) continue;

    const finalAmount = capital * leg1.netRate * leg2.netRate * leg3.netRate;
    const profit = finalAmount - capital;
    const profitPct = (profit / capital) * 100;

    if (profitPct < minSpread) continue;

    routes.push({
      route: `BRL->USDT->${token}->BRL`,
      token,
      leg1,
      leg2,
      leg3,
      profit,
      profitPct,
    });
  }

  return routes;
}

function findBestLeg(priceData, fromAsset, toAsset) {
  let best = null;

  for (const [pair, prices] of Object.entries(priceData)) {
    const [base, quote] = pair.split('/');
    if (!base || !quote) continue;

    for (const [ex, rawPrice] of Object.entries(prices || {})) {
      const price = Number(rawPrice);
      if (!Number.isFinite(price) || price <= 0) continue;

      let rate = null;
      if (fromAsset === quote && toAsset === base) {
        rate = 1 / price;
      } else if (fromAsset === base && toAsset === quote) {
        rate = price;
      }

      if (!rate) continue;

      const fee = EXCHANGE_FEES[ex] || 0.002;
      const netRate = rate * (1 - fee);

      if (!best || netRate > best.netRate) {
        best = { pair, ex, price, rate, netRate, fee };
      }
    }
  }

  return best;
}

function buildAlertMessage(opp, capital) {
  const now = new Date().toLocaleTimeString('pt-BR');
  return `🚀 <b>OPORTUNIDADE DE ARBITRAGEM</b>\n\n` +
    `💱 <b>Par:</b> ${opp.pair}\n` +
    `📈 <b>Spread Bruto:</b> ${opp.spread.toFixed(3)}%\n` +
    `📉 <b>Spread Líquido (após taxas):</b> ${opp.profitPct.toFixed(3)}%\n` +
    `💵 <b>Lucro Líquido Estimado:</b> $${opp.profit.toFixed(2)} (capital $${capital})\n\n` +
    `📥 <b>Comprar em ${opp.minEx}:</b> $${opp.minP.toFixed(6)}\n` +
    `📤 <b>Vender em ${opp.maxEx}:</b> $${opp.maxP.toFixed(6)}\n\n` +
    `🛠️ Origem: Backend 24/7\n` +
    `⚡ ${now}`;
}

function buildTriangularAlertMessage(route, capital) {
  const now = new Date().toLocaleTimeString('pt-BR');
  return `🔺 <b>ARBITRAGEM TRIANGULAR</b>\n\n` +
    `🔄 <b>Rota:</b> ${route.route}\n` +
    `📈 <b>Lucro Líq.:</b> ${route.profitPct.toFixed(3)}%\n` +
    `💵 <b>Lucro Estimado:</b> $${route.profit.toFixed(2)} (capital $${capital})\n\n` +
    `1) BRL→USDT: ${route.leg1.pair} em ${route.leg1.ex}\n` +
    `2) USDT→${route.token}: ${route.leg2.pair} em ${route.leg2.ex}\n` +
    `3) ${route.token}→BRL: ${route.leg3.pair} em ${route.leg3.ex}\n\n` +
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
