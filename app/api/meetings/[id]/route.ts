import { NextRequest, NextResponse } from "next/server";
import { updateMeeting } from "@/lib/meetings";

export async function PATCH(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;
    if (!id) {
      return NextResponse.json(
        { ok: false, error: "ID da reunião é obrigatório" },
        { status: 400 }
      );
    }
    const body = await _request.json().catch(() => ({}));
    const assunto =
      body.assunto !== undefined ? String(body.assunto) : undefined;
    const tema =
      body.tema !== undefined ? String(body.tema) : undefined;
    const textoCompleto =
      body.textoCompleto !== undefined ? String(body.textoCompleto) : undefined;
    const data =
      body.data !== undefined && body.data !== null
        ? String(body.data)
        : undefined;

    if (
      assunto === undefined &&
      tema === undefined &&
      textoCompleto === undefined &&
      data === undefined
    ) {
      return NextResponse.json(
        { ok: false, error: "Envie assunto, tema, textoCompleto e/ou data" },
        { status: 400 }
      );
    }

    await updateMeeting(id, { assunto, tema, textoCompleto, data });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro ao atualizar reunião";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
