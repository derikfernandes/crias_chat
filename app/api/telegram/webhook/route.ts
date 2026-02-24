import { NextRequest, NextResponse } from "next/server";
import { getReplyForChat } from "@/lib/telegram-bot";

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chatId = body?.message?.chat?.id;
    const text = body?.message?.text;

    if (chatId == null) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const replyText = await getReplyForChat(chatId, text ?? "");
    const sendUrl = `${TELEGRAM_API}${token}/sendMessage`;
    await fetch(sendUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: chatId,
        text: replyText,
      }),
    });

    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}
