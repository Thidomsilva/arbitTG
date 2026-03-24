// Webhook do Telegram - Processa mensagens e comandos do bot
// Configure em: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://seu-url.vercel.app/api/telegram-webhook

const EMBEDDED_BOT_TOKEN = '8643686608:AAGaAzT1mtcuNhBCDPq0JZomu6jIWM9IWgw';
const TOKEN = process.env.TELEGRAM_BOT_TOKEN || EMBEDDED_BOT_TOKEN;

// Armazenar estado de monitoramentos ativos (em memória - para produção usar DB)
const activeMonitors = {};
const lastCommandByChat = {};
let commandsRegistered = false;

const SUPPORTED_EXCHANGES = [
  'binance',
  'mexc',
  'mercadobitcoin',
  'bybit',
  'okx',
  'kucoin',
  'coinbase',
  'kraken',
];

const SUPPORTED_COINS = ['BTC', 'ETH', 'SOL', 'XRP', 'DOGE', 'LTC', 'LINK', 'ADA', 'AVAX', 'DOT'];

const EXCHANGE_LABELS = {
  binance: 'Binance',
  mexc: 'MEXC',
  mercadobitcoin: 'Mercado Bitcoin',
  bybit: 'Bybit',
  okx: 'OKX',
  kucoin: 'KuCoin',
  coinbase: 'Coinbase',
  kraken: 'Kraken',
};

const MODE_LABELS = {
  cross: 'Cross',
  triangular: 'Triangular',
  both: 'Ambos',
};

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(200).json({ ok: true, message: 'Webhook ativo. Use POST.' });
    }

    const body = normalizeBody(req.body);

    if (!commandsRegistered && TOKEN) {
      commandsRegistered = true;
      await ensureBotCommands();
    }

    // Processa o update dentro da requisicao para funcionar de forma confiavel em serverless.
    await processUpdate(body);
    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Webhook error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch {
      return {};
    }
  }
  return body;
}

async function processUpdate(body) {
  try {
    if (body.callback_query) {
      await processCallbackQuery(body.callback_query);
      return;
    }

    const { message } = body;
    if (!message) return;

    const chatId = message.chat.id;
    const rawText = (message.text || '').trim();
    const text = normalizeTelegramCommand(rawText);
    lastCommandByChat[chatId] = { command: rawText, at: new Date().toISOString() };

    if (!activeMonitors[chatId]) {
      activeMonitors[chatId] = defaultMonitorConfig();
    }

    if (text === '/start' || text === '/help') {
      await sendMainMenu(chatId);
      return;
    }

    if (text === '/monitor') {
      const monitor = activeMonitors[chatId] || defaultMonitorConfig();
      monitor.running = true;
      monitor.startTime = new Date().toISOString();
      activeMonitors[chatId] = monitor;

      const monitorPairs = coinsToPairs(monitor.coins);

      await sendMessage(chatId, `
🚀 <b>Monitor Iniciado!</b>

Monitorando:
    🔀 Modo: ${MODE_LABELS[monitor.mode] || monitor.mode}
    🪙 Moedas: ${monitor.coins.join(', ')}
    💱 Pares: ${monitorPairs.join(', ')}
    🏪 Exchanges: ${monitor.exchanges.join(', ')}
    📈 Min. Spread: ${monitor.minSpread}%
    💵 Capital: $${monitor.capital}

Use /stop para parar ou /config para alterar.

ℹ️ Este comando controla o monitor do bot (backend). Não para monitor aberto na aba web.
`);
      return;
    }

    if (text === '/stop') {
      if (!activeMonitors[chatId]) {
        await sendMessage(chatId, '⏹️ Nenhum monitor ativo.');
        return;
      }

      activeMonitors[chatId].running = false;
      await sendMessage(chatId, '⏹️ Monitor do bot parado!\n\nℹ️ Se ainda chegam alertas, provavelmente vêm da aba web aberta com monitor ativo.');
      return;
    }

    if (text === '/status') {
      const monitor = activeMonitors[chatId];

      if (!monitor) {
        await sendMessage(chatId, '📊 Sem monitor ativo. Use /monitor para iniciar.');
        return;
      }

      await sendMessage(chatId, `
📊 <b>Status do Monitor</b>

Estado: ${monitor.running ? '✅ <b>Ativo</b>' : '⏹️ <b>Parado</b>'}
Iniciado: ${monitor.startTime}
🔀 Modo: ${MODE_LABELS[monitor.mode] || monitor.mode}
🪙 Moedas: ${monitor.coins.join(', ')}
💱 Pares: ${coinsToPairs(monitor.coins).join(', ')}
🏪 Exchanges: ${monitor.exchanges.join(', ')}
📈 Min. Spread: ${monitor.minSpread}%
💵 Capital: $${monitor.capital}

<code>Chat ID: ${chatId}</code>
Último comando: <code>${lastCommandByChat[chatId]?.command || '-'}</code>
Em: <code>${lastCommandByChat[chatId]?.at || '-'}</code>

Origem deste status: <b>Bot (backend)</b>
`);
      return;
    }

    if (text.startsWith('/config')) {
      const monitor = activeMonitors[chatId] || defaultMonitorConfig();

      const parts = text.split(' ');
      for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split('=');
        if (!key || !value) continue;
        if (key === 'min_spread') monitor.minSpread = parseFloat(value);
        if (key === 'capital') monitor.capital = parseFloat(value);
        if (key === 'mode' && MODE_LABELS[value]) monitor.mode = value;
        if (key === 'coins') {
          const coins = value
            .split(',')
            .map(v => v.trim().toUpperCase())
            .filter(v => SUPPORTED_COINS.includes(v));
          if (coins.length) monitor.coins = Array.from(new Set(coins));
        }
        if (key === 'pairs') {
          const pairs = value
            .split(',')
            .map(v => v.trim().toUpperCase())
            .filter(Boolean)
            .map(v => v.includes('/') ? v : `${v}/USDT`)
            .map(v => v.split('/')[0])
            .filter(v => SUPPORTED_COINS.includes(v));
          if (pairs.length) monitor.coins = Array.from(new Set(pairs));
        }
        if (key === 'exchanges') {
          const exs = value
            .split(',')
            .map(v => v.trim().toLowerCase())
            .filter(v => SUPPORTED_EXCHANGES.includes(v));
          if (exs.length >= 2) monitor.exchanges = Array.from(new Set(exs));
        }
      }

      activeMonitors[chatId] = monitor;

      await sendConfigPanel(chatId);
      return;
    }

    await sendMessage(chatId, `❓ Comando não reconhecido.\n\nUse /help para ver os comandos disponíveis.`);
  } catch (error) {
    console.error('processUpdate error:', error);
  }
}

function defaultMonitorConfig() {
  return {
    running: false,
    startTime: '-',
    mode: 'both',
    coins: ['BTC', 'ETH', 'SOL', 'XRP'],
    exchanges: ['binance', 'mexc', 'mercadobitcoin', 'bybit'],
    minSpread: 1.5,
    capital: 1000,
  };
}

function coinsToPairs(coins) {
  const out = [];
  for (const coin of coins || []) {
    if (!coin || coin === 'USDT' || coin === 'BRL') continue;
    out.push(`${coin}/USDT`);
    out.push(`${coin}/BRL`);
  }
  out.push('USDT/BRL');
  return Array.from(new Set(out));
}

async function processCallbackQuery(callbackQuery) {
  const data = callbackQuery.data || '';
  const callbackId = callbackQuery.id;
  const message = callbackQuery.message;
  const chatId = message?.chat?.id;

  if (!chatId) {
    await answerCallbackQuery(callbackId, 'Chat inválido');
    return;
  }

  if (!activeMonitors[chatId]) {
    activeMonitors[chatId] = defaultMonitorConfig();
  }

  const monitor = activeMonitors[chatId];

  if (data === 'act:monitor') {
    monitor.running = true;
    monitor.startTime = new Date().toISOString();
    await sendMessage(chatId, '▶️ Monitor iniciado pelo botão. Use /status para ver detalhes.');
    await answerCallbackQuery(callbackId, 'Monitor iniciado');
    return;
  }

  if (data === 'act:stop') {
    monitor.running = false;
    await sendMessage(chatId, '⏹️ Monitor parado pelo botão.');
    await answerCallbackQuery(callbackId, 'Monitor parado');
    return;
  }

  if (data === 'act:status') {
    await sendStatus(chatId);
    await answerCallbackQuery(callbackId, 'Status enviado');
    return;
  }

  if (data === 'act:help') {
    await sendMainMenu(chatId);
    await answerCallbackQuery(callbackId, 'Menu atualizado');
    return;
  }

  if (data === 'act:config') {
    await sendConfigPanel(chatId, message?.message_id);
    await answerCallbackQuery(callbackId, 'Painel de config aberto');
    return;
  }

  if (data.startsWith('mode:')) {
    const mode = data.split(':')[1];
    if (MODE_LABELS[mode]) {
      monitor.mode = mode;
      await sendConfigPanel(chatId, message?.message_id);
      await answerCallbackQuery(callbackId, `Modo: ${MODE_LABELS[mode]}`);
      return;
    }
  }

  if (data.startsWith('ex:')) {
    const ex = data.split(':')[1];
    if (SUPPORTED_EXCHANGES.includes(ex)) {
      toggleSetValue(monitor.exchanges, ex, 2);
      await sendConfigPanel(chatId, message?.message_id);
      await answerCallbackQuery(callbackId, `${EXCHANGE_LABELS[ex] || ex} atualizado`);
      return;
    }
  }

  if (data.startsWith('coin:')) {
    const coin = data.split(':')[1];
    if (SUPPORTED_COINS.includes(coin)) {
      toggleSetValue(monitor.coins, coin, 1);
      await sendConfigPanel(chatId, message?.message_id);
      await answerCallbackQuery(callbackId, `Moedas atualizadas`);
      return;
    }
  }

  await answerCallbackQuery(callbackId, 'Ação não reconhecida');
}

function toggleSetValue(list, value, minCount) {
  const idx = list.indexOf(value);
  if (idx >= 0) {
    if (list.length > minCount) {
      list.splice(idx, 1);
    }
    return;
  }

  list.push(value);
}

async function sendMainMenu(chatId) {
  await sendMessage(chatId, `
🤖 <b>CryptoArb Monitor</b>

<b>Comandos Disponíveis:</b>
/monitor - Iniciar monitoramento ▶️
/stop - Parar monitoramento ⏹️
/status - Ver status atual 📊
/config - Configurar estratégia ⚙️

<b>Configuração rápida:</b>
/config mode=both coins=BTC,ETH,SOL exchanges=binance,mexc,bybit

<b>Modos:</b>
cross (arbitragem entre corretoras)
triangular (A→B→C→A)
both (ambos)
`, {
    inline_keyboard: [
      [{ text: '▶️ Iniciar', callback_data: 'act:monitor' }, { text: '📊 Status', callback_data: 'act:status' }],
      [{ text: '⚙️ Configurar', callback_data: 'act:config' }, { text: '⏹️ Parar', callback_data: 'act:stop' }],
      [{ text: '❓ Ajuda', callback_data: 'act:help' }],
    ],
  });
}

async function sendStatus(chatId) {
  const monitor = activeMonitors[chatId] || defaultMonitorConfig();
  await sendMessage(chatId, `
📊 <b>Status do Monitor</b>

Estado: ${monitor.running ? '✅ <b>Ativo</b>' : '⏹️ <b>Parado</b>'}
Iniciado: ${monitor.startTime}
🔀 Modo: ${MODE_LABELS[monitor.mode] || monitor.mode}
🪙 Moedas: ${monitor.coins.join(', ')}
💱 Pares: ${coinsToPairs(monitor.coins).join(', ')}
🏪 Exchanges: ${monitor.exchanges.join(', ')}
📈 Min. Spread: ${monitor.minSpread}%
💵 Capital: $${monitor.capital}

<code>Chat ID: ${chatId}</code>
Último comando: <code>${lastCommandByChat[chatId]?.command || '-'}</code>
Em: <code>${lastCommandByChat[chatId]?.at || '-'}</code>

Origem deste status: <b>Bot (backend)</b>
`);
}

async function sendConfigPanel(chatId, messageId) {
  const monitor = activeMonitors[chatId] || defaultMonitorConfig();

  const text = `⚙️ <b>Configuração Atual</b>

🔀 Modo: <b>${MODE_LABELS[monitor.mode] || monitor.mode}</b>
🪙 Moedas: <b>${monitor.coins.join(', ')}</b>
🏪 Exchanges: <b>${monitor.exchanges.join(', ')}</b>
💱 Pares derivados: <code>${coinsToPairs(monitor.coins).join(', ')}</code>
📈 Min. Spread: <b>${monitor.minSpread}%</b>
💵 Capital: <b>$${monitor.capital}</b>

Use os botões para ajustar.`;

  const markup = {
    inline_keyboard: [
      [
        { text: `${monitor.mode === 'cross' ? '✅' : '▫️'} Cross`, callback_data: 'mode:cross' },
        { text: `${monitor.mode === 'triangular' ? '✅' : '▫️'} Triangular`, callback_data: 'mode:triangular' },
        { text: `${monitor.mode === 'both' ? '✅' : '▫️'} Ambos`, callback_data: 'mode:both' },
      ],
      [
        mkExchangeBtn(monitor, 'binance'),
        mkExchangeBtn(monitor, 'mexc'),
        mkExchangeBtn(monitor, 'mercadobitcoin'),
      ],
      [
        mkExchangeBtn(monitor, 'bybit'),
        mkExchangeBtn(monitor, 'okx'),
        mkExchangeBtn(monitor, 'kucoin'),
      ],
      [
        mkCoinBtn(monitor, 'BTC'),
        mkCoinBtn(monitor, 'ETH'),
        mkCoinBtn(monitor, 'SOL'),
        mkCoinBtn(monitor, 'XRP'),
      ],
      [
        mkCoinBtn(monitor, 'DOGE'),
        mkCoinBtn(monitor, 'LTC'),
        mkCoinBtn(monitor, 'LINK'),
        mkCoinBtn(monitor, 'ADA'),
      ],
      [
        { text: '▶️ Iniciar', callback_data: 'act:monitor' },
        { text: '📊 Status', callback_data: 'act:status' },
      ],
    ],
  };

  if (messageId) {
    await editMessage(chatId, messageId, text, markup);
    return;
  }

  await sendMessage(chatId, text, markup);
}

function mkExchangeBtn(monitor, ex) {
  const on = monitor.exchanges.includes(ex);
  return {
    text: `${on ? '✅' : '▫️'} ${EXCHANGE_LABELS[ex] || ex}`,
    callback_data: `ex:${ex}`,
  };
}

function mkCoinBtn(monitor, coin) {
  const on = monitor.coins.includes(coin);
  return {
    text: `${on ? '✅' : '▫️'} ${coin}`,
    callback_data: `coin:${coin}`,
  };
}

function normalizeTelegramCommand(text) {
  if (!text || text[0] !== '/') return text;

  const firstToken = text.split(' ')[0];
  const command = firstToken.split('@')[0];
  const args = text.slice(firstToken.length).trim();

  return args ? `${command} ${args}` : command;
}

async function sendMessage(chatId, text, replyMarkup) {
  try {
    if (!TOKEN) {
      console.error('TELEGRAM_BOT_TOKEN não configurado no ambiente');
      return { ok: false, error: 'missing_token' };
    }

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.json();
  } catch (error) {
    console.error('Error sending message:', error);
    return { ok: false, error: String(error?.message || error) };
  }
}

async function editMessage(chatId, messageId, text, replyMarkup) {
  try {
    if (!TOKEN) return;

    await fetch(`https://api.telegram.org/bot${TOKEN}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id: chatId,
        message_id: messageId,
        text,
        parse_mode: 'HTML',
        reply_markup: replyMarkup,
      }),
    });
  } catch (error) {
    console.error('Error editing message:', error);
  }
}

async function answerCallbackQuery(callbackQueryId, text) {
  try {
    if (!TOKEN || !callbackQueryId) return;

    await fetch(`https://api.telegram.org/bot${TOKEN}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        callback_query_id: callbackQueryId,
        text,
        show_alert: false,
      }),
    });
  } catch (error) {
    console.error('Error answering callback query:', error);
  }
}

async function ensureBotCommands() {
  try {
    const response = await fetch(`https://api.telegram.org/bot${TOKEN}/setMyCommands`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        commands: [
          { command: 'start', description: 'Iniciar e abrir menu' },
          { command: 'monitor', description: 'Iniciar monitoramento' },
          { command: 'stop', description: 'Parar monitoramento' },
          { command: 'status', description: 'Ver status atual' },
          { command: 'config', description: 'Configurar parametros' },
          { command: 'help', description: 'Ajuda e comandos' },
        ],
      }),
    });

    const data = await response.json();
    if (!data.ok) {
      console.error('setMyCommands falhou:', data);
    }
  } catch (error) {
    console.error('Erro ao registrar comandos:', error);
  }
}

// Exportar monitores ativos para usar em outros endpoints
module.exports.getActiveMonitors = () => activeMonitors;
