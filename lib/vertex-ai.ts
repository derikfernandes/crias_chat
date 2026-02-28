/**
 * Vertex AI (Gemini) via OAuth2 + generateContent.
 * O token OAuth é obtido com refresh_token e guardado em memória.
 */

const OAUTH_TOKEN_URL = "https://accounts.google.com/o/oauth2/token";
const VERTEX_GENERATE_URL =
  "https://us-central1-aiplatform.googleapis.com/v1/projects/crias-mvp/locations/us-central1/publishers/google/models/gemini-2.5-flash:generateContent";

/** Prompt do bot de agenda: reuniões, lembretes, categorias, resumos e perguntas de esclarecimento. */
export const DEFAULT_SYSTEM_PROMPT = `Você é um bot que funciona como a agenda pessoal do usuário. Sua função é ajudar a organizar e enviar mensagens com:

- **Anotações de reunião**: registre pontos discutidos, decisões, action items e participantes.
- **Lembretes**: datas, horários e o que não esquecer.
- **Tarefas**: coisas a fazer, com prioridade ou prazo quando informado.
- **Compromissos**: eventos, reuniões futuras, compromissos agendados.
- **Ideias e notas rápidas**: anotações soltas para depois.

Comportamento esperado:
1. **Reuniões – preenchimento obrigatório**: quando o usuário falar de uma reunião (anotações, pontos discutidos, ata), você DEVE garantir que temos:
   - **Assunto**: nome ou tema da reunião (ex: "Sprint Planning", "1:1 com João"). Se não tiver, pergunte: "Qual o assunto ou nome dessa reunião?"
   - **Data (sempre em pergunta separada)**: você SEMPRE deve perguntar a data da reunião em uma mensagem dedicada. Nunca assuma a data sem perguntar. Se o usuário já tiver mencionado uma data no texto (ex.: "reunião de ontem", "dia 28", "hoje"), confirme em vez de perguntar do zero: "Você mencionou [data/dia] no texto. É essa a data da reunião?" ou "Pelo que você escreveu, a reunião seria no dia [data]. Confirma?" Se não tiver nenhuma data no texto, pergunte: "Qual a data (e horário, se souber) dessa reunião?"
   - **Itens**: os pontos, decisões ou anotações da reunião. Se o usuário só der assunto e data, pergunte: "Quais os principais pontos ou itens que quer registrar dessa reunião?"
   Faça uma pergunta de cada vez, de forma natural, até ter assunto, data confirmada e pelo menos um item. Só então confirme que pode salvar.
2. **Resumos de reunião**: quando já houver conteúdo, apresente um resumo claro (o que foi decidido, próximos passos, responsáveis).
3. **Perguntas de esclarecimento**: faça perguntas curtas e objetivas quando faltar informação importante (datas, responsáveis, prazos, contexto).
4. **Organização**: sugira categorizar o conteúdo (reunião, lembrete, tarefa, etc.) quando fizer sentido.
5. **Tom**: seja conciso, útil e em português. Evite respostas longas demais; priorize clareza e ação.

6. **Reuniões já salvas**: quando te passarem "[REUNIÕES RECENTES NO BANCO]" abaixo, use isso: se o usuário mandar um assunto ou falar de uma reunião, verifique se há alguma reunião listada com assunto parecido (ou no mesmo dia). Se houver, pergunte exatamente neste estilo: "Não está tratando da reunião [assunto], do dia [data]? Quer atualizar? O que já temos de informação é isso:\n[cole aqui o texto 'O que já temos' da reunião]." Só depois de perguntar isso (ou se não houver reunião parecida) prossiga com o fluxo normal (perguntar data, itens, etc.).`;

let cachedOAuth: { access_token: string; expires_at: number } | null = null;
const TOKEN_BUFFER_MS = 60 * 1000; // renovar 1 min antes de expirar

async function getOAuthToken(): Promise<string> {
  if (cachedOAuth && Date.now() < cachedOAuth.expires_at - TOKEN_BUFFER_MS) {
    return cachedOAuth.access_token;
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!clientId || !clientSecret || !refreshToken) {
    throw new Error("Variáveis GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET e GOOGLE_REFRESH_TOKEN são obrigatórias.");
  }

  const body = new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "refresh_token",
    refresh_token: refreshToken,
  });

  const res = await fetch(OAUTH_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`OAuth token falhou: ${res.status} ${err}`);
  }

  const oauth = (await res.json()) as {
    access_token: string;
    expires_in: number;
  };
  cachedOAuth = {
    access_token: oauth.access_token,
    expires_at: Date.now() + (oauth.expires_in ?? 3600) * 1000,
  };
  return cachedOAuth.access_token;
}

/** Uma mensagem no histórico (role do Gemini: "user" ou "model"). */
export interface ChatMessage {
  role: "user" | "model";
  text: string;
}

export interface GenerateContentOptions {
  userMessage: string;
  systemPrompt?: string;
  /** Histórico da conversa (janela de contexto). Use pelo menos as últimas 20 mensagens. */
  history?: ChatMessage[];
}

const MAX_CONTEXT_MESSAGES = 20;

export async function generateContent(options: GenerateContentOptions): Promise<string> {
  const { userMessage, systemPrompt = DEFAULT_SYSTEM_PROMPT, history = [] } = options;
  const accessToken = await getOAuthToken();

  const recent = history.slice(-MAX_CONTEXT_MESSAGES);
  const contents: Array<{ role: "user" | "model"; parts: Array<{ text: string }> }> = [
    ...recent.map((m) => ({ role: m.role as "user" | "model", parts: [{ text: m.text }] })),
    { role: "user", parts: [{ text: userMessage.trim() || "." }] },
  ];

  const body = {
    systemInstruction: { parts: [{ text: systemPrompt }] },
    contents,
    generationConfig: {
      responseModalities: ["TEXT"],
      temperature: 0.13,
      topK: 8,
      topP: 0.55,
      maxOutputTokens: 50000,
      stopSequences: [],
    },
    safetySettings: [
      { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_ONLY_HIGH" },
      { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_ONLY_HIGH" },
    ],
  };

  const res = await fetch(VERTEX_GENERATE_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Vertex generateContent falhou: ${res.status} ${err}`);
  }

  const data = (await res.json()) as {
    candidates?: Array<{
      content?: { parts?: Array<{ text?: string }> };
    }>;
  };

  const text =
    data.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ??
    "";

  return text || "Não consegui gerar uma resposta.";
}

/** Inferência de data da reunião a partir da mensagem e do histórico (hoje, ontem, 28/02, etc.). */
const DATE_INFER_SYSTEM = `Você extrai a DATA de uma reunião mencionada na conversa. Responda APENAS com uma data no formato YYYY-MM-DD, ou exatamente a palavra null se não houver data mencionada ou inferível.
Use a "data de hoje" fornecida para interpretar "hoje", "ontem", "amanhã" e para o ANO: para "dia 28", "28/02", "27/02", etc., use SEMPRE o ano da "data de hoje" (ex.: se data de hoje for 2026-02-27, então 27/02 = 2026-02-27).`;

/** Retorna a data da reunião que o usuário está inputando (YYYY-MM-DD) ou null. */
export async function inferMeetingDateFromConversation(
  userMessage: string,
  history: ChatMessage[]
): Promise<string | null> {
  const today = new Date();
  const todayStr = today.toISOString().slice(0, 10);
  const recent = history.slice(-6);
  const lines = recent.map((m) => `${m.role === "user" ? "Usuário" : "Bot"}: ${m.text}`);
  lines.push(`Usuário: ${userMessage}`);
  const userPrompt = `Data de hoje (para referência): ${todayStr}\n\nConversa:\n${lines.join("\n")}\n\nQual a data da reunião que está sendo falada? Responda só YYYY-MM-DD ou null.`;

  try {
    const raw = await generateContent({
      userMessage: userPrompt,
      systemPrompt: DATE_INFER_SYSTEM,
      history: [],
    });
    const trimmed = raw.trim().toLowerCase().replace(/^["']|["']$/g, "");
    if (trimmed === "null" || trimmed === "") return null;
    const match = trimmed.match(/\d{4}-\d{2}-\d{2}/);
    if (match) return match[0];
    const parsed = new Date(trimmed);
    if (!Number.isNaN(parsed.getTime())) return parsed.toISOString().slice(0, 10);
    return null;
  } catch {
    return null;
  }
}

/** Resultado da extração de uma reunião a partir do histórico. */
export interface ExtractedMeeting {
  hasCompleteMeeting: boolean;
  assunto?: string;
  data?: string;
  /** Texto completo da reunião (todo o conteúdo compilado, sem resumir). */
  textoCompleto?: string;
  items?: string[];
}

const EXTRACTOR_SYSTEM_PROMPT = `Você é um extrator de dados. Analise a conversa e identifique se há uma reunião COMPLETA para salvar.
Reunião completa = assunto + data + pelo menos um item/ponto da reunião.
Responda APENAS com um único JSON válido, sem markdown e sem texto antes ou depois, neste formato exato:
{"hasCompleteMeeting": true ou false, "assunto": "string ou null", "data": "ISO ou YYYY-MM-DD ou null", "textoCompleto": "string", "items": ["string", ...]}
- data: use formato ISO (ex: 2025-02-28T14:00:00) ou YYYY-MM-DD. IMPORTANTE: quando a conversa mencionar só dia/mês (ex: 27/02, dia 28), use SEMPRE o ano da "data de hoje" fornecida na mensagem do usuário abaixo.
- textoCompleto: OBRIGATÓRIO quando hasCompleteMeeting for true. Deve conter TODO o conteúdo da reunião em um único texto: todas as falas do usuário sobre a reunião compiladas, pontos discutidos, decisões, anotações, action items - texto completo e fiel, sem resumir nem cortar. Use quebras de linha (\\n) para separar blocos se fizer sentido.
- items: lista de strings, cada uma é um ponto/item/anotação da reunião (para listagem estruturada). Se não houver, use [].
- hasCompleteMeeting: true somente se tiver assunto, data e pelo menos um item.`;

/** Analisa o histórico da conversa e extrai dados estruturados da reunião, se houver uma completa. */
export async function extractMeetingFromHistory(
  history: ChatMessage[]
): Promise<ExtractedMeeting> {
  if (history.length === 0) {
    return { hasCompleteMeeting: false };
  }

  const recent = history.slice(-MAX_CONTEXT_MESSAGES);
  const conversationText = recent
    .map((m) => `${m.role === "user" ? "Usuário" : "Bot"}: ${m.text}`)
    .join("\n");

  const todayStr = new Date().toISOString().slice(0, 10);
  const userPrompt = `Data de hoje (use este ano para qualquer data que a conversa não especificar): ${todayStr}\n\nConversa:\n${conversationText}\n\nCom base na conversa acima, extraia os dados da reunião. Responda APENAS com o JSON (sem \`\`\`json e sem explicação).`;

  const raw = await generateContent({
    userMessage: userPrompt,
    systemPrompt: EXTRACTOR_SYSTEM_PROMPT,
    history: [],
  });

  const cleaned = raw.replace(/^[\s\S]*?\{/, "{").replace(/\}[\s\S]*$/, "}");
  try {
    const parsed = JSON.parse(cleaned) as ExtractedMeeting;
    return {
      hasCompleteMeeting: Boolean(parsed.hasCompleteMeeting),
      assunto: parsed.assunto ?? undefined,
      data: parsed.data ?? undefined,
      textoCompleto: typeof parsed.textoCompleto === "string" ? parsed.textoCompleto : undefined,
      items: Array.isArray(parsed.items) ? parsed.items.filter((x): x is string => typeof x === "string") : undefined,
    };
  } catch {
    return { hasCompleteMeeting: false };
  }
}
