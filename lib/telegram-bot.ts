import { generateContent, type ChatMessage } from "@/lib/vertex-ai";

const MAX_HISTORY = 20;
const chatHistory = new Map<number, ChatMessage[]>();

function getHistory(chatId: number): ChatMessage[] {
  return chatHistory.get(chatId) ?? [];
}

function pushToHistory(chatId: number, userText: string, modelText: string): void {
  const list = chatHistory.get(chatId) ?? [];
  list.push({ role: "user", text: userText }, { role: "model", text: modelText });
  if (list.length > MAX_HISTORY) list.splice(0, list.length - MAX_HISTORY);
  chatHistory.set(chatId, list);
}

/**
 * Gera resposta do bot usando Vertex AI (Gemini).
 * Usa janela de contexto de pelo menos 20 mensagens por chat.
 * Usado tanto pelo webhook do Telegram quanto pela página de teste.
 */
export async function getReplyForChat(chatId: number, userMessage: string): Promise<string> {
  const text = (userMessage ?? "").trim();
  if (!text) return "Envie uma mensagem de texto.";

  const history = getHistory(chatId);

  try {
    const reply = await generateContent({
      userMessage: text,
      history,
    });
    pushToHistory(chatId, text, reply);
    return reply;
  } catch (err) {
    console.error("[telegram-bot] Vertex AI error:", err);
    return "Desculpe, tive um problema ao processar. Tente de novo em instantes.";
  }
}
