/**
 * Gestão de administradores da aplicação.
 * Usa o documento único "config/admins" com campo { emails: string[] }.
 * O e-mail SUPER_ADMIN_EMAIL é sempre admin e não pode ser removido.
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export const SUPER_ADMIN_EMAIL = "derikluizfernandes@gmail.com";

const CONFIG_ADMINS_PATH = "config/admins";

type AdminsDoc = {
  emails?: string[];
};

/** Lê a lista de e-mails de admin do Firestore (normalizados em minúsculo). */
export async function getAdminEmails(): Promise<string[]> {
  const snap = await getDoc(doc(getDb(), CONFIG_ADMINS_PATH));
  const data = snap.data() as AdminsDoc | undefined;
  const list = Array.isArray(data?.emails) ? data.emails! : [];
  return list.map((e) => String(e).trim().toLowerCase()).filter(Boolean);
}

async function setAdminEmails(emails: string[]): Promise<void> {
  const normalized = Array.from(
    new Set(emails.map((e) => String(e).trim().toLowerCase()).filter(Boolean))
  );
  await setDoc(doc(getDb(), CONFIG_ADMINS_PATH), { emails: normalized });
}

/** Verifica se o e-mail informado é admin (inclui o super admin). */
export function isAdminEmail(
  email: string | null | undefined,
  adminEmails: string[]
): boolean {
  const e = (email ?? "").trim().toLowerCase();
  if (!e) return false;
  if (e === SUPER_ADMIN_EMAIL.toLowerCase()) return true;
  return adminEmails.includes(e);
}

/** Adiciona um e-mail à lista de admins (se ainda não estiver). */
export async function addAdmin(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e) return;
  const list = await getAdminEmails();
  if (list.includes(e)) return;
  await setAdminEmails([...list, e]);
}

/** Remove um e-mail da lista (não remove o super admin). */
export async function removeAdmin(email: string): Promise<void> {
  const e = email.trim().toLowerCase();
  if (!e || e === SUPER_ADMIN_EMAIL.toLowerCase()) return;
  const list = await getAdminEmails();
  await setAdminEmails(list.filter((x) => x !== e));
}

