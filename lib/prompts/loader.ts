/**
 * Carrega o conteúdo de um arquivo de prompt em lib/prompts.
 * Usado em ambiente Node (API routes).
 */

import { readFileSync } from "fs";
import path from "path";

const PROMPTS_DIR = "lib/prompts";

export function loadPrompt(name: string): string {
  const baseDir = process.cwd();
  const filePath = path.join(baseDir, PROMPTS_DIR, `${name}.txt`);
  try {
    return readFileSync(filePath, "utf-8").trim();
  } catch (err) {
    console.error(`[prompts] Failed to load ${name}.txt:`, err);
    throw new Error(`Prompt não encontrado: ${name}`);
  }
}

export const PROMPT_NAMES = {
  CLASSIFICADOR: "classificador",
  CONSULTA: "consulta",
  ALTERACAO: "alteracao",
  EXCLUSAO: "exclusao",
  INCLUSAO: "inclusao",
} as const;
