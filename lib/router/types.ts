/**
 * Tipos do roteador (AI Router Pattern).
 */

import type { ChatMessage } from "@/lib/vertex-ai";
import type { Meeting } from "@/lib/firestore-types";

export type Category =
  | "CONSULTA"
  | "ALTERACAO"
  | "EXCLUSAO"
  | "INCLUSAO"
  | "RESPONDER_DIRETO"
  | "MULTIPLAS"
  | "NAO_ENTENDI";

export interface ClassifierResponse {
  category: Category;
  options?: Category[];
  reply?: string;
}

/** Contexto passado para cada bot especializado. */
export interface BotContext {
  chatId: number;
  userMessage: string;
  history: ChatMessage[];
  /** Bloco de texto com reuniões para o prompt (ex.: [REUNIÕES NO BANCO]). */
  meetingsBlock: string;
  /** Reuniões carregadas (para match, listagem, etc.). */
  meetings: Meeting[];
  /** Reunião que corresponde à mensagem do usuário (se houver). */
  matchingMeeting: Meeting | null;
  /** Instrução extra quando há match (ex.: "Quer atualizar?"). */
  forcedInstruction?: string;
}

/** Resultado de um bot especializado: resposta e opcionalmente estado pendente. */
export interface BotResult {
  reply: string;
  pendingSave?: {
    assunto: string;
    data: string;
    textoCompleto?: string;
    items: string[];
  };
  pendingUpdate?: { meetingId: string; assunto: string };
  pendingUpdateConfirm?: { meetingId: string; assunto: string };
  pendingDelete?: { meetingId: string; assunto: string; dataStr: string };
}
