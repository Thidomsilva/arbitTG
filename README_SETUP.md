# CryptoArb — Monitor de Arbitragem 🚀

Dashboard interativo para monitorar oportunidades de arbitragem de criptomoedas entre múltiplas exchanges com alertas via Telegram.

## Recursos ✨

- 📊 Monitora múltiplas exchanges em tempo real
- 💱 Detecção automática de oportunidades de arbitragem
- 🔀 Arbitragem triangular
- 📬 Alertas automáticos via Telegram
- 🎨 Interface dark mode moderna
- 📱 Totalmente responsivo
- ⚡ Sem dependencies no frontend

## Exchanges Suportadas

- Binance
- Coinbase
- Kraken
- OKX
- Bybit
- KuCoin
- MEXC
- Mercado Bitcoin
- Llama Swap (DeFi)
- Picnic (Polygon)

## Setup Local 💻

### Requisitos

- Node.js 16+
- npm ou yarn

### Instalação

```bash
# Clone o repositório
cd arbitTG

# Instale as dependências
npm install

# Rode localmente com Vercel CLI
npm run dev
```

A aplicação estará disponível em http://localhost:3000

## Deploy no Vercel 🌐

### Passo 1: Push para GitHub

```bash
git add .
git commit -m "Initial commit: CryptoArb dashboard"
git push origin main
```

### Passo 2: Conectar ao Vercel

1. Acesse [vercel.com](https://vercel.com)
2. Login com sua conta GitHub
3. Clique em "New Project"
4. Selecione o repositório `arbitTG`
5. Clique em "Deploy"

Pronto! 🎉 Seu dashboard está rodando no Vercel!

## Como Usar 🎯

### 1. Configurar Telegram

1. Abra o [Telegram](https://telegram.me/BotFather) e busque por `@BotFather`
2. Envie `/newbot` e siga as instruções
3. Copie o **Bot Token** gerado
4. Envie qualquer mensagem para seu bot
5. Acesse `https://api.telegram.org/bot<SEU_TOKEN>/getUpdates` e copie o **Chat ID**
6. Cole o Token e Chat ID no dashboard
7. Clique em "Testar Bot" para verificar

### 2. Configurar Exchanges

- Selecione as exchanges que quer monitorar
- Escolha os pares de criptomoedas (BTC/USD, ETH/USD, etc)
- Defina o capital inicial para cálculos de lucro

### 3. Ajustar Parâmetros

| Parâmetro | Descrição | Padrão |
|-----------|-----------|--------|
| **Min. Spread (%)** | Spread mínimo para enviar alerta | 1.0% |
| **Intervalo** | Tempo entre atualizações | 30s |
| **Cooldown** | Tempo mínimo entre alertas da mesma oportunidade | 5min |
| **Capital** | Valor em USD para calcular lucro estimado | $1000 |

### 4. Iniciar Monitor

Clique em **"▶ Iniciar Monitor"** e o dashboard começará a monitorar em tempo real!

## Estrutura do Projeto 📁

```
arbitTG/
├── public/
│   └── index.html          # Dashboard frontend
├── api/
│   ├── sendTelegram.js     # API para enviar mensagens
│   └── fetchPrices.js      # API para buscar preços (futuro)
├── package.json            # Dependências Node
├── vercel.json            # Configuração Vercel
└── README.md              # Este arquivo
```

## APIs Disponíveis 🔌

### POST `/api/sendTelegram`

Envia uma mensagem para o Telegram.

**Request:**
```json
{
  "token": "seu_bot_token",
  "chat_id": "-1001234567890",
  "message": "Sua mensagem em HTML"
}
```

**Response:**
```json
{
  "ok": true,
  "result": {...}
}
```

### GET `/api/fetchPrices?exchange=binance&pair=BTCUSDT`

Busca o preço de um par em uma exchange.

**Response:**
```json
{
  "exchange": "binance",
  "pair": "BTCUSDT",
  "price": "45000.00",
  "timestamp": "2024-03-21T10:30:00Z"
}
```

## Troubleshooting 🔧

### Bot não recebe mensagens

- ✅ Verifique se o Token está correto
- ✅ Verifique se o Chat ID está correto
- ✅ Certifique-se de ter enviado `/start` ao bot uma vez
- ✅ Tente clicar em "Testar Bot"

### Preços não atualizam

- ✅ Verifique a conexão com internet
- ✅ Recarregue a página (F5)
- ✅ Verifique se as exchanges estão no ar
- ✅ Verifique o console do navegador (F12)

### Vercel reclama de timeout

- ✅ Aumentar o limite em `vercel.json`: modificar `maxDuration` para `120`
- ✅ Reduzir o intervalo de update no dashboard

## Notas Importantes ⚠️

1. **Não compartilhe seu Bot Token** - Qualquer um com ele pode enviar mensagens em seu nome
2. **Taxas de exchange não incluídas** - Cálculos são estimativos, verifique taxas reais
3. **Slippage não considerado** - Em traded ao vivo, pode haver diferenças de preço
4. **Dados em tempo real** - Preços são buscados a cada intervalo configurável
5. **Uso de APIs gratuitas** - Algumas exchanges têm rate limits

## Licença 📄

MIT - Sinta-se livre para usar, modificar e distribuir

## Support 💬

Dúvidas? Abra uma issue no GitHub!

---

**Made with ❤️ for crypto arbitrageurs**
