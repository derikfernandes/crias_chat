import { NextResponse } from "next/server";

const TELEGRAM_API = "https://api.telegram.org/bot";

export async function GET() {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const baseUrl = process.env.BASE_URL;

  if (!token || !baseUrl) {
    return NextResponse.json(
      { ok: false, error: "TELEGRAM_BOT_TOKEN e BASE_URL devem estar definidos no ambiente." },
      { status: 500 }
    );
  }

  const webhookUrl = `${baseUrl}/api/telegram/webhook`;
  const setWebhookUrl = `${TELEGRAM_API}${token}/setWebhook`;

  const res = await fetch(setWebhookUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url: webhookUrl }),
  });

  const data = await res.json();
  return NextResponse.json(data);
}
