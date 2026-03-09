import { NextRequest, NextResponse } from "next/server";
import {
  listMeetings,
  listMeetingItems,
} from "@/lib/meetings";
import type { Meeting, MeetingItem } from "@/lib/firestore-types";

/**
 * GET /api/meetings
 * Lista reuniões do usuário (com itens). Requer o e-mail no header X-User-Email.
 * Retorna [] se o header estiver vazio ou ausente.
 */
export async function GET(request: NextRequest) {
  try {
    const userEmail =
      request.headers.get("x-user-email")?.trim() ||
      new URL(request.url).searchParams.get("userEmail")?.trim() ||
      "";
    if (!userEmail) {
      return NextResponse.json(
        { ok: true, meetings: [] },
        { headers: { "Cache-Control": "no-store" } }
      );
    }

    const meetings = await listMeetings(userEmail);
    const meetingsWithItems: Array<Meeting & { items: MeetingItem[] }> =
      await Promise.all(
        meetings.map(async (m) => {
          const items = m.id ? await listMeetingItems(m.id) : [];
          return { ...m, items };
        })
      );

    return NextResponse.json(
      { ok: true, meetings: meetingsWithItems },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao listar reuniões";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
