import { NextRequest, NextResponse } from "next/server";
import { getReplyForChat } from "@/lib/telegram-bot";
import { getEmailByTelegramUserId } from "@/lib/telegram-links";

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const chatId = body?.message?.chat?.id;
    const text = body?.message?.text ?? "";
    const fromId = body?.message?.from?.id;

    if (chatId == null) {
      return NextResponse.json({ ok: false }, { status: 400 });
    }

    const token = process.env.TELEGRAM_BOT_TOKEN;
    if (!token) {
      return NextResponse.json({ ok: false }, { status: 500 });
    }

    const userEmail =
      typeof fromId === "number"
        ? await getEmailByTelegramUserId(fromId)
        : null;

    const isLinked = userEmail != null;
    const askId = /^\s*(\/meuid|meu\s+id|qual\s+meu\s+id|id)\s*$/i.test(text.trim());

    let replyText: string;
    if (!isLinked) {
      if (askId && typeof fromId === "number") {
        replyText = `Seu ID no Telegram é: **${fromId}**. Use esse número em Configurações no site (logado) para vincular esta conta.`;
      } else {
        replyText =
          "Para usar o bot, vincule seu perfil do Telegram à sua conta. Acesse o site (faça login), vá em Configurações e informe seu ID do Telegram. Para saber seu ID, envie aqui: meu id";
      }
    } else if (askId && typeof fromId === "number") {
      replyText = `Seu ID no Telegram é: **${fromId}**. Use esse número em Configurações no site (logado) para vincular esta conta.`;
    } else {
      const result = await getReplyForChat(chatId, text, {
        userEmail: userEmail ?? undefined,
      });
      replyText = typeof result === "string" ? result : result.reply;
    }

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
