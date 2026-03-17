import { NextRequest, NextResponse } from "next/server";
import { updateMeetingItem, deleteMeetingItem } from "@/lib/meetings";

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
    const rawOwners = body.actionOwners;
    let actionOwners: string[] | undefined = undefined;
    if (Array.isArray(rawOwners)) {
      actionOwners = rawOwners
        .map((v) => String(v).trim())
        .filter((v) => v.length > 0);
    } else if (typeof rawOwners === "string") {
      actionOwners = rawOwners
        .split(",")
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
    }
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
      actionOwners === undefined &&
      actionDueDate === undefined
    ) {
      return NextResponse.json(
        {
          ok: false,
          error:
            "Envie pelo menos um campo para atualizar (content, order, type, actionStatus, actionNote, actionOwners ou actionDueDate)",
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
      actionOwners,
      actionDueDate,
    });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar item";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function DELETE(
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
    await deleteMeetingItem(meetingId, itemId);
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao excluir item";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
