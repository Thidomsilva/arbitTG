const TOKEN = process.env.TELEGRAM_BOT_TOKEN;

module.exports = async (req, res) => {
  try {
    const { message } = req.body;

    if (!message) {
      return res.status(200).json({ ok: true });
    }

    const chatId = message.chat.id;
    const text = message.text?.trim();
    const userId = message.from?.id;

    // Comandos disponíveis
    if (text === '/start') {
      await sendTelegramMessage(chatId, `
🤖 <b>CryptoArb Bot iniciado!</b>

Comandos disponíveis:
/status - Ver status do monitor
/monitor - Iniciar monitoramento
/stop - Parar monitoramento
/config - Configurar exchanges e pares
/alerts - Ver últimos alertas
`);
    } else if (text === '/status') {
      const status = await getMonitorStatus(chatId);
      await sendTelegramMessage(chatId, `
📊 <b>Status do Monitor</b>

Estado: ${status.running ? '✅ Rodando' : '⏹️ Parado'}
Capital: $${status.capital || 1000}
Min. Spread: ${status.minSpread || 1}%
Alertas enviados: ${status.alertsSent || 0}

ID da conversa: <code>${chatId}</code>
`);
    } else if (text === '/monitor') {
      await setMonitorStatus(chatId, { running: true });
      await sendTelegramMessage(chatId, '🚀 Monitor iniciado! Você receberá alertas quando encontrar oportunidades.');
    } else if (text === '/stop') {
      await setMonitorStatus(chatId, { running: false });
      await sendTelegramMessage(chatId, '⏹️ Monitor parado.');
    } else if (text === '/alerts') {
      const alerts = await getRecentAlerts(chatId);
      if (alerts.length === 0) {
        await sendTelegramMessage(chatId, 'Sem alertas ainda.');
      } else {
        const alertText = alerts.slice(0, 5).map(a => 
          `🚨 <b>${a.pair}</b> - Spread: ${a.spread.toFixed(3)}%\n${a.time}`
        ).join('\n\n');
        await sendTelegramMessage(chatId, `<b>Últimos Alertas:</b>\n\n${alertText}`);
      }
    } else {
      await sendTelegramMessage(chatId, `
❓ Comando não reconhecido.

Use /start para ver os comandos disponíveis.
`);
    }

    res.status(200).json({ ok: true });
  } catch (error) {
    console.error('Telegram error:', error);
    res.status(500).json({ ok: false, error: error.message });
  }
};

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

// Armazenar status em memória (para produção, usar banco de dados)
const monitorsStatus = {};

async function setMonitorStatus(chatId, status) {
  monitorsStatus[chatId] = {
    ...monitorsStatus[chatId],
    ...status,
    lastUpdate: new Date().toISOString()
  };
}

async function getMonitorStatus(chatId) {
  return monitorsStatus[chatId] || {
    running: false,
    capital: 1000,
    minSpread: 1,
    alertsSent: 0
  };
}

async function getRecentAlerts(chatId) {
  // TODO: Implementar com banco de dados
  return [];
}
