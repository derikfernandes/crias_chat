/**
 * Bot de Inclusão: criar/salvar novas reuniões e registros.
 */

import { generateContent, extractMeetingFromHistory } from "@/lib/vertex-ai";
import { loadPrompt, PROMPT_NAMES } from "@/lib/prompts/loader";
import type { BotContext, BotResult } from "@/lib/router/types";

function normalizeExtractedDate(dateStr: string): string {
  const match = dateStr.trim().match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (!match) return dateStr;
  const [, yearStr, month, day] = match;
  const year = parseInt(yearStr!, 10);
  const currentYear = new Date().getFullYear();
  if (year < currentYear) {
    return `${currentYear}-${month}-${day}${dateStr.slice(match[0].length)}`;
  }
  return dateStr;
}

export async function runInclusaoBot(ctx: BotContext): Promise<BotResult> {
  const systemPrompt = loadPrompt(PROMPT_NAMES.INCLUSAO);
  const fullPrompt = `${systemPrompt}\n\n[REUNIÕES NO BANCO]\n${ctx.meetingsBlock}`;
  const reply = await generateContent({
    userMessage: ctx.userMessage,
    history: ctx.history,
    systemPrompt: fullPrompt,
  });
  const result: BotResult = { reply };

  const historyWithLatest = [
    ...ctx.history,
    { role: "user" as const, text: ctx.userMessage },
    { role: "model" as const, text: reply },
  ];
  const extracted = await extractMeetingFromHistory(historyWithLatest);
  if (
    extracted.hasCompleteMeeting &&
    extracted.assunto?.trim() &&
    extracted.data &&
    extracted.items?.length
  ) {
    const dataNormalizada = normalizeExtractedDate(extracted.data);
    result.pendingSave = {
      assunto: extracted.assunto.trim(),
      data: dataNormalizada,
      textoCompleto: extracted.textoCompleto?.trim(),
      items: extracted.items.map((x) => x.trim()),
    };
  }
  return result;
}
