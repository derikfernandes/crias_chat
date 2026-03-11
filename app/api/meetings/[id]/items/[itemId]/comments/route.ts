import { NextRequest, NextResponse } from "next/server";
import {
  listMeetingItemComments,
  addMeetingItemComment,
} from "@/lib/meetings";

/**
 * GET /api/meetings/[id]/items/[itemId]/comments
 * Lista comentários da ação.
 */
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: meetingId, itemId } = await params;
    if (!meetingId || !itemId) {
      return NextResponse.json(
        { ok: false, error: "meetingId e itemId são obrigatórios" },
        { status: 400 }
      );
    }
    const comments = await listMeetingItemComments(meetingId, itemId);
    return NextResponse.json(
      { ok: true, comments },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao listar comentários";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * POST /api/meetings/[id]/items/[itemId]/comments
 * Adiciona um comentário. Opcional: X-User-Email para userEmail do comentário.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: meetingId, itemId } = await params;
    if (!meetingId || !itemId) {
      return NextResponse.json(
        { ok: false, error: "meetingId e itemId são obrigatórios" },
        { status: 400 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const content =
      typeof body.content === "string" ? body.content.trim() : "";
    if (!content) {
      return NextResponse.json(
        { ok: false, error: "content é obrigatório" },
        { status: 400 }
      );
    }
    const userEmail =
      request.headers.get("x-user-email")?.trim() ||
      new URL(request.url).searchParams.get("userEmail")?.trim() ||
      undefined;
    const commentId = await addMeetingItemComment(meetingId, itemId, {
      content,
      ...(userEmail && { userEmail }),
    });
    return NextResponse.json({ ok: true, commentId });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao adicionar comentário";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
