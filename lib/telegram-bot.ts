/**
 * Orquestrador do Telegram: 100% das mensagens passam pelo Bot Classificador (AI Router).
 * O usuário nunca escolhe o bot manualmente; o Classificador encaminha para o bot especializado.
 */

import { extractMeetingUpdateFromHistory, inferMeetingDateFromConversation, type ChatMessage } from "@/lib/vertex-ai";
import {
  createMeeting,
  addMeetingItem,
  listMeetingsNearDate,
  listMeetingsRecent,
  getMeeting,
  updateMeeting,
  deleteMeeting,
  formatMeetingForContext,
  formatMeetingDateStr,
} from "@/lib/meetings";
import type { Meeting } from "@/lib/firestore-types";
import {
  classify,
  runBot,
  isRoutableCategory,
  buildForcedMatchInstructionForAlteracao,
  type Category,
} from "@/lib/router";

/** Entrada de debug: qual etapa respondeu e o que retornou. */
export interface DebugStep {
  /** Nome da etapa: "classificador" ou o nome do bot (CONSULTA, ALTERACAO, etc.). */
  name: string;
  /** Resposta gerada por essa etapa. */
  reply: string;
}

export interface GetReplyOptions {
  /** Se true, retorna { reply, debug } em vez de só a string. */
  returnDebug?: boolean;
}

const MAX_HISTORY = 20;
const chatHistory = new Map<number, ChatMessage[]>();
const savedMeetingKeys = new Map<number, Set<string>>();
const MAX_SAVED_KEYS_PER_CHAT = 10;

const pendingUpdate = new Map<number, { meetingId: string; assunto: string }>();
const pendingUpdateConfirm = new Map<number, { meetingId: string; assunto: string }>();
const pendingDelete = new Map<number, { meetingId: string; assunto: string; dataStr: string }>();
const pendingSave = new Map<
  number,
  { assunto: string; data: string; textoCompleto?: string; items: string[] }
>();

/** Quando o Classificador retornou MULTIPLAS: opções e pergunta ao usuário. */
const pendingChoice = new Map<number, { options: Category[]; reply: string }>();

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

function isConfirmation(msg: string): boolean {
  const n = msg.trim().toLowerCase().replace(/\s+/g, " ");
  return /^(sim|quero|pode|atualiza|atualizar|exclui|excluir|apaga|apagar|remover|deletar|confirmo|ok|confirmar)$/.test(n) || n === "s";
}

function isRejection(msg: string): boolean {
  const n = msg.trim().toLowerCase().replace(/\s+/g, " ");
  return /^(nao|não|cancelar|cancela|outra|não quero)$/.test(n) || n === "n";
}

function normalizeExtractedDate(dateStr: string): string {
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const [, yearStr, month, day] = match;
  const year = parseInt(yearStr!, 10);
  const currentYear = new Date().getFullYear();
  if (year < currentYear) {
    return `${currentYear}-${match[2]}-${match[3]}${dateStr.slice(match[0].length)}`;
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

async function doSavePendingMeeting(chatId: number): Promise<string> {
  const pending = pendingSave.get(chatId);
  if (!pending) return "";

  try {
    const meetingId = await createMeeting({
      assunto: pending.assunto,
      data: pending.data,
      ...(pending.textoCompleto && { textoCompleto: pending.textoCompleto }),
    });
    for (let i = 0; i < pending.items.length; i++) {
      await addMeetingItem(meetingId, { content: pending.items[i], order: i });
    }
    markAsSaved(chatId, meetingKey(pending.assunto, pending.data));
    pendingSave.delete(chatId);
    return `✅ Reunião "${pending.assunto}" salva no banco (assunto, data e itens).`;
  } catch (err) {
    console.error("[telegram-bot] save pending meeting error:", err);
    pendingSave.delete(chatId);
    return "Não consegui salvar. Tente de novo.";
  }
}

const NEAR_DATE_WINDOW_DAYS = 1;

function normalizeForMatch(s: string): string {
  return s
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ");
}

const STOPWORDS = new Set(["de", "do", "da", "com", "e", "a", "o", "no", "na", "em", "para", "sobre", "dos", "das", "que", "um", "uma", "os", "as", "ao", "aos"]);

function subjectKeywords(assunto: string): string[] {
  const norm = normalizeForMatch(assunto);
  return norm.split(/\s+/).filter((w) => w.length >= 3 && !STOPWORDS.has(w));
}

function findMatchingMeeting(userMessage: string, meetings: Meeting[]): Meeting | null {
  const normalized = normalizeForMatch(userMessage);
  if (!normalized) return null;
  for (const m of meetings) {
    const assuntoNorm = normalizeForMatch(m.assunto ?? "");
    if (!assuntoNorm) continue;
    if (assuntoNorm === normalized) return m;
    if (normalized.includes(assuntoNorm) || assuntoNorm.includes(normalized)) return m;
    const keywords = subjectKeywords(m.assunto ?? "");
    if (keywords.some((kw) => kw.length >= 3 && normalized.includes(kw))) return m;
  }
  return null;
}

/** Para ALTERACAO: quando a mensagem do usuário não cita a reunião, tenta inferir da última resposta do bot (ex.: "detalhes da reunião ... 156 ..."). */
function findMatchingMeetingFromHistory(history: ChatMessage[], meetings: Meeting[]): Meeting | null {
  for (let i = history.length - 1; i >= 0; i--) {
    if (history[i].role === "model") {
      const match = findMatchingMeeting(history[i].text, meetings);
      if (match) return match;
    }
  }
  return null;
}

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

async function buildConsultaMeetingsBlock(): Promise<{ block: string; meetings: Meeting[] }> {
  try {
    const meetings = await listMeetingsRecent(30);
    if (meetings.length === 0) return { block: "Nenhuma reunião nos últimos 30 dias.", meetings: [] };
    return { block: meetings.map(formatMeetingForContext).join("\n\n"), meetings };
  } catch (err) {
    console.error("[telegram-bot] list meetings error:", err);
    return { block: "Não foi possível listar reuniões.", meetings: [] };
  }
}

async function doUpdateMeeting(chatId: number, userMessage: string): Promise<string> {
  const pending = pendingUpdate.get(chatId);
  if (!pending) return "";

  try {
    const meeting = await getMeeting(pending.meetingId);
    if (!meeting) return "Reunião não encontrada no banco.";

    const history = getHistory(chatId);
    const historyWithConfirm = [
      ...history,
      { role: "user" as const, text: userMessage },
    ];
    const existingContent = meeting.textoCompleto ?? "";
    const textoCompleto = await extractMeetingUpdateFromHistory(historyWithConfirm, existingContent);

    await updateMeeting(pending.meetingId, { textoCompleto: textoCompleto || existingContent });
    pendingUpdate.delete(chatId);
    return `✅ Reunião "${pending.assunto}" atualizada com o novo conteúdo.`;
  } catch (err) {
    console.error("[telegram-bot] update meeting error:", err);
    pendingUpdate.delete(chatId);
    return "Não consegui atualizar. Tente descrever de novo o que quer acrescentar ou alterar.";
  }
}

/** Resolve mensagem do usuário para uma categoria quando está em pendingChoice (ex.: "1" -> primeira opção, "consulta" -> CONSULTA). */
function resolveChoiceToCategory(message: string, options: Category[]): Category | null {
  const t = message.trim().toLowerCase().replace(/\s+/g, " ");
  const n = parseInt(t, 10);
  if (!Number.isNaN(n) && n >= 1 && n <= options.length) return options[n - 1];
  if (/consult(a|ar|ar\s+reuni)/i.test(t)) return "CONSULTA";
  if (/alter(a|ar|ar\s+registro)/i.test(t)) return "ALTERACAO";
  if (/exclu(i|ir)|apag(a|ar)|delet(a|ar)|remov(e|er)/i.test(t)) return "EXCLUSAO";
  if (/inclu(i|ir)|cri(a|ar)|salv(a|ar)|adicion(a|ar)/i.test(t)) return "INCLUSAO";
  return null;
}

/**
 * Gera resposta: toda mensagem passa pelo Bot Classificador (AI Router).
 * Com options.returnDebug = true, retorna { reply, debug } em vez de só a string.
 */
export async function getReplyForChat(
  chatId: number,
  userMessage: string,
  options?: GetReplyOptions
): Promise<string | { reply: string; debug: DebugStep[] }> {
  const text = (userMessage ?? "").trim();
  if (!text) return "Envie uma mensagem de texto.";

  const history = getHistory(chatId);
  const debugSteps: DebugStep[] = [];
  const wantDebug = options?.returnDebug === true;

  function returnReply(reply: string, steps?: DebugStep[]): string | { reply: string; debug: DebugStep[] } {
    if (wantDebug) {
      if (steps?.length) debugSteps.push(...steps);
      return { reply, debug: [...debugSteps] };
    }
    return reply;
  }

  // ----- 0. Confirmação para SALVAR reunião
  const pendingS = pendingSave.get(chatId);
  if (pendingS) {
    if (isConfirmation(text)) {
      const msg = await doSavePendingMeeting(chatId);
      pushToHistory(chatId, text, msg);
      if (wantDebug) debugSteps.push({ name: "confirmação_salvar", reply: msg });
      return returnReply(msg);
    }
    if (isRejection(text)) {
      pendingSave.delete(chatId);
    }
  }

  // ----- 1a. Confirmação para SALVAR a atualização (segundo "sim" da alteração, se houver fluxo em duas etapas)
  const pendingUpConfirm = pendingUpdateConfirm.get(chatId);
  if (pendingUpConfirm) {
    if (isConfirmation(text)) {
      pendingUpdate.set(chatId, pendingUpConfirm);
      pendingUpdateConfirm.delete(chatId);
      const msg = await doUpdateMeeting(chatId, text);
      pushToHistory(chatId, text, msg);
      if (wantDebug) debugSteps.push({ name: "confirmação_atualizar", reply: msg });
      return returnReply(msg);
    }
    if (isRejection(text)) {
      pendingUpdateConfirm.delete(chatId);
    }
  }

  // ----- 1b. "sim" em alteração (bot já pediu "Confirma a alteração?") → atualiza no banco
  const pendingUp = pendingUpdate.get(chatId);
  if (pendingUp) {
    if (isConfirmation(text)) {
      const msg = await doUpdateMeeting(chatId, text);
      pushToHistory(chatId, text, msg);
      if (wantDebug) debugSteps.push({ name: "confirmação_atualizar", reply: msg });
      return returnReply(msg);
    }
    if (isRejection(text)) {
      pendingUpdate.delete(chatId);
    }
  }

  // ----- 2. Confirmação de exclusão
  const pendingDel = pendingDelete.get(chatId);
  if (pendingDel) {
    if (isConfirmation(text)) {
      try {
        await deleteMeeting(pendingDel.meetingId);
        pendingDelete.delete(chatId);
        const msg = `✅ Reunião "${pendingDel.assunto}" (${pendingDel.dataStr}) foi excluída.`;
        pushToHistory(chatId, text, msg);
        if (wantDebug) debugSteps.push({ name: "confirmação_excluir", reply: msg });
        return returnReply(msg);
      } catch (err) {
        console.error("[telegram-bot] delete meeting error:", err);
        pendingDelete.delete(chatId);
        const errMsg = "Não consegui excluir a reunião. Tente de novo.";
        pushToHistory(chatId, text, errMsg);
        if (wantDebug) debugSteps.push({ name: "confirmação_excluir", reply: errMsg });
        return returnReply(errMsg);
      }
    }
    if (isRejection(text)) {
      pendingDelete.delete(chatId);
    }
  }

  // ----- 3. Escolha pendente (Classificador retornou MULTIPLAS)
  const choice = pendingChoice.get(chatId);
  if (choice) {
    const resolved = resolveChoiceToCategory(text, choice.options);
    if (resolved && isRoutableCategory(resolved)) {
      pendingChoice.delete(chatId);
      const ctx = await buildBotContext(chatId, text, history, resolved);
      const result = await runBot(resolved, ctx);
      applyBotResultState(chatId, result);
      pushToHistory(chatId, text, result.reply);
      if (wantDebug) debugSteps.push({ name: resolved, reply: result.reply });
      return returnReply(result.reply);
    }
    const askAgain = `${choice.reply}\n\nPor favor, escolha uma opção (ex.: 1 ou 2, ou diga "consultar" / "alterar").`;
    pushToHistory(chatId, text, askAgain);
    if (wantDebug) debugSteps.push({ name: "MULTIPLAS_escolha", reply: askAgain });
    return returnReply(askAgain);
  }

  // ----- 4. Bot Classificador: classificar e rotear
  try {
    const classification = await classify(text, history);

    if (classification.category === "MULTIPLAS" && classification.options?.length && classification.reply) {
      pendingChoice.set(chatId, { options: classification.options, reply: classification.reply });
      pushToHistory(chatId, text, classification.reply);
      if (wantDebug) debugSteps.push({ name: "classificador (MULTIPLAS)", reply: classification.reply });
      return returnReply(classification.reply);
    }

    if (classification.category === "RESPONDER_DIRETO" || classification.category === "NAO_ENTENDI") {
      const reply = classification.reply ?? "Não entendi. Pode reformular?";
      pushToHistory(chatId, text, reply);
      if (wantDebug) debugSteps.push({ name: `classificador (${classification.category})`, reply });
      return returnReply(reply);
    }

    if (isRoutableCategory(classification.category)) {
      const ctx = await buildBotContext(chatId, text, history, classification.category);
      const result = await runBot(classification.category, ctx);
      applyBotResultState(chatId, result);

      if (result.pendingSave) {
        const key = meetingKey(result.pendingSave.assunto, result.pendingSave.data);
        if (wasAlreadySaved(chatId, key)) {
          pushToHistory(chatId, text, result.reply);
          if (wantDebug) debugSteps.push({ name: classification.category, reply: result.reply });
          return returnReply(result.reply);
        }
        pendingSave.set(chatId, result.pendingSave);
        const dataStr = new Date(result.pendingSave.data + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const fullReply = `${result.reply}\n\n📋 Encontrei os dados de uma reunião: **${result.pendingSave.assunto}**, dia ${dataStr}, com ${result.pendingSave.items.length} item(ns). Quer que eu salve no banco? (sim/não)`;
        pushToHistory(chatId, text, fullReply);
        if (wantDebug) debugSteps.push({ name: classification.category, reply: fullReply });
        return returnReply(fullReply);
      }

      pushToHistory(chatId, text, result.reply);
      if (wantDebug) debugSteps.push({ name: classification.category, reply: result.reply });
      return returnReply(result.reply);
    }

    const fallback = classification.reply ?? "Não consegui processar. Tente novamente.";
    pushToHistory(chatId, text, fallback);
    if (wantDebug) debugSteps.push({ name: `classificador (${classification.category})`, reply: fallback });
    return returnReply(fallback);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[telegram-bot] Router/Vertex error:", message, stack ?? "");
    const errReply =
      message.includes("403") || message.includes("PERMISSION_DENIED") || message.includes("CONSUMER_INVALID")
        ? "Não foi possível usar o serviço de IA: permissão negada no projeto (Vertex AI / Google Cloud). Verifique no Google Cloud Console se a API Vertex AI está ativada e se as credenciais (OAuth) têm acesso ao projeto."
        : "Desculpe, tive um problema ao processar. Tente de novo em instantes.";
    if (wantDebug) debugSteps.push({ name: "erro", reply: errReply });
    return returnReply(errReply);
  }
}

/** Monta o contexto (meetingsBlock, matchingMeeting, forcedInstruction) para o bot especializado. */
async function buildBotContext(
  chatId: number,
  userMessage: string,
  history: ChatMessage[],
  category: Category
): Promise<{
  chatId: number;
  userMessage: string;
  history: ChatMessage[];
  meetingsBlock: string;
  meetings: Meeting[];
  matchingMeeting: Meeting | null;
  forcedInstruction?: string;
}> {
  let block: string;
  let meetings: Meeting[];

  if (category === "INCLUSAO") {
    const out = await buildRecentMeetingsContext(userMessage, history);
    block = out.block;
    meetings = out.meetings;
  } else {
    const out = await buildConsultaMeetingsBlock();
    block = out.block;
    meetings = out.meetings;
  }

  let matchingMeeting = findMatchingMeeting(userMessage, meetings);
  if (!matchingMeeting && category === "ALTERACAO") {
    matchingMeeting = findMatchingMeetingFromHistory(history, meetings);
  }
  let forcedInstruction: string | undefined;
  if (matchingMeeting && category === "ALTERACAO") {
    const dataStr = formatMeetingDateStr(matchingMeeting);
    const conteudo = (matchingMeeting.textoCompleto || "(sem conteúdo ainda)").trim();
    forcedInstruction = buildForcedMatchInstructionForAlteracao(
      matchingMeeting.assunto ?? "",
      dataStr,
      conteudo
    );
  }

  return {
    chatId,
    userMessage,
    history,
    meetingsBlock: block,
    meetings,
    matchingMeeting,
    forcedInstruction,
  };
}

function applyBotResultState(
  chatId: number,
  result: { pendingUpdate?: { meetingId: string; assunto: string }; pendingUpdateConfirm?: { meetingId: string; assunto: string }; pendingDelete?: { meetingId: string; assunto: string; dataStr: string } }
): void {
  if (result.pendingUpdate) {
    pendingUpdate.set(chatId, result.pendingUpdate);
    pendingSave.delete(chatId);
  }
  if (result.pendingUpdateConfirm) pendingUpdateConfirm.set(chatId, result.pendingUpdateConfirm);
  if (result.pendingDelete) pendingDelete.set(chatId, result.pendingDelete);
}
