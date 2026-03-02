/**
 * AI Router: despacha para o bot especializado conforme a categoria.
 */

import { classify } from "./classifier";
import { runConsultaBot } from "@/lib/bots/consulta";
import { runAlteracaoBot } from "@/lib/bots/alteracao";
import { runExclusaoBot } from "@/lib/bots/exclusao";
import { runInclusaoBot } from "@/lib/bots/inclusao";
import { formatMeetingDateStr } from "@/lib/meetings";
import type { BotContext, BotResult, Category } from "./types";

export type { ClassifierResponse, BotContext, BotResult, Category } from "./types";
export { classify } from "./classifier";

const ROUTABLE_CATEGORIES: Category[] = ["CONSULTA", "ALTERACAO", "EXCLUSAO", "INCLUSAO"];

export function isRoutableCategory(category: Category): boolean {
  return ROUTABLE_CATEGORIES.includes(category);
}

/**
 * Executa o bot especializado correspondente à categoria e retorna a resposta + estado pendente (se houver).
 */
export async function runBot(category: Category, ctx: BotContext): Promise<BotResult> {
  switch (category) {
    case "CONSULTA":
      return runConsultaBot(ctx);
    case "ALTERACAO":
      return runAlteracaoBot(ctx);
    case "EXCLUSAO":
      return runExclusaoBotWithConfirmation(ctx);
    case "INCLUSAO":
      return runInclusaoBot(ctx);
    default:
      return {
        reply: "Não foi possível processar. Tente dizer se quer consultar, alterar, excluir ou incluir algo.",
      };
  }
}

/** Bot de exclusão: se houver reunião identificada, mensagem de confirmação clara. */
async function runExclusaoBotWithConfirmation(ctx: BotContext): Promise<BotResult> {
  const result = await runExclusaoBot(ctx);
  if (result.pendingDelete) {
    result.reply = `Quer mesmo excluir a reunião "${result.pendingDelete.assunto}" do dia ${result.pendingDelete.dataStr}? Responda sim ou não.`;
  }
  return result;
}

/**
 * Para ALTERACAO com reunião correspondente: primeiro "sim" deve pedir confirmação para salvar.
 * O bot de alteração já retorna pendingUpdate; o orquestrador deve tratar o segundo "sim" como pendingUpdateConfirm.
 */
export function buildForcedMatchInstructionForAlteracao(
  assunto: string,
  dataStr: string,
  conteudo: string
): string {
  return `INSTRUÇÃO OBRIGATÓRIA: O usuário corresponde a uma reunião JÁ SALVA. Comece sua resposta com:

"Não está tratando da reunião ${assunto}, do dia ${dataStr}? Quer atualizar? O que já temos de informação é isso:

${conteudo}"

Depois pode acrescentar uma frase curta (ex.: "Se quiser, pode me enviar mais pontos para eu incluir.").`;
}

