/**
 * Bot Classificador: analisa a mensagem e retorna a categoria para roteamento.
 */

import { generateContent, type ChatMessage } from "@/lib/vertex-ai";
import { loadPrompt, PROMPT_NAMES } from "@/lib/prompts/loader";
import type { ClassifierResponse, Category } from "./types";

const VALID_CATEGORIES: Category[] = [
  "CONSULTA",
  "ALTERACAO",
  "EXCLUSAO",
  "INCLUSAO",
  "RESPONDER_DIRETO",
  "MULTIPLAS",
  "NAO_ENTENDI",
];

function parseClassifierOutput(raw: string): ClassifierResponse | null {
  const cleaned = raw.replace(/^[\s\S]*?\{/, "{").replace(/\}[\s\S]*$/, "}");
  try {
    const parsed = JSON.parse(cleaned) as Record<string, unknown>;
    const category = String(parsed.category ?? "").toUpperCase().replace(/\s/g, "");
    if (!VALID_CATEGORIES.includes(category as Category)) return null;
    const result: ClassifierResponse = { category: category as Category };
    if (parsed.reply && typeof parsed.reply === "string") result.reply = parsed.reply;
    if (Array.isArray(parsed.options)) {
      result.options = (parsed.options as string[])
        .map((o) => String(o).toUpperCase().replace(/\s/g, ""))
        .filter((c) => VALID_CATEGORIES.includes(c as Category)) as Category[];
    }
    return result;
  } catch {
    return null;
  }
}

/**
 * Classifica a intenção do usuário. Retorna a categoria e, se aplicável, reply ou options.
 */
export async function classify(
  userMessage: string,
  history: ChatMessage[]
): Promise<ClassifierResponse> {
  const systemPrompt = loadPrompt(PROMPT_NAMES.CLASSIFICADOR);
  const recent = history.slice(-10);
  const raw = await generateContent({
    userMessage: userMessage.trim() || ".",
    systemPrompt,
    history: recent,
  });
  const parsed = parseClassifierOutput(raw);
  if (parsed) return parsed;
  return {
    category: "NAO_ENTENDI",
    reply: "Não consegui classificar sua mensagem. Pode dizer se quer consultar, alterar, excluir ou incluir alguma reunião ou informação?",
  };
}
