/**
 * Vinculação Telegram User ID ↔ email (conta do app).
 * Coleção telegramLinks: documento ID = telegramUserId (string), campos email e updatedAt.
 * Cliente: salva o vínculo (logado). Webhook: busca email pelo from.id do Telegram.
 */

import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { getDb } from "./firebase";

export const TELEGRAM_LINKS_COLLECTION = "telegramLinks";

/**
 * Salva o vínculo entre um Telegram User ID e o email do usuário logado.
 * Chamar no cliente (Configurações) com o usuário autenticado.
 */
export async function saveTelegramLink(
  telegramUserId: number,
  email: string
): Promise<void> {
  const id = String(telegramUserId);
  if (!id || !email?.trim()) {
    throw new Error("ID do Telegram e e-mail são obrigatórios.");
  }
  const ref = doc(getDb(), TELEGRAM_LINKS_COLLECTION, id);
  await setDoc(ref, {
    email: email.trim(),
    updatedAt: serverTimestamp(),
  });
}

/**
 * Retorna o email vinculado a esse Telegram User ID, ou null se não houver vínculo.
 * Usado no webhook ao receber uma mensagem (body.message.from.id).
 */
export async function getEmailByTelegramUserId(
  telegramUserId: number
): Promise<string | null> {
  const id = String(telegramUserId);
  if (!id) return null;
  const ref = doc(getDb(), TELEGRAM_LINKS_COLLECTION, id);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  const data = snap.data();
  const email = data?.email?.trim();
  return email ?? null;
}
