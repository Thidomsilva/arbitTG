// Webhook do Telegram - Processa mensagens e comandos do bot
// Configure em: https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://seu-url.vercel.app/api/telegram-webhook

const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

// Armazenar estado de monitoramentos ativos (em memória - para produção usar DB)
const activeMonitors = {};
const lastCommandByChat = {};

module.exports = async (req, res) => {
  try {
    if (req.method !== 'POST') {
      return res.status(200).json({ ok: true, message: 'Webhook ativo. Use POST.' });
    }

    const body = normalizeBody(req.body);

    // Responde imediatamente para o Telegram não reentregar update por timeout.
    res.status(200).json({ ok: true });

    void processUpdate(body);
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
    const { message } = body;
    if (!message) return;

    const chatId = message.chat.id;
    const text = (message.text || '').trim();
    lastCommandByChat[chatId] = { command: text, at: new Date().toISOString() };

    if (text === '/start' || text === '/help') {
      await sendMessage(chatId, `
🤖 <b>CryptoArb Monitor</b>

<b>Comandos Disponíveis:</b>
/monitor - Iniciar monitoramento ▶️
/stop - Parar monitoramento ⏹️
/status - Ver status atual 📊
/config - Configurar parâmetros ⚙️

<b>Exemplo de Configuração:</b>
/config min_spread=1.5 capital=5000

<b>Exchanges Suportados:</b>
binance, mexc, mercadobitcoin, kraken, coinbase, okx, kucoin, bybit
`, {
        keyboard: [
          [{ text: '/monitor' }, { text: '/status' }],
          [{ text: '/config' }, { text: '/stop' }],
        ],
        resize_keyboard: true,
        is_persistent: true,
      });
      return;
    }

    if (text === '/monitor') {
      activeMonitors[chatId] = {
        running: true,
        startTime: new Date().toISOString(),
        pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
        exchanges: ['binance', 'mexc', 'mercadobitcoin'],
        minSpread: 1.5,
        capital: 1000,
      };

      await sendMessage(chatId, `
🚀 <b>Monitor Iniciado!</b>

Monitorando:
💱 Pares: ${activeMonitors[chatId].pairs.join(', ')}
🏪 Exchanges: ${activeMonitors[chatId].exchanges.join(', ')}
📈 Min. Spread: ${activeMonitors[chatId].minSpread}%
💵 Capital: $${activeMonitors[chatId].capital}

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
💱 Pares: ${monitor.pairs.join(', ')}
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
      const monitor = activeMonitors[chatId] || {
        pairs: ['BTC/USDT', 'ETH/USDT', 'SOL/USDT'],
        exchanges: ['binance', 'mexc', 'mercadobitcoin'],
        minSpread: 1.5,
        capital: 1000,
        running: false,
      };

      const parts = text.split(' ');
      for (let i = 1; i < parts.length; i++) {
        const [key, value] = parts[i].split('=');
        if (!key || !value) continue;
        if (key === 'min_spread') monitor.minSpread = parseFloat(value);
        if (key === 'capital') monitor.capital = parseFloat(value);
        if (key === 'pairs') monitor.pairs = value.split(',');
        if (key === 'exchanges') monitor.exchanges = value.split(',');
      }

      activeMonitors[chatId] = monitor;

      await sendMessage(chatId, `
⚙️ <b>Configuração Atualizada</b>

📈 Min. Spread: ${monitor.minSpread}%
💵 Capital: $${monitor.capital}
💱 Pares: ${monitor.pairs.join(', ')}
🏪 Exchanges: ${monitor.exchanges.join(', ')}

Use /monitor para iniciar com essas configurações.
`);
      return;
    }

    await sendMessage(chatId, `❓ Comando não reconhecido.\n\nUse /help para ver os comandos disponíveis.`);
  } catch (error) {
    console.error('processUpdate error:', error);
  }
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
