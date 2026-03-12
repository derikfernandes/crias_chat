/**
 * Acesso ao Firestore: reuniões e itens por reunião.
 * Coleção "meetings" com subcoleção "items".
 */

import {
  collection,
  doc,
  addDoc,
  getDocFromServer,
  getDocsFromServer,
  updateDoc,
  deleteDoc,
  deleteField,
  query,
  where,
  orderBy,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
  type CollectionReference,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type {
  Meeting,
  MeetingItem,
  MeetingCreate,
  MeetingItemCreate,
  MeetingItemComment,
  MeetingItemCommentCreate,
} from "./firestore-types";

const MEETINGS = "meetings";
const ITEMS = "items";
const COMMENTS = "comments";

/** Usado apenas na migração de dados existentes (derikluizfernandes@gmail.com). Novas reuniões exigem o e-mail do login. */
export const MIGRATION_USER_EMAIL = "derikluizfernandes@gmail.com";

export function getDefaultUserEmail(): string {
  return process.env.USER_EMAIL?.trim() || MIGRATION_USER_EMAIL;
}

function meetingsCol() {
  return collection(getDb(), MEETINGS) as CollectionReference<Meeting>;
}

function meetingRef(id: string): DocumentReference<Meeting> {
  return doc(getDb(), MEETINGS, id) as DocumentReference<Meeting>;
}

function itemsCol(meetingId: string) {
  return collection(getDb(), MEETINGS, meetingId, ITEMS);
}

function itemCommentsCol(meetingId: string, itemId: string) {
  return collection(
    getDb(),
    MEETINGS,
    meetingId,
    ITEMS,
    itemId,
    COMMENTS
  ) as CollectionReference<MeetingItemComment>;
}

/**
 * Converte valor para Date/Timestamp. Datas só com dia (YYYY-MM-DD) são tratadas
 * como meio-dia UTC para evitar que, em UTC-3, apareçam como o dia anterior (ex.: 27/02 → 26/02 21h).
 */
function toFirestoreDate(value: MeetingCreate["data"]): Timestamp | Date {
  if (value instanceof Date) return value;
  if (value instanceof Timestamp) return value;
  const str = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    return Timestamp.fromDate(new Date(`${str}T12:00:00.000Z`));
  }
  return Timestamp.fromDate(new Date(str));
}

/** Cria uma nova reunião e retorna o id. Exige userEmail do usuário logado/vinculado (não use e-mail fixo para novas reuniões). */
export async function createMeeting(data: MeetingCreate): Promise<string> {
  const userEmail = data.userEmail?.trim();
  if (!userEmail) {
    throw new Error("userEmail é obrigatório para novas reuniões (use o e-mail do login cadastrado).");
  }
  const payload = {
    assunto: data.assunto,
    data: toFirestoreDate(data.data),
    ...(data.textoCompleto != null && data.textoCompleto !== "" && { textoCompleto: data.textoCompleto }),
    userEmail,
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(meetingsCol(), payload);
  return ref.id;
}

/** Busca uma reunião por id. Sempre do servidor (sem cache). */
export async function getMeeting(id: string): Promise<Meeting | null> {
  const snap = await getDocFromServer(meetingRef(id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Meeting;
}

/** Lista reuniões do usuário (sempre do servidor, sem cache). Sem userEmail retorna [] (chat não vinculado). */
export async function listMeetings(userEmail?: string): Promise<Meeting[]> {
  const email = userEmail?.trim();
  if (!email) return [];
  const q = query(
    meetingsCol(),
    where("userEmail", "==", email),
    orderBy("data", "desc")
  );
  const snap = await getDocsFromServer(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));
}

/** Converte campo data do Firestore para Date. */
function meetingDate(m: Meeting): Date {
  const d = m.data as
    | Date
    | string
    | { toDate?: () => Date; seconds?: number; nanoseconds?: number }
    | null
    | undefined;
  if (d instanceof Date) return d;
  if (d && typeof (d as any).toDate === "function") {
    return (d as { toDate: () => Date }).toDate();
  }
  if (d && typeof (d as any).seconds === "number") {
    const ts = d as { seconds: number; nanoseconds?: number };
    return new Date(ts.seconds * 1000 + (ts.nanoseconds ?? 0) / 1_000_000);
  }
  if (typeof d === "string") {
    const parsed = new Date(d);
    return Number.isNaN(parsed.getTime()) ? new Date(0) : parsed;
  }
  return new Date(0);
}

/** Formata a data de uma reunião para exibição (pt-BR). */
export function formatMeetingDateStr(m: Meeting): string {
  return meetingDate(m).toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

/** Formata uma reunião para exibição (ex.: contexto da IA). Sem limitação de tamanho. */
export function formatMeetingForContext(m: Meeting): string {
  const dataStr = formatMeetingDateStr(m);
  const conteudo = (m.textoCompleto || "(sem conteúdo ainda)").trim();
  return `• Assunto: "${m.assunto}" | Dia: ${dataStr}\n  O que já temos: ${conteudo}`;
}

/** Lista reuniões dos últimos N dias (fallback quando não há data na conversa). */
export async function listMeetingsRecent(days: number, userEmail?: string): Promise<Meeting[]> {
  const all = await listMeetings(userEmail);
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);
  cutoff.setHours(0, 0, 0, 0);
  return all.filter((m) => meetingDate(m) >= cutoff);
}

/** Retorna apenas a parte "dia" em horário local (evita problema de timezone). */
function toLocalDateOnly(d: Date): { y: number; m: number; day: number } {
  return { y: d.getFullYear(), m: d.getMonth(), day: d.getDate() };
}

function isSameDay(a: Date, b: Date): boolean {
  const x = toLocalDateOnly(a);
  const y = toLocalDateOnly(b);
  return x.y === y.y && x.m === y.m && x.day === y.day;
}

function isWithinDays(localDay: { y: number; m: number; day: number }, center: Date, windowDays: number): boolean {
  const centerStart = new Date(center.getFullYear(), center.getMonth(), center.getDate(), 0, 0, 0, 0);
  const start = new Date(centerStart);
  start.setDate(start.getDate() - windowDays);
  const end = new Date(centerStart);
  end.setDate(end.getDate() + windowDays);
  const d = new Date(localDay.y, localDay.m, localDay.day, 0, 0, 0, 0);
  return d >= start && d <= end;
}

/** Lista reuniões próximas a uma data (ex.: dia da reunião que o usuário está inputando). Comparação por dia local. */
export async function listMeetingsNearDate(
  date: Date,
  windowDays: number = 1,
  userEmail?: string
): Promise<Meeting[]> {
  const all = await listMeetings(userEmail);
  const center = new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12, 0, 0, 0);
  return all.filter((m) => {
    const d = meetingDate(m);
    const local = toLocalDateOnly(d);
    return isWithinDays(local, center, windowDays);
  });
}

/** Atualiza uma reunião existente (assunto, data e/ou textoCompleto). */
export async function updateMeeting(
  id: string,
  data: Partial<Pick<Meeting, "assunto" | "data" | "textoCompleto">>
): Promise<void> {
  const payload: Record<string, unknown> = { updatedAt: serverTimestamp() };
  if (data.assunto !== undefined) payload.assunto = data.assunto;
  if (data.data !== undefined) payload.data = data.data instanceof Date ? data.data : toFirestoreDate(data.data);
  if (data.textoCompleto !== undefined) payload.textoCompleto = data.textoCompleto;
  await updateDoc(meetingRef(id), payload);
}

/** Remove uma reunião (e você pode apagar itens antes se quiser). */
export async function deleteMeeting(id: string): Promise<void> {
  await deleteDoc(meetingRef(id));
}

/** Adiciona um item a uma reunião. Exige userEmail do usuário logado/vinculado. */
export async function addMeetingItem(
  meetingId: string,
  data: MeetingItemCreate
): Promise<string> {
  const userEmail = data.userEmail?.trim();
  if (!userEmail) {
    throw new Error("userEmail é obrigatório ao adicionar itens (use o e-mail do login cadastrado).");
  }
  const col = itemsCol(meetingId);
  const payload = {
    ...data,
    userEmail,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(col, payload);
  return ref.id;
}

/** Lista itens de uma reunião (ordenados por order). Sempre do servidor (sem cache). */
export async function listMeetingItems(meetingId: string): Promise<MeetingItem[]> {
  const col = itemsCol(meetingId);
  const q = query(col, orderBy("order", "asc"));
  const snap = await getDocsFromServer(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingItem));
}

/** Atualiza um item. */
export async function updateMeetingItem(
  meetingId: string,
  itemId: string,
  data: Partial<
    Pick<
      MeetingItem,
      "content" | "order" | "type" | "actionStatus" | "actionNote" | "actionOwners"
    >
  > & {
    actionDueDate?: MeetingItem["actionDueDate"] | null;
  }
): Promise<void> {
  const ref = doc(getDb(), MEETINGS, meetingId, ITEMS, itemId);
  const payload: Record<string, unknown> = {};
  if (data.content !== undefined) payload.content = data.content;
  if (data.order !== undefined) payload.order = data.order;
  if (data.type !== undefined) payload.type = data.type;
  if (data.actionStatus !== undefined) payload.actionStatus = data.actionStatus;
  if (data.actionNote !== undefined) payload.actionNote = data.actionNote;
  if (data.actionOwners !== undefined) payload.actionOwners = data.actionOwners;
  if (data.actionDueDate !== undefined) {
    payload.actionDueDate =
      data.actionDueDate === null ? deleteField() : data.actionDueDate;
  }
  if (Object.keys(payload).length === 0) return;
  await updateDoc(ref, payload);
}

/** Remove um item. */
export async function deleteMeetingItem(
  meetingId: string,
  itemId: string
): Promise<void> {
  const ref = doc(getDb(), MEETINGS, meetingId, ITEMS, itemId);
  await deleteDoc(ref);
}

/** Adiciona um comentário a um item de reunião (ação). */
export async function addMeetingItemComment(
  meetingId: string,
  itemId: string,
  data: MeetingItemCommentCreate
): Promise<string> {
  const col = itemCommentsCol(meetingId, itemId);
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(col, payload);
  return ref.id;
}

/** Lista comentários de um item de reunião (ordenados por createdAt). */
export async function listMeetingItemComments(
  meetingId: string,
  itemId: string
): Promise<MeetingItemComment[]> {
  const col = itemCommentsCol(meetingId, itemId);
  const q = query(col, orderBy("createdAt", "asc"));
  const snap = await getDocsFromServer(q);
  return snap.docs.map(
    (d) => ({ id: d.id, ...d.data() } as MeetingItemComment)
  );
}

/** Atualiza um comentário de item de reunião (apenas conteúdo por enquanto). */
export async function updateMeetingItemComment(
  meetingId: string,
  itemId: string,
  commentId: string,
  data: Partial<Pick<MeetingItemComment, "content">>
): Promise<void> {
  const ref = doc(
    getDb(),
    MEETINGS,
    meetingId,
    ITEMS,
    itemId,
    COMMENTS,
    commentId
  );
  const payload: Record<string, unknown> = {};
  if (data.content !== undefined) payload.content = data.content;
  if (Object.keys(payload).length === 0) return;
  await updateDoc(ref, payload);
}

/** Remove um comentário de item de reunião. */
export async function deleteMeetingItemComment(
  meetingId: string,
  itemId: string,
  commentId: string
): Promise<void> {
  const ref = doc(
    getDb(),
    MEETINGS,
    meetingId,
    ITEMS,
    itemId,
    COMMENTS,
    commentId
  );
  await deleteDoc(ref);
}
