import { NextRequest, NextResponse } from "next/server";
import {
  getMeeting,
  listMeetingItems,
  addMeetingItem,
  deleteMeetingItem,
} from "@/lib/meetings";
import { extractItemsFromText } from "@/lib/vertex-ai";

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: meetingId } = await params;
    if (!meetingId) {
      return NextResponse.json(
        { ok: false, error: "ID da reunião é obrigatório" },
        { status: 400 }
      );
    }

    const meeting = await getMeeting(meetingId);
    if (!meeting) {
      return NextResponse.json(
        { ok: false, error: "Reunião não encontrada" },
        { status: 404 }
      );
    }

    let textoCompleto: string | undefined;
    const body = await request.json().catch(() => ({}));
    if (typeof body.textoCompleto === "string" && body.textoCompleto.trim()) {
      textoCompleto = body.textoCompleto.trim();
    } else {
      textoCompleto = meeting.textoCompleto?.trim();
    }

    if (!textoCompleto) {
      return NextResponse.json(
        { ok: false, error: "Não há texto para extrair itens. Preencha o conteúdo da reunião." },
        { status: 400 }
      );
    }

    const extractedItems = await extractItemsFromText(textoCompleto);
    if (extractedItems.length === 0) {
      return NextResponse.json({
        ok: true,
        itemsAdded: 0,
        message: "A IA não encontrou itens para extrair.",
      });
    }

    const existingItems = await listMeetingItems(meetingId);
    for (const item of existingItems) {
      if (item.id) await deleteMeetingItem(meetingId, item.id);
    }

    for (let i = 0; i < extractedItems.length; i++) {
      await addMeetingItem(meetingId, {
        content: extractedItems[i],
        order: i,
      });
    }

    return NextResponse.json({
      ok: true,
      itemsAdded: extractedItems.length,
    });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Erro ao extrair itens com IA";
    return NextResponse.json(
      { ok: false, error: message },
      { status: 500 }
    );
  }
}
