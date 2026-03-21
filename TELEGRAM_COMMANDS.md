# Controlar Monitor via Telegram 🤖

Seu bot Telegram agora tem comandos para você controlar o monitor **diretamente pelo Telegram**!

## Primeiros Passos

### 1. Configure o Webhook (uma única vez)

Substitua `SEU_TOKEN` e `SUA_URL`:

```bash
curl "https://api.telegram.org/botSEU_TOKEN/setWebhook?url=https://SUA_URL.vercel.app/api/telegram-webhook"
```

Exemplo:
```bash
curl "https://api.telegram.org/bot123456789:ABCDEFGHijklmno/setWebhook?url=https://arbitTG.vercel.app/api/telegram-webhook"
```

### 2. Use os Comandos no Telegram

Converse com seu bot:

| Comando | O que faz |
|---------|-----------|
| `/start` | Ver todos os comandos |
| `/monitor` | Iniciar monitoramento com config padrão |
| `/stop` | Parar monitoramento |
| `/status` | Ver status atual |
| `/config` | Alterar configurações |

## Exemplos de Uso

### Iniciar Monitor Padrão
```
Você: /monitor
Bot: 🚀 Monitor Iniciado!

Monitorando:
💱 Pares: BTC/USDT, ETH/USDT, SOL/USDT
🏪 Exchanges: binance, mexc, mercadobitcoin
📈 Min. Spread: 1.5%
💵 Capital: $1000
```

### Alterar Configurações
```
Você: /config min_spread=2.0 capital=5000
Bot: ⚙️ Configuração Atualizada

📈 Min. Spread: 2%
💵 Capital: $5000
💱 Pares: BTC/USDT, ETH/USDT, SOL/USDT
🏪 Exchanges: binance, mexc, mercadobitcoin
```

### Ver Status
```
Você: /status
Bot: 📊 Status do Monitor

Estado: ✅ Ativo
...
```

### Parar Monitor
```
Você: /stop
Bot: ⏹️ Monitor parado!
```

## Configurações Disponíveis

```bash
/config min_spread=VALOR        # Spread mínimo em % (padrão: 1.5)
/config capital=VALOR           # Capital em USD (padrão: 1000)
/config pairs=PAR1,PAR2,PAR3   # Pares (padrão: BTC/USDT,ETH/USDT,SOL/USDT)
/config exchanges=EX1,EX2,EX3  # Exchanges (padrão: binance,mexc,mercadobitcoin)
```

### Exemplo Completo:
```
/config min_spread=2.5 capital=10000 pairs=BTC/USDT,ETH/USDT exchanges=binance,mexc,kraken
```

## Fluxo de Funcionamento

```
1. Você envia /monitor no Telegram
   ⬇️
2. Bot ativa monitoramento para seu chat
   ⬇️
3. Sistema verifica preços regularmente
   ⬇️
4. Encontra oportunidades de arbitragem
   ⬇️
5. 🚀 Envia alerta pelo Telegram!

Estado persiste enquanto Vercel estiver rodando
Você pode fechar o app e continuar recebendo alertas
```

## Trocando de Estratégia

Você pode mudar a config em tempo real:

```
/monitor              # Começa com padrão
/status               # Vê o que está rodando
/config min_spread=3  # Aumenta threshold
/status               # Confirma mudança
/stop                 # Quando quiser parar
```

## Alternando Exchanges

Testar com exchanges diferentes:

```
/config exchanges=binance,kraken,okx
/monitor
```

Ou monitorar pares específicos:

```
/config pairs=BTC/USDT,DOGE/USDT,XRP/USDT
/monitor
```

## Troubleshooting

### "Webhook não redireciona"
Verifique se a URL está correta:
```bash
curl "https://api.telegram.org/botSEU_TOKEN/getWebhookInfo"
```

### "Bot não responde"
1. Confirme que `/api/telegram-webhook` está no seu Vercel
2. Tente /start - deve responder com ajuda
3. Check logs do Vercel

### "Alertas não chegam"
1. Use `/status` para confirmar que está rodando
2. Verifique se há oportunidades reais com o spread configurado
3. Aumente `min_spread` para testar

---

**Resumo:** Você controla 100% pelo Telegram! Sem abrir web, sem nada. Só enviar comando. 🚀
