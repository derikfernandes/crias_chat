/**
 * Tipos e estrutura do Firestore: reuniões por assunto e data, com itens.
 *
 * Estrutura:
 * - Coleção "meetings" (reuniões)
 *   - Campos: assunto, data, createdAt, updatedAt
 *   - Subcoleção "items" (itens da reunião)
 *     - Campos: content, order, createdAt, type, actionStatus, actionNote, actionDueDate
 */

import type { Timestamp } from "firebase/firestore";

export interface MeetingItem {
  id?: string;
  content: string;
  order: number;
  /** E-mail do usuário dono do registro (vinculação ao cadastro logado) */
  userEmail?: string;
  createdAt?: Timestamp | Date;
  /** Tipo do item: anotação normal da reunião ou ação vinculada. */
  type?: "note" | "action";
  /** Status da ação (apenas quando type === "action"). */
  actionStatus?: "open" | "done" | "cancelled";
  /** Comentário curto sobre o andamento da ação. */
  actionNote?: string;
  /** Prazo opcional da ação. */
  actionDueDate?: Timestamp | Date | string;
}

export interface Meeting {
  id?: string;
  /** Assunto/categoria da reunião (ex: "Sprint Planning", "1:1") */
  assunto: string;
  /** Data (e opcionalmente hora) da reunião */
  data: Timestamp | Date | string;
  /** Texto completo da reunião (conteúdo bruto/compilado da conversa) */
  textoCompleto?: string;
  /** E-mail do usuário dono do registro (vinculação ao cadastro logado) */
  userEmail?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/** Dados para criar uma nova reunião (sem id e timestamps). */
export type MeetingCreate = Omit<Meeting, "id" | "createdAt" | "updatedAt">;

/** Dados para criar um item (sem id e createdAt). */
export type MeetingItemCreate = Omit<MeetingItem, "id" | "createdAt">;
