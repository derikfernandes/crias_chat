import { NextRequest, NextResponse } from "next/server";
import { getReplyForChat } from "@/lib/telegram-bot";

// ChatId fixo para testes locais (não envia nada ao Telegram)
const TEST_CHAT_ID = 999999;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    // text opcional: só para simular; a resposta do bot usa só o contador
    const _text = body?.text ?? "";

    const replyText = getReplyForChat(TEST_CHAT_ID);
    return NextResponse.json({ ok: true, reply: replyText });
  } catch {
    return NextResponse.json({ ok: false, reply: "" }, { status: 500 });
  }
}
