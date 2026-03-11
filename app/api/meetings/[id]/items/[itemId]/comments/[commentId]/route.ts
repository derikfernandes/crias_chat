import { NextRequest, NextResponse } from "next/server";
import {
  updateMeetingItemComment,
  deleteMeetingItemComment,
} from "@/lib/meetings";

/**
 * PATCH /api/meetings/[id]/items/[itemId]/comments/[commentId]
 * Atualiza o conteúdo do comentário.
 */
export async function PATCH(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; itemId: string; commentId: string }> }
) {
  try {
    const { id: meetingId, itemId, commentId } = await params;
    if (!meetingId || !itemId || !commentId) {
      return NextResponse.json(
        { ok: false, error: "meetingId, itemId e commentId são obrigatórios" },
        { status: 400 }
      );
    }
    const body = await request.json().catch(() => ({}));
    const content =
      typeof body.content === "string" ? body.content.trim() : undefined;
    if (content === undefined) {
      return NextResponse.json(
        { ok: false, error: "content é obrigatório" },
        { status: 400 }
      );
    }
    await updateMeetingItemComment(meetingId, itemId, commentId, { content });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao atualizar comentário";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/**
 * DELETE /api/meetings/[id]/items/[itemId]/comments/[commentId]
 * Remove o comentário.
 */
export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; itemId: string; commentId: string }> }
) {
  try {
    const { id: meetingId, itemId, commentId } = await params;
    if (!meetingId || !itemId || !commentId) {
      return NextResponse.json(
        { ok: false, error: "meetingId, itemId e commentId são obrigatórios" },
        { status: 400 }
      );
    }
    await deleteMeetingItemComment(meetingId, itemId, commentId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao excluir comentário";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
