// Contador de mensagens por chat (em memória; em serverless pode variar entre instâncias)
const messageCountByChat = new Map<number, number>();

export function getReplyForChat(chatId: number): string {
  const count = (messageCountByChat.get(chatId) ?? 0) + 1;
  messageCountByChat.set(chatId, count);
  return count === 1 ? "oi" : "bot ta bão";
}
