# Crias Chat – Bot Telegram (Webhook + IA)

Projeto em **Next.js 14 (App Router)** que conecta um bot do Telegram via webhook e usa **Vertex AI (Gemini)** como agenda pessoal: anotações de reunião, lembretes, tarefas e salvamento automático no Firestore.

- **Bot:** [t.me/Crias_chat_bot](https://t.me/Crias_chat_bot)
- As mensagens são processadas por IA (Gemini 2.5 Flash) e reuniões completas são salvas automaticamente no Firestore.

## Documentação

| Documento | Descrição |
|-----------|-----------|
| [README.md](README.md) | Este arquivo: visão geral, setup e endpoints. |
| [docs/FRAMEWORK-BOTS.md](docs/FRAMEWORK-BOTS.md) | **Framework dos bots de IA**: quando cada “bot” (prompt) entra, fluxo da conversa e integração com Firestore. |

## Requisitos

- Node.js 18+
- Conta na [Vercel](https://vercel.com) (deploy)
- Projeto no [Firebase](https://console.firebase.google.com) (Firestore)
- Credenciais OAuth2 Google (Vertex AI / Gemini)

## Variáveis de ambiente

No **painel da Vercel** (Settings → Environment Variables) ou em **`.env.local`** para desenvolvimento:

```env
# Telegram
TELEGRAM_BOT_TOKEN=...
BASE_URL=https://seu-app.vercel.app

# Firebase (Firestore)
NEXT_PUBLIC_FIREBASE_API_KEY=...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=...
NEXT_PUBLIC_FIREBASE_PROJECT_ID=...
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=...
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=...
NEXT_PUBLIC_FIREBASE_APP_ID=...
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=...

# Vertex AI (Gemini) – OAuth2 com refresh token
GOOGLE_CLIENT_ID=...
GOOGLE_CLIENT_SECRET=...
GOOGLE_REFRESH_TOKEN=...
```

Use o [.env.example](.env.example) como referência; nunca commite `.env.local`.

## Deploy na Vercel

1. Conecte o repositório em [vercel.com](https://vercel.com) e faça o deploy.
2. Configure todas as variáveis em **Settings → Environment Variables**.
3. Defina `BASE_URL` com a URL do app (ex: `https://crias-chat.vercel.app`).
4. Após o deploy, acesse `https://SEU_APP.vercel.app/api/telegram/setup` para registrar o webhook no Telegram.

## Endpoints

| Endpoint | Método | Descrição |
|----------|--------|-----------|
| `/api/telegram/webhook` | POST | Recebe updates do Telegram; processa com IA e responde (e opcionalmente salva reunião no Firestore). |
| `/api/telegram/setup`   | GET  | Registra a URL do webhook no Telegram (`setWebhook`). |
| `/api/telegram/test`   | POST | Teste local: body `{ "text": "..." }`; retorna `{ ok, reply }` sem enviar ao Telegram. |

## Testar o bot localmente

1. **Servidor:** `npm install` e `npm run dev`.
2. **Interface web:** abra [http://localhost:3000/test-bot](http://localhost:3000/test-bot) para simular conversas (usa o mesmo fluxo de IA que o Telegram, sem enviar mensagens reais).
3. **Webhook em produção:** use um túnel (ex: [ngrok](https://ngrok.com)) para expor `http://localhost:3000`, defina `BASE_URL` com a URL do túnel e acesse `https://SUA_URL/api/telegram/setup`.

## Segurança

- **Nunca** commite `.env.local` (já está no `.gitignore`).
- Na Vercel, use apenas **Environment Variables** do painel; não coloque tokens no código.
