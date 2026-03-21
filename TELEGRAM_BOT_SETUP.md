# CryptoArb Bot Telegram 🤖

Execute seu monitor de arbitragem 24/7 via Telegram, sem precisar deixar nenhuma aba web aberta!

## Setup do Bot Telegram

### 1. Criar Bot no Telegram

1. Abra o Telegram e busque por `@BotFather`
2. Envie `/newbot`
3. Siga as instruções:
   - Nome: `CryptoArb Monitor` (ou qualquer nome)
   - Username: `cryptoarb_bot` (usar um nome único)
4. **Copie o TOKEN** fornecido (ex: `123456789:ABCDEFGHijklmno...`)

### 2. Configurar Webhook no Vercel

1. Vá para o painel do Vercel
2. Abra seu projeto `arbitTG`
3. Vá em **Settings → Environment Variables**
4. Adicione:
   ```
   TELEGRAM_BOT_TOKEN = seu_token_aqui
   ```

5. Aguarde o redeploy (deve fazer automaticamente)

6. Depois, execute no terminal (uma única vez):
   ```bash
   curl "https://api.telegram.org/bot<SEU_TOKEN>/setWebhook?url=https://<sua-url>.vercel.app/api/telegram-bot"
   ```

   Exemplo real:
   ```bash
   curl "https://api.telegram.org/bot123456789:ABCDEFGHijklmno/setWebhook?url=https://arbitTG.vercel.app/api/telegram-bot"
   ```

### 3. Comandos Disponíveis

Abra uma conversa com seu bot e use:

```
/start      - Iniciar bot e ver comandos
/monitor    - Começar a monitorar e enviar alertas
/stop       - Parar monitoramento
/status     - Ver status atual
/alerts     - Ver últimos alertas
```

## Como Funciona

```
┌─────────────────────────────────────────┐
│         Telegram Bot                     │
│                                         │
│  /monitor  →  Bot no Vercel            │
│  /stop     →  Processa comandos        │
│  /status   →  Monitora preços (24/7)   │
│             →  Envia alertas           │
└─────────────────────────────────────────┘

Fluxo:
1. Você envia /monitor no Telegram
2. Bot ativa monitoramento
3. A cada 10 segundos, Vercel busca preços de todas as exchanges
4. Se encontrar spread > threshold, envia alerta no Telegram
5. Você pode parar com /stop a qualquer hora
```

## Monitoramento em Background (24/7)

O sistema roda continuamente no Vercel usando:

- **Cron Jobs do Vercel** (quando disponível)
- Ou **Polling amigável** (verifica a cada 30s se monitor está ativo)

### Ativando Cron Job

Edite `vercel.json`:

```json
{
  "crons": [
    {
      "path": "/api/monitor-prices",
      "schedule": "*/1 * * * *"
    }
  ]
}
```

Isso fará a requisição a cada 1 minuto.

## Dados Persistentes

⚠️ **Importante:** Por padrão, os dados são armazenados em memória Vercel.

Para dados persistentes, configure um banco de dados grátis:

### Opção 1: Supabase (PostgreSQL grátis)
```bash
npm install @supabase/supabase-js
```

### Opção 2: MongoDB Atlas (grátis)
```bash
npm install mongodb
```

### Opção 3: Firebase (grátis)
```bash
npm install firebase-admin
```

## Exemplo de Uso

### Cenário: Você quer monitorar SOL/USDT entre MEXC e Mercado Bitcoin

1. **Abra Telegram** → Busque seu bot
2. **Digite** `/monitor`
3. **Resposta:** "🚀 Monitor iniciado! Você receberá alertas..."
4. **Aguarde** - Pode fechar o app, o Telegram, qualquer coisa
5. **Quando encontrar spread**, você recebe notificação:
   ```
   🚀 OPORTUNIDADE DE ARBITRAGEM
   
   💱 Par: SOL/USDT
   📈 Spread: 2.345%
   💵 Lucro Estimado: $23.45
   
   📥 Comprar em MEXC: $180.00
   📤 Vender em Mercado Bitcoin: $184.22
   ```

6. **Para parar:** `/stop`

## Troubleshooting

### "Bot não responde"
- [ ] Verifique se o TOKEN está correto em `TELEGRAM_BOT_TOKEN`
- [ ] Execute o comando `setWebhook` novamente
- [ ] Teste com `/start` no Telegram

### "Não recebo alertas"
- [ ] Execute `/monitor` (verifique resposta)
- [ ] Use `/status` para confirmar que está "rodando"
- [ ] Verifique se há oportunidades com `/alerts`

### "Webhook não funciona"
```bash
# Teste pessoalmente
curl "https://api.telegram.org/bot<TOKEN>/getWebhookInfo"
```

Se retornar erro, tente:
```bash
curl "https://api.telegram.org/bot<TOKEN>/deleteWebhook"
# Aguarde 30s
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://<url>.vercel.app/api/telegram-bot"
```

## Privacidade & Segurança

- ✅ Bot é privado (só você pode usar)
- ✅ Token salvo em variável de ambiente (não exposto)
- ✅ Dados do Telegram não são salvos (exceto se configurar banco)
- ⚠️ Preços das exchanges são públicos

## Próximos Passos

- [ ] Configurar banco de dados para dados persistentes
- [ ] Adicionar mais exchanges
- [ ] Integrar auto-trading (experimental)
- [ ] Dashboard de estatísticas
- [ ] Múltiplos usuários com configurações individuais

---

**Suporte:** Abra uma issue no GitHub se tiver dúvidas! 🚀
