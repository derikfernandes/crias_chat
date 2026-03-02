import { NextRequest, NextResponse } from "next/server";
import { getReplyForChat } from "@/lib/telegram-bot";

// ChatId fixo para testes locais (não envia nada ao Telegram)
const TEST_CHAT_ID = 999999;

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = body?.text ?? "";
    const debug = body?.debug === true;

    const result = await getReplyForChat(TEST_CHAT_ID, text, { returnDebug: debug });

    if (typeof result === "string") {
      return NextResponse.json({ ok: true, reply: result });
    }
    return NextResponse.json({
      ok: true,
      reply: result.reply,
      debug: result.debug,
    });
  } catch {
    return NextResponse.json({ ok: false, reply: "" }, { status: 500 });
  }
}
