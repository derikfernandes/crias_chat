import { NextRequest, NextResponse } from "next/server";
import { getReplyForChat, TEST_CHAT_ID } from "@/lib/telegram-bot";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const text = body?.text ?? "";
    const debug = body?.debug === true;
    const userEmail = typeof body?.userEmail === "string" ? body.userEmail.trim() || undefined : undefined;

    const result = await getReplyForChat(TEST_CHAT_ID, text, { returnDebug: debug, userEmail });

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
