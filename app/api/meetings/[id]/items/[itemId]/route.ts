import { NextRequest, NextResponse } from "next/server";
import { updateMeetingItem } from "@/lib/meetings";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: meetingId, itemId } = await params;
    if (!meetingId || !itemId) {
      return NextResponse.json(
        { ok: false, error: "id da reunião e itemId são obrigatórios" },
        { status: 400 }
      );
    }
    const body = await _request.json().catch(() => ({}));
    const content =
      body.content !== undefined ? String(body.content) : undefined;
    const order =
      body.order !== undefined ? Number(body.order) : undefined;
    if (content === undefined && order === undefined) {
      return NextResponse.json(
        { ok: false, error: "Envie content e/ou order" },
        { status: 400 }
      );
    }
    await updateMeetingItem(meetingId, itemId, { content, order });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar item";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
