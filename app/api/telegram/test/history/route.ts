import { NextRequest, NextResponse } from "next/server";
import { getChatStateByUserEmail } from "@/lib/chat-state";
import { TEST_CHAT_ID } from "@/lib/telegram-bot";

/** Retorna o histórico do chat de teste (Firestore) do usuário. Busca por userEmail no banco. */
export async function GET(request: NextRequest) {
  try {
    const userEmail =
      request.headers.get("x-user-email")?.trim() ||
      new URL(request.url).searchParams.get("userEmail")?.trim() ||
      "";
    if (!userEmail) {
      return NextResponse.json({ history: [] });
    }
    const { state } = await getChatStateByUserEmail(TEST_CHAT_ID, userEmail);
    return NextResponse.json({ history: state.history ?? [] });
  } catch {
    return NextResponse.json({ history: [] });
  }
}
