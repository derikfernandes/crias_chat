/**
 * Bot de Exclusão: excluir reuniões e registros.
 */

import { generateContent } from "@/lib/vertex-ai";
import { loadPrompt, PROMPT_NAMES } from "@/lib/prompts/loader";
import { formatMeetingDateStr } from "@/lib/meetings";
import type { BotContext, BotResult } from "@/lib/router/types";

export async function runExclusaoBot(ctx: BotContext): Promise<BotResult> {
  const systemPrompt = loadPrompt(PROMPT_NAMES.EXCLUSAO);
  const fullPrompt = `${systemPrompt}\n\n[REUNIÕES NO BANCO]\n${ctx.meetingsBlock}`;
  const reply = await generateContent({
    userMessage: ctx.userMessage,
    history: ctx.history,
    systemPrompt: fullPrompt,
  });
  const result: BotResult = { reply };
  if (ctx.matchingMeeting?.id) {
    result.pendingDelete = {
      meetingId: ctx.matchingMeeting.id,
      assunto: ctx.matchingMeeting.assunto ?? "",
      dataStr: formatMeetingDateStr(ctx.matchingMeeting),
    };
  }
  return result;
}
