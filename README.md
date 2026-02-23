# Crias Chat – Bot Telegram (Webhook)

Projeto mínimo em Next.js 14 (App Router) para conectar um bot do Telegram via webhook.

- **Bot:** [t.me/Crias_chat_bot](https://t.me/Crias_chat_bot)
- Recebe mensagens enviadas ao bot e responde com: *"Bot conectado com sucesso"*.

## Requisitos

- Node.js 18+
- Conta na [Vercel](https://vercel.com)

## Passo 1: Variáveis de ambiente

1. No **painel da Vercel** (após conectar o repositório):
   - Abra o projeto → **Settings** → **Environment Variables**
   - Adicione:
     - `TELEGRAM_BOT_TOKEN` = `8687806337:AAH8zSsJVDCCMQIapQDdNnLR5bGRenY2Gfc`
     - `BASE_URL` = a URL do seu app na Vercel (ex: `https://crias-chat.vercel.app`)

2. Para **desenvolvimento local**, crie `.env.local` na raiz (ou use o que já existe) com:
   ```env
   TELEGRAM_BOT_TOKEN=8687806337:AAH8zSsJVDCCMQIapQDdNnLR5bGRenY2Gfc
   BASE_URL=http://localhost:3000
   ```

## Passo 2: Deploy na Vercel

1. Acesse [vercel.com](https://vercel.com) e faça login.
2. **Add New** → **Project** e importe o repositório deste projeto (ou faça upload).
3. Confirme o framework **Next.js** e faça o deploy.
4. Após o deploy, anote a URL (ex: `https://crias-chat.vercel.app`).
5. Se ainda não definiu `BASE_URL`, volte em **Settings** → **Environment Variables** e defina:
   - `BASE_URL` = `https://SEU_APP.vercel.app` (a URL do deploy).
6. Faça um novo deploy (Redeploy) para aplicar as variáveis.

## Passo 3: Configurar o webhook

No navegador, acesse:

```
https://SEU_APP.vercel.app/api/telegram/setup
```

Exemplo: `https://crias-chat.vercel.app/api/telegram/setup`

Se tudo estiver certo, a resposta será algo como:

```json
{ "ok": true, "result": true, "description": "Webhook was set" }
```

A partir daí, ao enviar qualquer mensagem para [@Crias_chat_bot](https://t.me/Crias_chat_bot), o bot deve responder com *"Bot conectado com sucesso"*.

## Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/telegram/webhook` | POST | Recebe updates do Telegram e envia a resposta automática. |
| `/api/telegram/setup`   | GET  | Registra a URL do webhook no Telegram (`setWebhook`). |

## Desenvolvimento local

```bash
npm install
npm run dev
```

Em outro terminal (ou após o deploy), use um túnel (ex: [ngrok](https://ngrok.com)) para expor `http://localhost:3000` e defina `BASE_URL` com a URL do túnel. Depois acesse `https://SUA_URL_TUNEL/api/telegram/setup` para configurar o webhook em ambiente local.

## Segurança

- **Nunca** commite o arquivo `.env.local` (ele já está no `.gitignore`).
- Na Vercel, use apenas **Environment Variables** do painel; não coloque o token no código.
