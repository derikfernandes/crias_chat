"use client";

import { useState, useCallback } from "react";
import type { MeetingItem } from "@/lib/firestore-types";

export type ActionWithContext = MeetingItem & {
  meetingId: string;
  meetingAssunto: string;
};

type Status = "open" | "done" | "cancelled";

const COLUMNS: { id: Status; title: string }[] = [
  { id: "open", title: "A fazer" },
  { id: "done", title: "Concluído" },
  { id: "cancelled", title: "Cancelado" },
];

function formatDueDate(value: MeetingItem["actionDueDate"]): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? null : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date }).toDate().toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit", year: "numeric" });
  }
  return null;
}

function KanbanCard({
  action,
  onMove,
  isMoving,
}: {
  action: ActionWithContext;
  onMove: (newStatus: Status) => void;
  isMoving: boolean;
}) {
  const dueStr = formatDueDate(action.actionDueDate);
  return (
    <div style={styles.card}>
      <p style={styles.cardContent}>{action.content}</p>
      <div style={styles.cardMeta}>
        <span style={styles.cardMeeting}>{action.meetingAssunto}</span>
        {dueStr && <span style={styles.cardDue}>Prazo: {dueStr}</span>}
      </div>
      <div style={styles.cardActions}>
        {COLUMNS.filter((col) => col.id !== (action.actionStatus ?? "open")).map((col) => (
          <button
            key={col.id}
            type="button"
            onClick={() => onMove(col.id)}
            disabled={isMoving}
            style={styles.moveBtn}
          >
            → {col.title}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function KanbanBoard({
  actions,
}: {
  actions: ActionWithContext[];
}) {
  const [movingId, setMovingId] = useState<string | null>(null);
  const [localActions, setLocalActions] = useState<ActionWithContext[]>(actions);

  const moveAction = useCallback(
    async (meetingId: string, itemId: string, newStatus: Status) => {
      const key = `${meetingId}-${itemId}`;
      setMovingId(key);
      try {
        const res = await fetch(`/api/meetings/${meetingId}/items/${itemId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ actionStatus: newStatus }),
        });
        const data = await res.json();
        if (!res.ok || !data.ok) {
          throw new Error(data.error ?? "Falha ao atualizar");
        }
        setLocalActions((prev) =>
          prev.map((a) =>
            a.meetingId === meetingId && a.id === itemId
              ? { ...a, actionStatus: newStatus }
              : a
          )
        );
      } finally {
        setMovingId(null);
      }
    },
    []
  );

  const byStatus = (status: Status) =>
    localActions.filter((a) => (a.actionStatus ?? "open") === status);

  return (
    <div style={styles.board}>
      {COLUMNS.map((col) => (
        <div key={col.id} style={styles.column}>
          <h2 style={styles.columnTitle}>
            {col.title}
            <span style={styles.columnCount}>{byStatus(col.id).length}</span>
          </h2>
          <div style={styles.columnCards}>
            {byStatus(col.id).map((action) =>
              action.id ? (
                <KanbanCard
                  key={`${action.meetingId}-${action.id}`}
                  action={action}
                  onMove={(newStatus) =>
                    moveAction(action.meetingId, action.id!, newStatus)
                  }
                  isMoving={movingId === `${action.meetingId}-${action.id}`}
                />
              ) : null
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  board: {
    display: "grid",
    gridTemplateColumns: "repeat(3, 1fr)",
    gap: "1.5rem",
    alignItems: "start",
  },
  column: {
    background: "rgba(255,255,255,0.05)",
    borderRadius: "14px",
    padding: "1rem",
    border: "1px solid rgba(255,255,255,0.08)",
    minHeight: "200px",
  },
  columnTitle: {
    margin: "0 0 1rem",
    fontSize: "1rem",
    fontWeight: 700,
    color: "#fff",
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  columnCount: {
    background: "rgba(78, 205, 196, 0.3)",
    color: "#4ecdc4",
    padding: "0.2rem 0.5rem",
    borderRadius: "8px",
    fontSize: "0.8rem",
  },
  columnCards: {
    display: "flex",
    flexDirection: "column",
    gap: "0.75rem",
  },
  card: {
    background: "rgba(255,255,255,0.08)",
    borderRadius: "12px",
    padding: "1rem",
    border: "1px solid rgba(255,255,255,0.1)",
  },
  cardContent: {
    margin: "0 0 0.5rem",
    fontSize: "0.95rem",
    color: "#eee",
    lineHeight: 1.4,
  },
  cardMeta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    marginBottom: "0.75rem",
    fontSize: "0.75rem",
    color: "#888",
  },
  cardMeeting: {
    color: "#4ecdc4",
  },
  cardDue: {
    color: "#aaa",
  },
  cardActions: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.4rem",
  },
  moveBtn: {
    padding: "0.35rem 0.6rem",
    fontSize: "0.75rem",
    background: "rgba(78, 205, 196, 0.2)",
    border: "1px solid rgba(78, 205, 196, 0.4)",
    color: "#4ecdc4",
    borderRadius: "8px",
    cursor: "pointer",
  },
};
