/**
 * Tipos e estrutura do Firestore: reuniões por assunto e data, com itens.
 *
 * Estrutura:
 * - Coleção "meetings" (reuniões)
 *   - Campos: assunto, data, createdAt, updatedAt
 *   - Subcoleção "items" (itens da reunião)
 *     - Campos: content, order, createdAt
 */

import type { Timestamp } from "firebase/firestore";

export interface MeetingItem {
  id?: string;
  content: string;
  order: number;
  createdAt?: Timestamp | Date;
}

export interface Meeting {
  id?: string;
  /** Assunto/categoria da reunião (ex: "Sprint Planning", "1:1") */
  assunto: string;
  /** Data (e opcionalmente hora) da reunião */
  data: Timestamp | Date | string;
  /** Texto completo da reunião (conteúdo bruto/compilado da conversa) */
  textoCompleto?: string;
  createdAt?: Timestamp | Date;
  updatedAt?: Timestamp | Date;
}

/** Dados para criar uma nova reunião (sem id e timestamps). */
export type MeetingCreate = Omit<Meeting, "id" | "createdAt" | "updatedAt">;

/** Dados para criar um item (sem id e createdAt). */
export type MeetingItemCreate = Omit<MeetingItem, "id" | "createdAt">;
