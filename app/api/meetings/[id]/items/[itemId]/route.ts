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
    const type =
      body.type === "action" || body.type === "note"
        ? body.type
        : undefined;
    const actionStatus =
      body.actionStatus === "open" ||
      body.actionStatus === "done" ||
      body.actionStatus === "cancelled"
        ? body.actionStatus
        : undefined;
    const actionNote =
      body.actionNote !== undefined ? String(body.actionNote) : undefined;
    const actionDueDateRaw = body.actionDueDate;
    const actionDueDate =
      actionDueDateRaw === undefined
        ? undefined
        : actionDueDateRaw === null || actionDueDateRaw === ""
        ? null
        : String(actionDueDateRaw);

    if (
      content === undefined &&
      order === undefined &&
      type === undefined &&
      actionStatus === undefined &&
      actionNote === undefined &&
      actionDueDate === undefined
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Envie pelo menos um campo para atualizar (content, order, type, actionStatus, actionNote ou actionDueDate)",
        },
        { status: 400 }
      );
    }
    await updateMeetingItem(meetingId, itemId, {
      content,
      order,
      type,
      actionStatus,
      actionNote,
      actionDueDate,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar item";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
