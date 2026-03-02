/**
 * Bot de Alteração: alterar/editar dados existentes (atas, reuniões).
 */

import { generateContent } from "@/lib/vertex-ai";
import { loadPrompt, PROMPT_NAMES } from "@/lib/prompts/loader";
import type { BotContext, BotResult } from "@/lib/router/types";

export async function runAlteracaoBot(ctx: BotContext): Promise<BotResult> {
  const systemPrompt = loadPrompt(PROMPT_NAMES.ALTERACAO);
  const instruction = ctx.forcedInstruction ? `${ctx.forcedInstruction}\n\n` : "";
  const fullPrompt = `${instruction}${systemPrompt}\n\n[REUNIÕES NO BANCO]\n${ctx.meetingsBlock}`;
  const reply = await generateContent({
    userMessage: ctx.userMessage,
    history: ctx.history,
    systemPrompt: fullPrompt,
  });
  const result: BotResult = { reply };
  if (ctx.matchingMeeting?.id) {
    result.pendingUpdate = {
      meetingId: ctx.matchingMeeting.id,
      assunto: ctx.matchingMeeting.assunto ?? "",
    };
  }
  return result;
}
