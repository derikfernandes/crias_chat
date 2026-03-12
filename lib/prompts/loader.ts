/**
 * Prompts dos bots armazenados no Firestore.
 * Fonte única da verdade: sempre lê/escreve na coleção "prompts".
 */

import { doc, getDoc, setDoc } from "firebase/firestore";
import { getDb } from "@/lib/firebase";

export const PROMPT_NAMES = {
  CLASSIFICADOR: "classificador",
  CONSULTA: "consulta",
  ALTERACAO: "alteracao",
  EXCLUSAO: "exclusao",
  INCLUSAO: "inclusao",
} as const;

type PromptName = (typeof PROMPT_NAMES)[keyof typeof PROMPT_NAMES] | string;

/**
 * Lê o prompt pelo nome a partir do Firestore.
 * Lança erro se o documento não existir ou estiver vazio.
 */
export async function loadPrompt(name: PromptName): Promise<string> {
  const db = getDb();
  const ref = doc(db, "prompts", name);
  const snap = await getDoc(ref);
  const content = snap.data()?.content;
  if (typeof content === "string" && content.trim()) {
    return content.trim();
  }
  throw new Error(
    `Prompt "${name}" não encontrado no Firestore. Crie/edite este prompt na página de admin.`
  );
}

/** Alias semântico para leitura (pode ser usado na página de admin). */
export async function getPrompt(name: PromptName): Promise<string> {
  return loadPrompt(name);
}

/** Salva/atualiza o conteúdo de um prompt no Firestore. */
export async function setPrompt(name: PromptName, content: string): Promise<void> {
  const db = getDb();
  const ref = doc(db, "prompts", name);
  await setDoc(ref, { content: (content ?? "").trim() });
}
