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
import {
  getChatState,
  getChatStateByUserEmail,
  saveChatState,
  CHAT_STATE_MAX_HISTORY as MAX_HISTORY,
  CHAT_STATE_MAX_SAVED_KEYS as MAX_SAVED_KEYS_PER_CHAT,
  type ChatState,
} from "@/lib/chat-state";

/** Entrada de debug: qual etapa respondeu e o que retornou. */
export interface DebugStep {
  /** Nome da etapa: "classificador" ou o nome do bot (CONSULTA, ALTERACAO, etc.). */
  name: string;
  /** Resposta gerada por essa etapa. */
  reply: string;
}

/** ChatId fixo usado pelo test-bot na web. Histórico é isolado por userEmail (doc 999999-email). */
export const TEST_CHAT_ID = 999999;

export interface GetReplyOptions {
  /** Se true, retorna { reply, debug } em vez de só a string. */
  returnDebug?: boolean;
  /** E-mail do usuário logado (web). Vincula o chat a este cadastro; novas reuniões usam este e-mail. */
  userEmail?: string;
}

function pushToHistory(state: ChatState, userText: string, modelText: string): void {
  state.history.push({ role: "user", text: userText }, { role: "model", text: modelText });
  if (state.history.length > MAX_HISTORY) state.history.splice(0, state.history.length - MAX_HISTORY);
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

function wasAlreadySaved(state: ChatState, key: string): boolean {
  return state.savedMeetingKeys.includes(key);
}

function markAsSaved(state: ChatState, key: string): void {
  state.savedMeetingKeys = [...state.savedMeetingKeys.filter((k) => k !== key), key].slice(
    -MAX_SAVED_KEYS_PER_CHAT
  );
}

async function doSavePendingMeeting(chatId: number, state: ChatState): Promise<string> {
  const pending = state.pendingSave;
  if (!pending) return "";
  if (!state.userEmail?.trim()) {
    state.pendingSave = null;
    return "Para salvar reuniões, vincule sua conta: use o chat pela web (logado) ou vincule este chat ao seu cadastro.";
  }

  try {
    const meetingId = await createMeeting({
      assunto: pending.assunto,
      data: pending.data,
      userEmail: state.userEmail,
      ...(pending.textoCompleto && { textoCompleto: pending.textoCompleto }),
    });
    for (let i = 0; i < pending.items.length; i++) {
      await addMeetingItem(meetingId, {
        content: pending.items[i],
        order: i,
        userEmail: state.userEmail,
      });
    }
    markAsSaved(state, meetingKey(pending.assunto, pending.data));
    state.pendingSave = null;
    return `✅ Reunião "${pending.assunto}" salva no banco (assunto, data e itens).`;
  } catch (err) {
    console.error("[telegram-bot] save pending meeting error:", err);
    state.pendingSave = null;
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

async function buildRecentMeetingsContext(
  userMessage: string,
  history: ChatMessage[],
  userEmail?: string
): Promise<{ block: string; meetings: Meeting[] }> {
  try {
    const dateStr = await inferMeetingDateFromConversation(userMessage, history);
    const searchDate = dateStr ? new Date(dateStr) : new Date();
    const meetings = await listMeetingsNearDate(searchDate, NEAR_DATE_WINDOW_DAYS, userEmail);

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

async function buildConsultaMeetingsBlock(userEmail?: string): Promise<{ block: string; meetings: Meeting[] }> {
  try {
    const meetings = await listMeetingsRecent(30, userEmail);
    if (meetings.length === 0) return { block: "Nenhuma reunião nos últimos 30 dias.", meetings: [] };
    return { block: meetings.map(formatMeetingForContext).join("\n\n"), meetings };
  } catch (err) {
    console.error("[telegram-bot] list meetings error:", err);
    return { block: "Não foi possível listar reuniões.", meetings: [] };
  }
}

async function doUpdateMeeting(state: ChatState, userMessage: string): Promise<string> {
  const pending = state.pendingUpdate;
  if (!pending) return "";

  try {
    const meeting = await getMeeting(pending.meetingId);
    if (!meeting) return "Reunião não encontrada no banco.";

    const historyWithConfirm = [
      ...state.history,
      { role: "user" as const, text: userMessage },
    ];
    const existingContent = meeting.textoCompleto ?? "";
    const textoCompleto = await extractMeetingUpdateFromHistory(historyWithConfirm, existingContent);

    await updateMeeting(pending.meetingId, { textoCompleto: textoCompleto || existingContent });
    state.pendingUpdate = null;
    return `✅ Reunião "${pending.assunto}" atualizada com o novo conteúdo.`;
  } catch (err) {
    console.error("[telegram-bot] update meeting error:", err);
    state.pendingUpdate = null;
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

  const userEmail = options?.userEmail?.trim();
  let state: ChatState;
  let stateDocId: string | undefined;
  if (chatId === TEST_CHAT_ID && userEmail) {
    const result = await getChatStateByUserEmail(chatId, userEmail);
    state = result.state;
    stateDocId = result.saveDocId;
  } else {
    state = await getChatState(chatId);
    stateDocId = undefined;
  }
  if (userEmail) {
    state.userEmail = userEmail;
  }
  const debugSteps: DebugStep[] = [];
  const wantDebug = options?.returnDebug === true;

  const persistAndReturn = async (
    reply: string | { reply: string; debug: DebugStep[] }
  ): Promise<string | { reply: string; debug: DebugStep[] }> => {
    await saveChatState(chatId, state, stateDocId);
    return reply;
  };

  function returnReply(reply: string, steps?: DebugStep[]): string | { reply: string; debug: DebugStep[] } {
    if (wantDebug) {
      if (steps?.length) debugSteps.push(...steps);
      return { reply, debug: [...debugSteps] };
    }
    return reply;
  }

  // ----- 0. Confirmação para SALVAR reunião
  const pendingS = state.pendingSave;
  if (pendingS) {
    if (isConfirmation(text)) {
      const msg = await doSavePendingMeeting(chatId, state);
      pushToHistory(state, text, msg);
      if (wantDebug) debugSteps.push({ name: "confirmação_salvar", reply: msg });
      return persistAndReturn(returnReply(msg));
    }
    if (isRejection(text)) {
      state.pendingSave = null;
    }
  }

  // ----- 1a. Confirmação para SALVAR a atualização (segundo "sim" da alteração, se houver fluxo em duas etapas)
  const pendingUpConfirm = state.pendingUpdateConfirm;
  if (pendingUpConfirm) {
    if (isConfirmation(text)) {
      state.pendingUpdate = pendingUpConfirm;
      state.pendingUpdateConfirm = null;
      const msg = await doUpdateMeeting(state, text);
      pushToHistory(state, text, msg);
      if (wantDebug) debugSteps.push({ name: "confirmação_atualizar", reply: msg });
      return persistAndReturn(returnReply(msg));
    }
    if (isRejection(text)) {
      state.pendingUpdateConfirm = null;
    }
  }

  // ----- 1b. "sim" em alteração (bot já pediu "Confirma a alteração?") → atualiza no banco
  const pendingUp = state.pendingUpdate;
  if (pendingUp) {
    if (isConfirmation(text)) {
      const msg = await doUpdateMeeting(state, text);
      pushToHistory(state, text, msg);
      if (wantDebug) debugSteps.push({ name: "confirmação_atualizar", reply: msg });
      return persistAndReturn(returnReply(msg));
    }
    if (isRejection(text)) {
      state.pendingUpdate = null;
    }
  }

  // ----- 2. Confirmação de exclusão
  const pendingDel = state.pendingDelete;
  if (pendingDel) {
    if (isConfirmation(text)) {
      try {
        await deleteMeeting(pendingDel.meetingId);
        state.pendingDelete = null;
        const msg = `✅ Reunião "${pendingDel.assunto}" (${pendingDel.dataStr}) foi excluída.`;
        pushToHistory(state, text, msg);
        if (wantDebug) debugSteps.push({ name: "confirmação_excluir", reply: msg });
        return persistAndReturn(returnReply(msg));
      } catch (err) {
        console.error("[telegram-bot] delete meeting error:", err);
        state.pendingDelete = null;
        const errMsg = "Não consegui excluir a reunião. Tente de novo.";
        pushToHistory(state, text, errMsg);
        if (wantDebug) debugSteps.push({ name: "confirmação_excluir", reply: errMsg });
        return persistAndReturn(returnReply(errMsg));
      }
    }
    if (isRejection(text)) {
      state.pendingDelete = null;
    }
  }

  // ----- 3. Escolha pendente (Classificador retornou MULTIPLAS)
  const choice = state.pendingChoice;
  if (choice) {
    const resolved = resolveChoiceToCategory(text, choice.options);
    if (resolved && isRoutableCategory(resolved)) {
      state.pendingChoice = null;
      const ctx = await buildBotContext(chatId, text, state.history, resolved, state.userEmail ?? undefined);
      const result = await runBot(resolved, ctx);
      applyBotResultState(state, result);
      pushToHistory(state, text, result.reply);
      if (wantDebug) debugSteps.push({ name: resolved, reply: result.reply });
      return persistAndReturn(returnReply(result.reply));
    }
    const askAgain = `${choice.reply}\n\nPor favor, escolha uma opção (ex.: 1 ou 2, ou diga "consultar" / "alterar").`;
    pushToHistory(state, text, askAgain);
    if (wantDebug) debugSteps.push({ name: "MULTIPLAS_escolha", reply: askAgain });
    return persistAndReturn(returnReply(askAgain));
  }

  // ----- 4. Bot Classificador: classificar e rotear
  try {
    const classification = await classify(text, state.history);

    if (classification.category === "MULTIPLAS" && classification.options?.length && classification.reply) {
      state.pendingChoice = { options: classification.options, reply: classification.reply };
      pushToHistory(state, text, classification.reply);
      if (wantDebug) debugSteps.push({ name: "classificador (MULTIPLAS)", reply: classification.reply });
      return persistAndReturn(returnReply(classification.reply));
    }

    if (classification.category === "RESPONDER_DIRETO" || classification.category === "NAO_ENTENDI") {
      const reply = classification.reply ?? "Não entendi. Pode reformular?";
      pushToHistory(state, text, reply);
      if (wantDebug) debugSteps.push({ name: `classificador (${classification.category})`, reply });
      return persistAndReturn(returnReply(reply));
    }

    if (isRoutableCategory(classification.category)) {
      const ctx = await buildBotContext(chatId, text, state.history, classification.category, state.userEmail ?? undefined);
      const result = await runBot(classification.category, ctx);
      applyBotResultState(state, result);

      if (result.pendingSave) {
        const key = meetingKey(result.pendingSave.assunto, result.pendingSave.data);
        if (wasAlreadySaved(state, key)) {
          pushToHistory(state, text, result.reply);
          if (wantDebug) debugSteps.push({ name: classification.category, reply: result.reply });
          return persistAndReturn(returnReply(result.reply));
        }
        state.pendingSave = result.pendingSave;
        const dataStr = new Date(result.pendingSave.data + "T12:00:00").toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
        const fullReply = `${result.reply}\n\n📋 Encontrei os dados de uma reunião: **${result.pendingSave.assunto}**, dia ${dataStr}, com ${result.pendingSave.items.length} item(ns). Quer que eu salve no banco? (sim/não)`;
        pushToHistory(state, text, fullReply);
        if (wantDebug) debugSteps.push({ name: classification.category, reply: fullReply });
        return persistAndReturn(returnReply(fullReply));
      }

      pushToHistory(state, text, result.reply);
      if (wantDebug) debugSteps.push({ name: classification.category, reply: result.reply });
      return persistAndReturn(returnReply(result.reply));
    }

    const fallback = classification.reply ?? "Não consegui processar. Tente novamente.";
    pushToHistory(state, text, fallback);
    if (wantDebug) debugSteps.push({ name: `classificador (${classification.category})`, reply: fallback });
    return persistAndReturn(returnReply(fallback));
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const stack = err instanceof Error ? err.stack : undefined;
    console.error("[telegram-bot] Router/Vertex error:", message, stack ?? "");
    const errReply =
      message.includes("403") || message.includes("PERMISSION_DENIED") || message.includes("CONSUMER_INVALID")
        ? "Não foi possível usar o serviço de IA: permissão negada no projeto (Vertex AI / Google Cloud). Verifique no Google Cloud Console se a API Vertex AI está ativada e se as credenciais (OAuth) têm acesso ao projeto."
        : "Desculpe, tive um problema ao processar. Tente de novo em instantes.";
    if (wantDebug) debugSteps.push({ name: "erro", reply: errReply });
    return persistAndReturn(returnReply(errReply));
  }
}

/** Monta o contexto (meetingsBlock, matchingMeeting, forcedInstruction) para o bot especializado. */
async function buildBotContext(
  chatId: number,
  userMessage: string,
  history: ChatMessage[],
  category: Category,
  userEmail?: string
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
    const out = await buildRecentMeetingsContext(userMessage, history, userEmail);
    block = out.block;
    meetings = out.meetings;
  } else {
    const out = await buildConsultaMeetingsBlock(userEmail);
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
  state: ChatState,
  result: { pendingUpdate?: { meetingId: string; assunto: string }; pendingUpdateConfirm?: { meetingId: string; assunto: string }; pendingDelete?: { meetingId: string; assunto: string; dataStr: string } }
): void {
  if (result.pendingUpdate) {
    state.pendingUpdate = result.pendingUpdate;
    state.pendingSave = null;
  }
  if (result.pendingUpdateConfirm) state.pendingUpdateConfirm = result.pendingUpdateConfirm;
  if (result.pendingDelete) state.pendingDelete = result.pendingDelete;
}
