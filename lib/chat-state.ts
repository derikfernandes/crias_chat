/**
 * Persistência do estado do chat (histórico + pendentes) no Firestore.
 * Coleção: chatState. Document ID: chatId (string).
 * Garante que o bot funcione corretamente em ambiente serverless (várias instâncias).
 */

import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  serverTimestamp,
  collection,
  query,
  where,
  limit,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { ChatMessage } from "@/lib/vertex-ai";
import type { Category } from "@/lib/router";

const COLLECTION = "chatState";
const MAX_HISTORY = 20;
const MAX_SAVED_KEYS_PER_CHAT = 10;

export interface PendingSave {
  assunto: string;
  data: string;
  textoCompleto?: string;
  items: string[];
}

export interface PendingUpdate {
  meetingId: string;
  assunto: string;
}

export interface PendingDelete {
  meetingId: string;
  assunto: string;
  dataStr: string;
}

export interface PendingChoice {
  options: Category[];
  reply: string;
}

/** Estado do chat: histórico e pendentes. Mutável; após alterar, chamar saveChatState. */
export interface ChatState {
  /** E-mail do usuário vinculado a este chat (login cadastrado). Novas reuniões usam este e-mail. */
  userEmail?: string | null;
  history: ChatMessage[];
  savedMeetingKeys: string[];
  pendingSave: PendingSave | null;
  pendingUpdate: PendingUpdate | null;
  pendingUpdateConfirm: PendingUpdate | null;
  pendingDelete: PendingDelete | null;
  pendingChoice: PendingChoice | null;
}

function emptyState(): ChatState {
  return {
    userEmail: null,
    history: [],
    savedMeetingKeys: [],
    pendingSave: null,
    pendingUpdate: null,
    pendingUpdateConfirm: null,
    pendingDelete: null,
    pendingChoice: null,
  };
}

/** Formato do documento no Firestore (serializável). */
interface ChatStateDoc {
  chatId: number;
  /** E-mail do usuário dono do registro (vinculação ao cadastro logado) */
  userEmail?: string;
  history: ChatMessage[];
  savedMeetingKeys: string[];
  pendingSave: PendingSave | null;
  pendingUpdate: PendingUpdate | null;
  pendingUpdateConfirm: PendingUpdate | null;
  pendingDelete: PendingDelete | null;
  pendingChoice: PendingChoice | null;
  updatedAt: ReturnType<typeof serverTimestamp>;
}

function docToState(docData: ChatStateDoc): ChatState {
  return {
    userEmail: docData.userEmail?.trim() ?? null,
    history: Array.isArray(docData.history) ? docData.history : [],
    savedMeetingKeys: Array.isArray(docData.savedMeetingKeys) ? docData.savedMeetingKeys : [],
    pendingSave: docData.pendingSave ?? null,
    pendingUpdate: docData.pendingUpdate ?? null,
    pendingUpdateConfirm: docData.pendingUpdateConfirm ?? null,
    pendingDelete: docData.pendingDelete ?? null,
    pendingChoice: docData.pendingChoice ?? null,
  };
}

/**
 * Carrega o estado do chat do Firestore. Se não existir, retorna estado vazio.
 * Para o test-bot, use docIdOverride (ex.: "999999-email@...") para isolar histórico por usuário.
 * Se docIdOverride for usado e esse documento não existir, tenta o doc legado (só chatId) para
 * quem já tinha histórico no test-bot antes do isolamento por e-mail.
 */
export async function getChatState(
  chatId: number,
  docIdOverride?: string
): Promise<ChatState> {
  const docId = docIdOverride?.trim() || String(chatId);
  const ref = doc(getDb(), COLLECTION, docId);
  const snap = await getDoc(ref);
  if (snap.exists()) {
    const data = snap.data() as ChatStateDoc;
    return docToState(data);
  }
  if (docIdOverride?.trim()) {
    const legacyRef = doc(getDb(), COLLECTION, String(chatId));
    const legacySnap = await getDoc(legacyRef);
    if (legacySnap.exists()) {
      const data = legacySnap.data() as ChatStateDoc;
      return docToState(data);
    }
  }
  return emptyState();
}

export interface ChatStateResult {
  state: ChatState;
  saveDocId: string;
}

/**
 * Busca o estado do chat pelo e-mail do login e chatId (query em userEmail).
 * Usado no test-bot para retornar apenas o chat desse usuário.
 */
export async function getChatStateByUserEmail(
  chatId: number,
  userEmail: string
): Promise<ChatStateResult> {
  const email = userEmail?.trim();
  if (!email) {
    return { state: emptyState(), saveDocId: String(chatId) };
  }
  const colRef = collection(getDb(), COLLECTION);
  const q = query(
    colRef,
    where("userEmail", "==", email),
    where("chatId", "==", chatId),
    limit(1)
  );
  const snap = await getDocs(q);
  if (!snap.empty) {
    const d = snap.docs[0];
    const data = d.data() as ChatStateDoc;
    return { state: docToState(data), saveDocId: d.id };
  }
  return { state: emptyState(), saveDocId: `${chatId}-${email}` };
}

/**
 * Garante que history e savedMeetingKeys não excedem os limites antes de salvar.
 */
function trimState(state: ChatState): void {
  if (state.history.length > MAX_HISTORY) {
    state.history = state.history.slice(-MAX_HISTORY);
  }
  if (state.savedMeetingKeys.length > MAX_SAVED_KEYS_PER_CHAT) {
    state.savedMeetingKeys = state.savedMeetingKeys.slice(-MAX_SAVED_KEYS_PER_CHAT);
  }
}

/**
 * Salva o estado do chat no Firestore.
 * Para o test-bot, use docIdOverride (ex.: "999999-email@...") para isolar histórico por usuário.
 */
export async function saveChatState(
  chatId: number,
  state: ChatState,
  docIdOverride?: string
): Promise<void> {
  trimState(state);
  const docId = docIdOverride?.trim() || String(chatId);
  const ref = doc(getDb(), COLLECTION, docId);
  const payload: ChatStateDoc = {
    chatId,
    ...(state.userEmail != null && state.userEmail !== "" && { userEmail: state.userEmail }),
    history: state.history,
    savedMeetingKeys: state.savedMeetingKeys,
    pendingSave: state.pendingSave,
    pendingUpdate: state.pendingUpdate,
    pendingUpdateConfirm: state.pendingUpdateConfirm,
    pendingDelete: state.pendingDelete,
    pendingChoice: state.pendingChoice,
    updatedAt: serverTimestamp(),
  };
  await setDoc(ref, payload, { merge: true });
}

export { MAX_HISTORY as CHAT_STATE_MAX_HISTORY, MAX_SAVED_KEYS_PER_CHAT as CHAT_STATE_MAX_SAVED_KEYS };
