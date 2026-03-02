"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { Meeting, MeetingItem } from "@/lib/firestore-types";

type MeetingWithItems = Meeting & { items: MeetingItem[] };

const styles: Record<string, React.CSSProperties> = {
  card: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: "14px",
    padding: "1.25rem 1.5rem",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  cardHeader: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: "0.5rem",
    marginBottom: "1rem",
    paddingBottom: "0.75rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  cardTitle: {
    margin: 0,
    fontSize: "1.2rem",
    fontWeight: 600,
    color: "#fff",
  },
  cardDate: {
    fontSize: "0.85rem",
    color: "#4ecdc4",
    fontWeight: 500,
  },
  label: {
    display: "block",
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#888",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
    marginBottom: "0.4rem",
  },
  textoCompleto: { marginBottom: "1rem" },
  textoContent: {
    margin: 0,
    fontSize: "0.95rem",
    lineHeight: 1.5,
    color: "#ccc",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  itemsSection: { marginBottom: "0.5rem" },
  noItems: {
    margin: "0.25rem 0 0",
    fontSize: "0.9rem",
    color: "#666",
  },
  itemsList: {
    margin: "0.25rem 0 0",
    paddingLeft: "1.25rem",
    listStyle: "decimal",
  },
  item: {
    marginBottom: "0.5rem",
    display: "flex",
    alignItems: "flex-start",
    gap: "0.5rem",
  },
  itemOrder: {
    flexShrink: 0,
    width: "1.5rem",
    height: "1.5rem",
    borderRadius: "6px",
    background: "rgba(78, 205, 196, 0.25)",
    color: "#4ecdc4",
    fontSize: "0.8rem",
    fontWeight: 700,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  },
  itemContent: { flex: 1, fontSize: "0.95rem", color: "#ddd", lineHeight: 1.4 },
  cardMeta: {
    marginTop: "1rem",
    paddingTop: "0.75rem",
    borderTop: "1px solid rgba(255,255,255,0.06)",
    fontSize: "0.75rem",
    color: "#666",
  },
  code: {
    fontFamily: "ui-monospace, monospace",
    background: "rgba(0,0,0,0.3)",
    padding: "0.15rem 0.4rem",
    borderRadius: "4px",
    fontSize: "0.7rem",
  },
  actions: {
    display: "flex",
    gap: "0.5rem",
    marginTop: "1rem",
    flexWrap: "wrap",
  },
  button: {
    padding: "0.5rem 0.9rem",
    borderRadius: "8px",
    border: "none",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  buttonEdit: {
    background: "rgba(78, 205, 196, 0.25)",
    color: "#4ecdc4",
    border: "1px solid rgba(78, 205, 196, 0.5)",
  },
  buttonPrimary: {
    background: "#4ecdc4",
    color: "#1a1a2e",
  },
  buttonSecondary: {
    background: "rgba(255,255,255,0.1)",
    color: "#ccc",
    border: "1px solid rgba(255,255,255,0.2)",
  },
  input: {
    width: "100%",
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.25)",
    color: "#eee",
    fontSize: "1rem",
    fontFamily: "inherit",
    boxSizing: "border-box",
  },
  textarea: {
    width: "100%",
    minHeight: "100px",
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.25)",
    color: "#eee",
    fontSize: "0.95rem",
    fontFamily: "inherit",
    resize: "vertical",
    boxSizing: "border-box",
  },
  itemEdit: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
    marginBottom: "0.5rem",
  },
  status: {
    fontSize: "0.85rem",
    marginTop: "0.5rem",
  },
  statusOk: { color: "#4ecdc4" },
  statusErr: { color: "#ff6b6b" },
};

export default function MeetingCard({
  meeting,
  formattedDate,
}: {
  meeting: MeetingWithItems;
  formattedDate: string;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);
  const [assunto, setAssunto] = useState(meeting.assunto ?? "");
  const [textoCompleto, setTextoCompleto] = useState(
    meeting.textoCompleto ?? ""
  );
  const [items, setItems] = useState(
    () =>
      [...(meeting.items ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ) as Array<MeetingItem & { id: string }>
  );
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  function cancelEdit() {
    setAssunto(meeting.assunto ?? "");
    setTextoCompleto(meeting.textoCompleto ?? "");
    setItems(
      [...(meeting.items ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ) as Array<MeetingItem & { id: string }>
    );
    setStatus(null);
    setEditing(false);
  }

  function updateItemContent(index: number, content: string) {
    setItems((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], content };
      return next;
    });
  }

  async function confirmEdit() {
    if (!meeting.id) return;
    setSaving(true);
    setStatus(null);
    try {
      const meetingPayload: { assunto?: string; textoCompleto?: string } = {};
      if (assunto !== (meeting.assunto ?? "")) meetingPayload.assunto = assunto;
      if (textoCompleto !== (meeting.textoCompleto ?? ""))
        meetingPayload.textoCompleto = textoCompleto;
      if (Object.keys(meetingPayload).length > 0) {
        const res = await fetch(`/api/meetings/${meeting.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(meetingPayload),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus({ ok: false, msg: data?.error ?? "Erro ao atualizar reunião" });
          setSaving(false);
          return;
        }
      }
      const originalItems = [...(meeting.items ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ) as Array<MeetingItem & { id?: string }>;
      for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const orig = originalItems.find((o) => o.id === item.id) ?? originalItems[i];
        if (!item.id || orig?.content === item.content) continue;
        const res = await fetch(
          `/api/meetings/${meeting.id}/items/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: item.content }),
          }
        );
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setStatus({
            ok: false,
            msg: data?.error ?? `Erro ao atualizar item ${i + 1}`,
          });
          setSaving(false);
          return;
        }
      }
      setStatus({ ok: true, msg: "Alterações salvas no banco de dados." });
      setEditing(false);
      router.refresh();
    } catch (e) {
      setStatus({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro ao salvar",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <article style={styles.card}>
      <div style={styles.cardHeader}>
        {editing ? (
          <input
            type="text"
            value={assunto}
            onChange={(e) => setAssunto(e.target.value)}
            placeholder="Assunto"
            style={{ ...styles.input, flex: 1, margin: 0 }}
          />
        ) : (
          <h2 style={styles.cardTitle}>{meeting.assunto}</h2>
        )}
        <span style={styles.cardDate}>{formattedDate}</span>
      </div>

      <div style={styles.textoCompleto}>
        <span style={styles.label}>Conteúdo / texto completo</span>
        {editing ? (
          <textarea
            value={textoCompleto}
            onChange={(e) => setTextoCompleto(e.target.value)}
            placeholder="Texto completo da reunião"
            style={styles.textarea}
          />
        ) : (
          <p style={styles.textoContent}>
            {meeting.textoCompleto || "(vazio)"}
          </p>
        )}
      </div>

      <div style={styles.itemsSection}>
        <span style={styles.label}>
          Itens da reunião ({items.length})
        </span>
        {items.length === 0 ? (
          <p style={styles.noItems}>Nenhum item.</p>
        ) : editing ? (
          <div style={{ marginTop: "0.25rem" }}>
            {items.map((item, idx) => (
              <div key={item.id ?? idx} style={styles.itemEdit}>
                <span style={styles.itemOrder}>{item.order}</span>
                <input
                  type="text"
                  value={item.content}
                  onChange={(e) => updateItemContent(idx, e.target.value)}
                  style={styles.input}
                />
              </div>
            ))}
          </div>
        ) : (
          <ol style={styles.itemsList}>
            {items.map((item, idx) => (
              <li key={item.id ?? idx} style={styles.item}>
                <span style={styles.itemOrder}>{item.order}</span>
                <span style={styles.itemContent}>{item.content}</span>
              </li>
            ))}
          </ol>
        )}
      </div>

      {meeting.id && (
        <div style={styles.cardMeta}>
          ID: <code style={styles.code}>{meeting.id}</code>
        </div>
      )}

      {status && (
        <p
          style={{
            ...styles.status,
            ...(status.ok ? styles.statusOk : styles.statusErr),
          }}
        >
          {status.msg}
        </p>
      )}

      <div style={styles.actions}>
        {editing ? (
          <>
            <button
              type="button"
              onClick={confirmEdit}
              disabled={saving}
              style={{ ...styles.button, ...styles.buttonPrimary }}
            >
              {saving ? "Salvando…" : "Confirmar alteração"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving}
              style={{ ...styles.button, ...styles.buttonSecondary }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            style={{ ...styles.button, ...styles.buttonEdit }}
          >
            Editar textos
          </button>
        )}
      </div>
    </article>
  );
}
