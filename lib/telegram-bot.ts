import { generateContent, extractMeetingFromHistory, inferMeetingDateFromConversation, DEFAULT_SYSTEM_PROMPT, type ChatMessage } from "@/lib/vertex-ai";
import { createMeeting, addMeetingItem, listMeetingsNearDate, formatMeetingForContext, formatMeetingDateStr } from "@/lib/meetings";
import type { Meeting } from "@/lib/firestore-types";

const MAX_HISTORY = 20;
const chatHistory = new Map<number, ChatMessage[]>();
/** Evita salvar a mesma reunião (assunto+data) mais de uma vez por chat. */
const savedMeetingKeys = new Map<number, Set<string>>();
const MAX_SAVED_KEYS_PER_CHAT = 10;

function getHistory(chatId: number): ChatMessage[] {
  return chatHistory.get(chatId) ?? [];
}

function pushToHistory(chatId: number, userText: string, modelText: string): void {
  const list = chatHistory.get(chatId) ?? [];
  list.push({ role: "user", text: userText }, { role: "model", text: modelText });
  if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
  chatHistory.set(chatId, list);
}

function meetingKey(assunto: string, data: string): string {
  return `${assunto}|${data}`;
}

/** Garante que a data extraída use o ano atual quando o ano vier no passado (ex.: 2024 → 2026). */
function normalizeExtractedDate(dateStr: string): string {
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const [, yearStr, month, day] = match;
  const year = parseInt(yearStr!, 10);
  const currentYear = new Date().getFullYear();
  if (year < currentYear) {
    return `${currentYear}-${month}-${day}${dateStr.slice(match[0].length)}`;
  }
  return dateStr;
}

function wasAlreadySaved(chatId: number, key: string): boolean {
  return savedMeetingKeys.get(chatId)?.has(key) ?? false;
}

function markAsSaved(chatId: number, key: string): void {
  let set = savedMeetingKeys.get(chatId);
  if (!set) {
    set = new Set();
    savedMeetingKeys.set(chatId, set);
  }
  set.add(key);
  if (set.size > MAX_SAVED_KEYS_PER_CHAT) {
    const arr = Array.from(set);
    arr.splice(0, arr.length - MAX_SAVED_KEYS_PER_CHAT);
    savedMeetingKeys.set(chatId, new Set(arr));
  }
}

/**
 * Verifica o histórico, extrai reunião completa (assunto + data + itens) e salva no Firestore.
 * Só salva se ainda não tiver salvo essa mesma reunião neste chat.
 */
async function trySaveMeetingFromHistory(chatId: number): Promise<string | null> {
  const history = getHistory(chatId);
  if (history.length === 0) return null;

  try {
    const extracted = await extractMeetingFromHistory(history);
    if (
      !extracted.hasCompleteMeeting ||
      !extracted.assunto?.trim() ||
      !extracted.data ||
      !extracted.items?.length
    ) {
      return null;
    }

    const dataNormalizada = normalizeExtractedDate(extracted.data);
    const key = meetingKey(extracted.assunto.trim(), dataNormalizada);
    if (wasAlreadySaved(chatId, key)) return null;

    const textoCompleto =
      extracted.textoCompleto?.trim() ||
      (extracted.items?.length ? extracted.items.join("\n\n") : undefined);

    const meetingId = await createMeeting({
      assunto: extracted.assunto.trim(),
      data: dataNormalizada,
      ...(textoCompleto && { textoCompleto }),
    });

    for (let i = 0; i < extracted.items.length; i++) {
      await addMeetingItem(meetingId, {
        content: extracted.items[i].trim(),
        order: i,
      });
    }

    markAsSaved(chatId, key);
    return meetingId;
  } catch (err) {
    console.error("[telegram-bot] extract/save meeting error:", err);
    return null;
  }
}

const NEAR_DATE_WINDOW_DAYS = 1;

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ");
}

/** Verifica se a mensagem do usuário corresponde ao assunto de alguma reunião (igual ou contém). */
function findMatchingMeeting(userMessage: string, meetings: Meeting[]): Meeting | null {
  const normalized = normalizeForMatch(userMessage);
  if (!normalized) return null;
  for (const m of meetings) {
    const assuntoNorm = normalizeForMatch(m.assunto ?? "");
    if (!assuntoNorm) continue;
    if (assuntoNorm === normalized) return m;
    if (normalized.includes(assuntoNorm) || assuntoNorm.includes(normalized)) return m;
  }
  return null;
}

/**
 * Monta o bloco de reuniões para a IA: busca na data próxima da reunião que está sendo inputada.
 * Se a conversa tiver data (hoje, ontem, 28/02…), usa essa data; senão, usa HOJE para maximizar chance de achar reunião do mesmo dia.
 */
async function buildRecentMeetingsContext(userMessage: string, history: ChatMessage[]): Promise<{
  block: string;
  meetings: Meeting[];
}> {
  try {
    const dateStr = await inferMeetingDateFromConversation(userMessage, history);
    const searchDate = dateStr ? new Date(dateStr) : new Date();
    const meetings = await listMeetingsNearDate(searchDate, NEAR_DATE_WINDOW_DAYS);

    if (meetings.length === 0) {
      const block = dateStr
        ? `Nenhuma reunião próxima a ${dateStr}.`
        : "Nenhuma reunião próxima a hoje.";
      return { block, meetings: [] };
    }
    const block = meetings.map(formatMeetingForContext).join("\n\n");
    return { block, meetings };
  } catch (err) {
    console.error("[telegram-bot] list meetings error:", err);
    return { block: "Não foi possível listar reuniões.", meetings: [] };
  }
}

/** Gera a instrução obrigatória quando a mensagem bate com uma reunião já salva. */
function buildForcedMatchInstruction(m: Meeting): string {
  const dataStr = formatMeetingDateStr(m);
  const conteudo = (m.textoCompleto || "(sem conteúdo ainda)").trim();
  return `INSTRUÇÃO OBRIGATÓRIA: O usuário acabou de escrever algo que corresponde a uma reunião JÁ SALVA no banco. Você DEVE começar sua resposta com a seguinte pergunta (use exatamente este texto):

"Não está tratando da reunião ${m.assunto}, do dia ${dataStr}? Quer atualizar? O que já temos de informação é isso:

${conteudo}"

Depois dessa pergunta você pode acrescentar uma frase curta se quiser (ex.: "Se quiser, pode me enviar mais pontos para eu incluir.").`;
}

/**
 * Gera resposta do bot usando Vertex AI (Gemini).
 * Usa janela de contexto de pelo menos 20 mensagens por chat.
 * Inclui reuniões recentes do banco para a IA perguntar "não é a reunião X do dia Y? quer atualizar?".
 * Após responder, uma IA extratora analisa o histórico e salva reuniões completas no Firestore.
 */
export async function getReplyForChat(chatId: number, userMessage: string): Promise<string> {
  const text = (userMessage ?? "").trim();
  if (!text) return "Envie uma mensagem de texto.";

  const history = getHistory(chatId);
  const { block: recentBlock, meetings } = await buildRecentMeetingsContext(text, history);

  const matching = findMatchingMeeting(text, meetings);
  const forcedInstruction = matching ? buildForcedMatchInstruction(matching) + "\n\n" : "";
  const systemPrompt = `${forcedInstruction}${DEFAULT_SYSTEM_PROMPT}\n\n[REUNIÕES NO BANCO (data próxima da reunião que está sendo inputada)]\n${recentBlock}`;

  try {
    const reply = await generateContent({
      userMessage: text,
      history,
      systemPrompt,
    });
    pushToHistory(chatId, text, reply);

    const savedMeetingId = await trySaveMeetingFromHistory(chatId);
    if (savedMeetingId) {
      return `${reply}\n\n✅ Reunião salva no banco (assunto, data e itens).`;
    }

    return reply;
  } catch (err) {
    console.error("[telegram-bot] Vertex AI error:", err);
    return "Desculpe, tive um problema ao processar. Tente de novo em instantes.";
  }
}
