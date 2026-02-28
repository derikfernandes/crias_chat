# Framework dos Bots de IA – Crias Chat

Este documento descreve **como está organizado o framework de documentação** do projeto e **quando cada “bot” de IA entra** no fluxo. Todo o processamento de linguagem natural usa **Vertex AI (Gemini 2.5 Flash)** via uma única API (`generateContent`), com **prompts e papéis diferentes** conforme a etapa.

---

## 1. Estado atual da documentação

| Onde | O que |
|------|--------|
| **README.md** | Visão geral do projeto, variáveis de ambiente, endpoints e como rodar/testar. |
| **docs/FRAMEWORK-BOTS.md** | Este arquivo: arquitetura dos bots de IA, fluxo da conversa e quando cada prompt é usado. |
| **.env.example** | Lista de variáveis de ambiente necessárias (sem valores sensíveis). |

Não há outro framework de documentação (ex.: Docusaurus, Storybook). A documentação é em **Markdown** na raiz e em `docs/`.

---

## 2. Visão geral do fluxo

```
Usuário envia mensagem no Telegram
         ↓
   POST /api/telegram/webhook
         ↓
   lib/telegram-bot.ts → getReplyForChat(chatId, userMessage)
         ↓
   ┌─────────────────────────────────────────────────────────────────┐
   │ 1. Contexto de reuniões (Firestore)                              │
   │    → inferMeetingDateFromConversation (Bot de data)               │
   │    → listMeetingsNearDate → bloco "[REUNIÕES NO BANCO]"           │
   │    → findMatchingMeeting → instrução forçada (se houver match)    │
   └─────────────────────────────────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────────────────────────────────┐
   │ 2. Resposta conversacional (Bot de agenda)                        │
   │    → generateContent(systemPrompt + histórico + mensagem)         │
   │    → pushToHistory                                                │
   └─────────────────────────────────────────────────────────────────┘
         ↓
   ┌─────────────────────────────────────────────────────────────────┐
   │ 3. Extração e salvamento (Bot extrator)                           │
   │    → extractMeetingFromHistory (gera JSON da reunião)             │
   │    → createMeeting + addMeetingItem no Firestore (se completa)   │
   └─────────────────────────────────────────────────────────────────┘
         ↓
   Resposta enviada ao usuário (e opcionalmente “Reunião salva...”)
```

Toda a IA roda em **lib/vertex-ai.ts** (Vertex AI) e a orquestração em **lib/telegram-bot.ts**.

---

## 3. Quando cada “bot” de IA entra

Há **três usos** do mesmo modelo (Gemini 2.5 Flash), com **três system prompts** diferentes. Em termos de produto, podemos pensar em três “bots” ou papéis:

### 3.1 Bot de data (inferência de data da reunião)

- **Onde:** `lib/vertex-ai.ts` → `inferMeetingDateFromConversation()`
- **Quando entra:** Sempre que o usuário manda uma mensagem, **antes** de gerar a resposta. Serve para saber **em que data** buscar reuniões no Firestore (para montar o bloco “[REUNIÕES NO BANCO]” e sugerir “não é a reunião X do dia Y?”).
- **Prompt:** `DATE_INFER_SYSTEM` — extrai a **data da reunião** mencionada na conversa (hoje, ontem, 28/02, etc.).
- **Saída:** Uma data no formato `YYYY-MM-DD` ou `null`. Não conversa com o usuário.

### 3.2 Bot de agenda (resposta principal)

- **Onde:** `lib/vertex-ai.ts` → `generateContent()` com `DEFAULT_SYSTEM_PROMPT` (e blocos extras).
- **Quando entra:** Logo após montar o contexto (reuniões próximas + instrução forçada, se houver). É a **única** resposta que o usuário vê no Telegram (ou na tela do `/test-bot`).
- **Prompt:** `DEFAULT_SYSTEM_PROMPT` — “agenda pessoal”: reuniões (assunto, data, itens), lembretes, tarefas, compromissos, perguntas de esclarecimento. Pode receber:
  - `[REUNIÕES NO BANCO (data próxima da reunião que está sendo inputada)]` + texto das reuniões.
  - Instrução obrigatória quando a mensagem do usuário **casa** com uma reunião já salva: “Não está tratando da reunião X, do dia Y? Quer atualizar? O que já temos…”
- **Histórico:** Últimas 20 mensagens do chat (`MAX_CONTEXT_MESSAGES` / `MAX_HISTORY`).
- **Saída:** Texto da resposta do bot (e depois pode ser acrescentado “✅ Reunião salva no banco”).

### 3.3 Bot extrator (extração de reunião para salvar)

- **Onde:** `lib/vertex-ai.ts` → `extractMeetingFromHistory()`
- **Quando entra:** **Depois** de o bot de agenda responder e de o histórico ser atualizado. O telegram-bot chama `trySaveMeetingFromHistory(chatId)`, que por sua vez chama `extractMeetingFromHistory(history)`.
- **Prompt:** `EXTRACTOR_SYSTEM_PROMPT` — analisa o histórico e devolve **um único JSON** com: `hasCompleteMeeting`, `assunto`, `data`, `textoCompleto`, `items`.
- **Condição para salvar:** `hasCompleteMeeting === true` e assunto + data + pelo menos um item. Evita duplicatas (mesmo assunto+data) por chat.
- **Saída:** Estrutura `ExtractedMeeting`; se completa, o telegram-bot chama `createMeeting` e `addMeetingItem` no Firestore. O usuário **não** vê essa etapa; só vê a confirmação “Reunião salva…” anexada à resposta do bot de agenda.

---

## 4. Resumo em tabela

| Bot / Papel        | Função principal                         | Quando entra                    | Arquivo / função                          |
|--------------------|------------------------------------------|---------------------------------|-------------------------------------------|
| **Bot de data**    | Inferir data da reunião (YYYY-MM-DD)     | Antes da resposta               | `vertex-ai.ts` → `inferMeetingDateFromConversation` |
| **Bot de agenda**  | Responder como agenda (reuniões, tarefas) | Para gerar a resposta ao usuário | `vertex-ai.ts` → `generateContent` + `DEFAULT_SYSTEM_PROMPT` |
| **Bot extrator**   | Extrair reunião completa (JSON)          | Depois da resposta, para salvar | `vertex-ai.ts` → `extractMeetingFromHistory` |

Todos usam o **mesmo modelo** (Gemini 2.5 Flash) e a **mesma função de chamada** (`generateContent`), com `systemPrompt` e `history` diferentes.

---

## 5. Onde está cada prompt

- **Bot de agenda:** `DEFAULT_SYSTEM_PROMPT` em `lib/vertex-ai.ts` (topo do arquivo).
- **Bot de data:** `DATE_INFER_SYSTEM` em `lib/vertex-ai.ts`.
- **Bot extrator:** `EXTRACTOR_SYSTEM_PROMPT` em `lib/vertex-ai.ts`.

A montagem do `systemPrompt` final do bot de agenda (incluindo reuniões e instrução forçada) é feita em `lib/telegram-bot.ts` em `getReplyForChat` → `buildRecentMeetingsContext` e `buildForcedMatchInstruction`.

---

## 6. Dados e persistência

- **Histórico de chat:** Em memória por `chatId` em `lib/telegram-bot.ts` (`chatHistory` Map), limitado às últimas 20 mensagens.
- **Reuniões:** Firestore — coleção `meetings`, com subcoleção `items` por reunião. Acesso em `lib/meetings.ts` e tipos em `lib/firestore-types.ts`.

Com isso, o framework de documentação atual (README + este doc) fica explícito, e o comportamento de cada “bot” de IA e o momento em que cada um entra no fluxo ficam documentados.
