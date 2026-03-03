"use client";

import { useState, useEffect } from "react";
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
  dateContainer: {
    display: "flex",
    flexDirection: "column",
    alignItems: "flex-end",
    gap: "0.25rem",
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
  actionItem: {
    background: "rgba(78, 205, 196, 0.16)",
    borderRadius: "10px",
    padding: "0.35rem 0.6rem",
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
  actionItemOrder: {
    background: "#4ecdc4",
    color: "#1a1a2e",
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
  itemActionTag: {
    padding: "0.25rem 0.6rem",
    borderRadius: "999px",
    border: "1px solid rgba(78, 205, 196, 0.5)",
    fontSize: "0.7rem",
    fontWeight: 600,
    cursor: "pointer",
    userSelect: "none",
  },
  itemActionTagActive: {
    background: "#4ecdc4",
    color: "#1a1a2e",
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
  const initialDate = (() => {
    const raw = meeting.data as any;
    let d: Date | null = null;
    if (raw instanceof Date) {
      d = raw;
    } else if (raw && typeof raw.toDate === "function") {
      d = raw.toDate();
    } else if (raw && typeof raw.seconds === "number") {
      d = new Date(raw.seconds * 1000 + (raw.nanoseconds ?? 0) / 1_000_000);
    } else if (typeof raw === "string") {
      const parsed = new Date(raw);
      if (!Number.isNaN(parsed.getTime())) d = parsed;
    }
    if (!d || Number.isNaN(d.getTime())) {
      return { dateStr: "", timeStr: "" };
    }
    const iso = d.toISOString();
    const dateStr = iso.slice(0, 10);
    const timeStr = iso.slice(11, 16);
    return { dateStr, timeStr };
  })();
  const [dateStr, setDateStr] = useState(initialDate.dateStr);
  const [timeStr, setTimeStr] = useState(initialDate.timeStr);
  const [items, setItems] = useState(
    () =>
      [...(meeting.items ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ) as Array<MeetingItem & { id: string }>
  );
  const [saving, setSaving] = useState(false);
  const [extractingItems, setExtractingItems] = useState(false);
  const [status, setStatus] = useState<{ ok: boolean; msg: string } | null>(
    null
  );

  // Sincroniza a lista de itens quando a reunião for atualizada (ex.: após "Extrair itens com IA" + router.refresh)
  useEffect(() => {
    if (editing) return;
    setItems(
      [...(meeting.items ?? [])].sort(
        (a, b) => (a.order ?? 0) - (b.order ?? 0)
      ) as Array<MeetingItem & { id: string }>
    );
  }, [editing, meeting.items]);

  async function handleExtractItems() {
    if (!meeting.id) return;
    const textToUse = editing ? textoCompleto.trim() : (meeting.textoCompleto ?? "").trim();
    if (!textToUse) {
      setStatus({ ok: false, msg: "Preencha o conteúdo da reunião para extrair itens." });
      return;
    }
    setExtractingItems(true);
    setStatus(null);
    try {
      const res = await fetch(`/api/meetings/${meeting.id}/extract-items`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(editing ? { textoCompleto: textoCompleto.trim() } : {}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setStatus({ ok: false, msg: data?.error ?? "Erro ao extrair itens." });
        return;
      }
      setStatus({
        ok: true,
        msg: data.itemsAdded
          ? `${data.itemsAdded} itens extraídos e salvos.`
          : data?.message ?? "Pronto.",
      });
      router.refresh();
    } catch (e) {
      setStatus({
        ok: false,
        msg: e instanceof Error ? e.message : "Erro ao extrair itens.",
      });
    } finally {
      setExtractingItems(false);
    }
  }

  function cancelEdit() {
    setAssunto(meeting.assunto ?? "");
    setTextoCompleto(meeting.textoCompleto ?? "");
    setDateStr(initialDate.dateStr);
    setTimeStr(initialDate.timeStr);
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

  function toggleItemType(index: number) {
    setItems((prev) => {
      const next = [...prev];
      const current = next[index];
      const currentType = current.type === "action" ? "action" : "note";
      next[index] = {
        ...current,
        type: currentType === "action" ? "note" : "action",
        actionStatus:
          currentType === "action" ? undefined : (current.actionStatus ?? "open"),
      };
      return next;
    });
  }

  async function confirmEdit() {
    if (!meeting.id) return;
    setSaving(true);
    setStatus(null);
    try {
      const meetingPayload: {
        assunto?: string;
        textoCompleto?: string;
        data?: string;
      } = {};
      if (assunto !== (meeting.assunto ?? "")) meetingPayload.assunto = assunto;
      if (textoCompleto !== (meeting.textoCompleto ?? ""))
        meetingPayload.textoCompleto = textoCompleto;
      if (dateStr) {
        const payloadDate = timeStr ? `${dateStr}T${timeStr}` : dateStr;
        meetingPayload.data = payloadDate;
      }
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
        if (!item.id) continue;
        const origType = (orig?.type as "note" | "action" | undefined) ?? "note";
        const newType = (item.type as "note" | "action" | undefined) ?? "note";
        const contentChanged = orig?.content !== item.content;
        const typeChanged = origType !== newType;
        const payload: Record<string, unknown> = {};
        if (contentChanged) payload.content = item.content;
        if (typeChanged) {
          payload.type = newType;
          if (newType === "action") {
            payload.actionStatus = item.actionStatus ?? "open";
          } else {
            payload.actionStatus = undefined;
          }
        }
        if (Object.keys(payload).length === 0) continue;
        const res = await fetch(
          `/api/meetings/${meeting.id}/items/${item.id}`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
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
        <div style={styles.dateContainer}>
          {editing ? (
            <>
              <input
                type="date"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                style={{
                  ...styles.input,
                  width: "auto",
                  minWidth: "140px",
                  fontSize: "0.8rem",
                  padding: "0.3rem 0.5rem",
                }}
              />
              <input
                type="time"
                value={timeStr}
                onChange={(e) => setTimeStr(e.target.value)}
                style={{
                  ...styles.input,
                  width: "auto",
                  minWidth: "100px",
                  fontSize: "0.8rem",
                  padding: "0.3rem 0.5rem",
                }}
              />
            </>
          ) : (
            <span style={styles.cardDate}>{formattedDate}</span>
          )}
        </div>
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
            {items.map((item, idx) => {
              const isAction = (item.type as "note" | "action" | undefined) === "action";
              return (
                <div
                  key={item.id ?? idx}
                  style={{
                    ...styles.itemEdit,
                    ...(isAction ? styles.actionItem : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.itemOrder,
                      ...(isAction ? styles.actionItemOrder : {}),
                    }}
                  >
                    {item.order}
                  </span>
                  <input
                    type="text"
                    value={item.content}
                    onChange={(e) => updateItemContent(idx, e.target.value)}
                    style={styles.input}
                  />
                  <button
                    type="button"
                    onClick={() => toggleItemType(idx)}
                    style={{
                      ...styles.itemActionTag,
                      ...(isAction ? styles.itemActionTagActive : {}),
                    }}
                  >
                    {isAction ? "Ação" : "Transformar em ação"}
                  </button>
                </div>
              );
            })}
          </div>
        ) : (
          <ol style={styles.itemsList}>
            {items.map((item, idx) => {
              const isAction = (item.type as "note" | "action" | undefined) === "action";
              return (
                <li
                  key={item.id ?? idx}
                  style={{
                    ...styles.item,
                    ...(isAction ? styles.actionItem : {}),
                  }}
                >
                  <span
                    style={{
                      ...styles.itemOrder,
                      ...(isAction ? styles.actionItemOrder : {}),
                    }}
                  >
                    {item.order}
                  </span>
                  <span style={styles.itemContent}>
                    {item.content}
                    {isAction && (
                      <span
                        style={{
                          marginLeft: "0.4rem",
                          padding: "0.1rem 0.45rem",
                          borderRadius: "999px",
                          fontSize: "0.7rem",
                          fontWeight: 600,
                          background: "rgba(78,205,196,0.25)",
                          color: "#4ecdc4",
                        }}
                      >
                        Ação
                      </span>
                    )}
                  </span>
                </li>
              );
            })}
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
              disabled={saving || extractingItems}
              style={{ ...styles.button, ...styles.buttonPrimary }}
            >
              {saving ? "Salvando…" : "Confirmar alteração"}
            </button>
            <button
              type="button"
              onClick={handleExtractItems}
              disabled={saving || extractingItems || !textoCompleto.trim()}
              style={{ ...styles.button, ...styles.buttonEdit }}
            >
              {extractingItems ? "Extraindo…" : "Extrair itens com IA"}
            </button>
            <button
              type="button"
              onClick={cancelEdit}
              disabled={saving || extractingItems}
              style={{ ...styles.button, ...styles.buttonSecondary }}
            >
              Cancelar
            </button>
          </>
        ) : (
          <>
            <button
              type="button"
              onClick={() => setEditing(true)}
              style={{ ...styles.button, ...styles.buttonEdit }}
            >
              Editar textos
            </button>
            <button
              type="button"
              onClick={handleExtractItems}
              disabled={extractingItems || !(meeting.textoCompleto ?? "").trim()}
              style={{ ...styles.button, ...styles.buttonEdit }}
            >
              {extractingItems ? "Extraindo…" : "Extrair itens com IA"}
            </button>
          </>
        )}
      </div>
    </article>
  );
}
