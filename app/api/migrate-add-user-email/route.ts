/**
 * Migração: adiciona userEmail em documentos que ainda não têm vinculação.
 * Coleções: meetings, meetings/{id}/items e chatState.
 * E-mail usado: derikluizfernandes@gmail.com (apenas para dados já existentes).
 * Só atualiza docs sem userEmail ou com userEmail vazio (idempotente).
 * Rode: POST /api/migrate-add-user-email
 */

import { NextResponse } from "next/server";
import {
  collection,
  doc,
  getDocsFromServer,
  updateDoc,
} from "firebase/firestore";
import { getDb } from "@/lib/firebase";

const USER_EMAIL = "derikluizfernandes@gmail.com";

function needsUserEmail(data: Record<string, unknown>): boolean {
  const v = data.userEmail;
  return v == null || (typeof v === "string" && !v.trim());
}

export async function POST() {
  try {
    const db = getDb();
    const stats = { meetingsUpdated: 0, itemsUpdated: 0, chatStateUpdated: 0 };

    // 1) Coleção meetings
    const meetingsRef = collection(db, "meetings");
    const meetingsSnap = await getDocsFromServer(meetingsRef);
    for (const d of meetingsSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      if (needsUserEmail(data)) {
        await updateDoc(doc(db, "meetings", d.id), { userEmail: USER_EMAIL });
        stats.meetingsUpdated++;
      }
    }

    // 2) Subcoleção items de cada meeting
    for (const d of meetingsSnap.docs) {
      const itemsRef = collection(db, "meetings", d.id, "items");
      const itemsSnap = await getDocsFromServer(itemsRef);
      for (const item of itemsSnap.docs) {
        const data = item.data() as Record<string, unknown>;
        if (needsUserEmail(data)) {
          await updateDoc(doc(db, "meetings", d.id, "items", item.id), {
            userEmail: USER_EMAIL,
          });
          stats.itemsUpdated++;
        }
      }
    }

    // 3) Coleção chatState
    const chatStateRef = collection(db, "chatState");
    const chatStateSnap = await getDocsFromServer(chatStateRef);
    for (const d of chatStateSnap.docs) {
      const data = d.data() as Record<string, unknown>;
      if (needsUserEmail(data)) {
        await updateDoc(doc(db, "chatState", d.id), { userEmail: USER_EMAIL });
        stats.chatStateUpdated++;
      }
    }

    return NextResponse.json({
      ok: true,
      message: `Migração concluída. Documentos vinculados a ${USER_EMAIL}:`,
      ...stats,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Erro na migração";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
