/**
 * Acesso ao Firestore: reuniões e itens por reunião.
 * Coleção "meetings" com subcoleção "items".
 */

import {
  collection,
  doc,
  addDoc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  query,
  orderBy,
  serverTimestamp,
  Timestamp,
  type DocumentReference,
  type CollectionReference,
} from "firebase/firestore";
import { getDb } from "./firebase";
import type { Meeting, MeetingItem, MeetingCreate, MeetingItemCreate } from "./firestore-types";

const MEETINGS = "meetings";
const ITEMS = "items";

function meetingsCol() {
  return collection(getDb(), MEETINGS) as CollectionReference<Meeting>;
}

function meetingRef(id: string): DocumentReference<Meeting> {
  return doc(getDb(), MEETINGS, id) as DocumentReference<Meeting>;
}

function itemsCol(meetingId: string) {
  return collection(getDb(), MEETINGS, meetingId, ITEMS);
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

/** Cria uma nova reunião e retorna o id. */
export async function createMeeting(data: MeetingCreate): Promise<string> {
  const payload = {
    assunto: data.assunto,
    data: toFirestoreDate(data.data),
    ...(data.textoCompleto != null && data.textoCompleto !== "" && { textoCompleto: data.textoCompleto }),
    createdAt: serverTimestamp(),
    updatedAt: serverTimestamp(),
  };
  const ref = await addDoc(meetingsCol(), payload);
  return ref.id;
}

/** Busca uma reunião por id. */
export async function getMeeting(id: string): Promise<Meeting | null> {
  const snap = await getDoc(meetingRef(id));
  if (!snap.exists()) return null;
  return { id: snap.id, ...snap.data() } as Meeting;
}

/** Lista reuniões (todas ou filtradas por assunto/data conforme precisar). */
export async function listMeetings(): Promise<Meeting[]> {
  const q = query(meetingsCol(), orderBy("data", "desc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Meeting));
}

/** Converte campo data do Firestore para Date. */
function meetingDate(m: Meeting): Date {
  const d = m.data;
  if (d instanceof Date) return d;
  if (d && typeof (d as { toDate?: () => Date }).toDate === "function") return (d as { toDate: () => Date }).toDate();
  if (typeof d === "string") return new Date(d);
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

/** Formata uma reunião para exibição (ex.: contexto da IA). */
export function formatMeetingForContext(m: Meeting): string {
  const dataStr = formatMeetingDateStr(m);
  const conteudo = (m.textoCompleto || "(sem conteúdo ainda)").trim();
  const preview = conteudo.length > 600 ? conteudo.slice(0, 600) + "…" : conteudo;
  return `• Assunto: "${m.assunto}" | Dia: ${dataStr}\n  O que já temos: ${preview}`;
}

/** Lista reuniões dos últimos N dias (fallback quando não há data na conversa). */
export async function listMeetingsRecent(days: number): Promise<Meeting[]> {
  const all = await listMeetings();
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
  windowDays: number = 1
): Promise<Meeting[]> {
  const all = await listMeetings();
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

/** Adiciona um item a uma reunião. */
export async function addMeetingItem(
  meetingId: string,
  data: MeetingItemCreate
): Promise<string> {
  const col = itemsCol(meetingId);
  const payload = {
    ...data,
    createdAt: serverTimestamp(),
  };
  const ref = await addDoc(col, payload);
  return ref.id;
}

/** Lista itens de uma reunião (ordenados por order). */
export async function listMeetingItems(meetingId: string): Promise<MeetingItem[]> {
  const col = itemsCol(meetingId);
  const q = query(col, orderBy("order", "asc"));
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MeetingItem));
}

/** Atualiza um item. */
export async function updateMeetingItem(
  meetingId: string,
  itemId: string,
  data: Partial<Pick<MeetingItem, "content" | "order">>
): Promise<void> {
  const ref = doc(getDb(), MEETINGS, meetingId, ITEMS, itemId);
  await updateDoc(ref, data);
}

/** Remove um item. */
export async function deleteMeetingItem(
  meetingId: string,
  itemId: string
): Promise<void> {
  const ref = doc(getDb(), MEETINGS, meetingId, ITEMS, itemId);
  await deleteDoc(ref);
}
