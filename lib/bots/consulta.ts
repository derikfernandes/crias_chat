/**
 * Bot de Consulta: consultar reuniões, agendas e dados salvos.
 */

import { generateContent } from "@/lib/vertex-ai";
import { loadPrompt, PROMPT_NAMES } from "@/lib/prompts/loader";
import type { BotContext, BotResult } from "@/lib/router/types";

export async function runConsultaBot(ctx: BotContext): Promise<BotResult> {
  const systemPrompt = loadPrompt(PROMPT_NAMES.CONSULTA);
  const fullPrompt = `${systemPrompt}\n\n[REUNIÕES NO BANCO]\n${ctx.meetingsBlock}`;
  const reply = await generateContent({
    userMessage: ctx.userMessage,
    history: ctx.history,
    systemPrompt: fullPrompt,
  });
  return { reply };
}
