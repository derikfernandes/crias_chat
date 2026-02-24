import { generateContent } from "@/lib/vertex-ai";

/**
 * Gera resposta do bot usando Vertex AI (Gemini).
 * Usado tanto pelo webhook do Telegram quanto pela página de teste.
 */
export async function getReplyForChat(chatId: number, userMessage: string): Promise<string> {
  const text = (userMessage ?? "").trim();
  if (!text) return "Envie uma mensagem de texto.";

  try {
    const reply = await generateContent({ userMessage: text });
    return reply;
  } catch (err) {
    console.error("[telegram-bot] Vertex AI error:", err);
    return "Desculpe, tive um problema ao processar. Tente de novo em instantes.";
  }
}
