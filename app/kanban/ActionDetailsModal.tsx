"use client";

import { useState, useEffect, useCallback } from "react";
import type { MeetingItemComment } from "@/lib/firestore-types";
import type { ActionWithContext } from "./KanbanBoard";

function formatCommentDate(value: MeetingItemComment["createdAt"]): string {
  if (value == null) return "";
  let d: Date;
  if (value instanceof Date) {
    d = value;
  } else if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    d = (value as { toDate: () => Date }).toDate();
  } else if (typeof value === "string") {
    d = new Date(value);
  } else {
    return "";
  }
  return d.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function formatDueDate(value: ActionWithContext["actionDueDate"]): string | null {
  if (value == null || value === "") return null;
  if (value instanceof Date) {
    return value.toLocaleDateString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    });
  }
  if (typeof value === "string") {
    const d = new Date(value);
    return Number.isNaN(d.getTime())
      ? null
      : d.toLocaleDateString("pt-BR", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
        });
  }
  if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    return (value as { toDate: () => Date })
      .toDate()
      .toLocaleDateString("pt-BR", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
  }
  return null;
}

function toDateInputValue(value: ActionWithContext["actionDueDate"]): string {
  if (value == null || value === "") return "";
  let d: Date | null = null;
  if (value instanceof Date) {
    d = value;
  } else if (typeof value === "string") {
    const parsed = new Date(value);
    d = Number.isNaN(parsed.getTime()) ? null : parsed;
  } else if (typeof (value as { toDate?: () => Date }).toDate === "function") {
    d = (value as { toDate: () => Date }).toDate();
  }
  if (!d) return "";
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

const STATUS_LABELS: Record<string, string> = {
  open: "A fazer",
  done: "Concluído",
  cancelled: "Cancelado",
};

type Props = {
  action: ActionWithContext;
  onClose: () => void;
  userEmail?: string;
};

export default function ActionDetailsModal({
  action,
  onClose,
  userEmail,
}: Props) {
  const [comments, setComments] = useState<MeetingItemComment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [newComment, setNewComment] = useState("");
  const [sending, setSending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [dueDateInput, setDueDateInput] = useState<string>(
    toDateInputValue(action.actionDueDate)
  );
  const [updatingDueDate, setUpdatingDueDate] = useState(false);
  const [ownersInput, setOwnersInput] = useState<string>(
    (action.actionOwners ?? []).join(", ")
  );
  const [updatingOwners, setUpdatingOwners] = useState(false);

  const meetingId = action.meetingId;
  const itemId = action.id!;

  const fetchComments = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/items/${itemId}/comments`,
        { cache: "no-store" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setComments([]);
        setError(data.error ?? "Erro ao carregar comentários");
        return;
      }
      setComments(Array.isArray(data.comments) ? data.comments : []);
    } catch {
      setComments([]);
      setError("Erro ao carregar comentários");
    } finally {
      setLoading(false);
    }
  }, [meetingId, itemId]);

  useEffect(() => {
    fetchComments();
  }, [fetchComments]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    const content = newComment.trim();
    if (!content || sending) return;
    setSending(true);
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (userEmail) headers["X-User-Email"] = userEmail;
      const res = await fetch(
        `/api/meetings/${meetingId}/items/${itemId}/comments`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ content }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao salvar comentário");
        return;
      }
      setNewComment("");
      setError(null);
      await fetchComments();
    } catch {
      setError("Erro ao salvar comentário");
    } finally {
      setSending(false);
    }
  };

  const startEdit = (c: MeetingItemComment) => {
    if (c.id) {
      setEditingId(c.id);
      setEditContent(c.content);
    }
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditContent("");
  };

  const saveEdit = async (commentId: string) => {
    const content = editContent.trim();
    if (!content) return;
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/items/${itemId}/comments/${commentId}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content }),
        }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao atualizar comentário");
        return;
      }
      setEditingId(null);
      setEditContent("");
      setError(null);
      await fetchComments();
    } catch {
      setError("Erro ao atualizar comentário");
    }
  };

  const handleDelete = async (commentId: string) => {
    if (deletingId) return;
    setDeletingId(commentId);
    try {
      const res = await fetch(
        `/api/meetings/${meetingId}/items/${itemId}/comments/${commentId}`,
        { method: "DELETE" }
      );
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao excluir comentário");
        return;
      }
      setError(null);
      await fetchComments();
    } catch {
      setError("Erro ao excluir comentário");
    } finally {
      setDeletingId(null);
    }
  };

  const handleUpdateDueDate = async () => {
    if (updatingDueDate) return;
    setUpdatingDueDate(true);
    try {
      const body: { actionDueDate: string | null } = {
        actionDueDate: dueDateInput.trim() === "" ? null : dueDateInput.trim(),
      };
      const res = await fetch(`/api/meetings/${meetingId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao atualizar prazo");
        return;
      }
      setError(null);
    } catch {
      setError("Erro ao atualizar prazo");
    } finally {
      setUpdatingDueDate(false);
    }
  };

  const handleUpdateOwners = async () => {
    if (updatingOwners) return;
    setUpdatingOwners(true);
    try {
      const body = {
        actionOwners: ownersInput
          .split(",")
          .map((v) => v.trim())
          .filter((v) => v.length > 0),
      };
      const res = await fetch(`/api/meetings/${meetingId}/items/${itemId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok || !data.ok) {
        setError(data.error ?? "Erro ao atualizar responsáveis");
        return;
      }
      setError(null);
    } catch {
      setError("Erro ao atualizar responsáveis");
    } finally {
      setUpdatingOwners(false);
    }
  };

  const dueStr = formatDueDate(action.actionDueDate);
  const statusLabel =
    STATUS_LABELS[action.actionStatus ?? "open"] ?? "A fazer";

  return (
    <div
      style={styles.overlay}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      role="dialog"
      aria-modal="true"
      aria-labelledby="action-detail-title"
    >
      <div style={styles.modal}>
        <div style={styles.header}>
          <h2 id="action-detail-title" style={styles.title}>
            Detalhes da ação
          </h2>
          <button
            type="button"
            onClick={onClose}
            style={styles.closeBtn}
            aria-label="Fechar"
          >
            ×
          </button>
        </div>

        <div style={styles.actionInfo}>
          <p style={styles.actionContent}>{action.content}</p>
          <div style={styles.meta}>
            <span style={styles.meetingLabel}>{action.meetingAssunto}</span>
            <span style={styles.status}>{statusLabel}</span>
            {dueStr && <span style={styles.due}>Prazo: {dueStr}</span>}
          </div>
          <div style={styles.dueEditor}>
            <label style={styles.dueLabel}>
              Prazo de execução
              <input
                type="date"
                value={dueDateInput}
                onChange={(e) => setDueDateInput(e.target.value)}
                style={styles.dueInput}
              />
            </label>
            <button
              type="button"
              onClick={handleUpdateDueDate}
              disabled={updatingDueDate}
              style={styles.dueButton}
            >
              {updatingDueDate ? "Atualizando…" : "Salvar prazo"}
            </button>
          </div>
          <div style={styles.ownersEditor}>
            <label style={styles.ownersLabel}>
              Responsáveis pela ação
              <input
                type="text"
                value={ownersInput}
                onChange={(e) => setOwnersInput(e.target.value)}
                placeholder="Ex.: Ana, João, Patrícia"
                style={styles.ownersInput}
              />
            </label>
            <button
              type="button"
              onClick={handleUpdateOwners}
              disabled={updatingOwners}
              style={styles.ownersButton}
            >
              {updatingOwners ? "Atualizando…" : "Salvar responsáveis"}
            </button>
          </div>
        </div>

        <div style={styles.section}>
          <h3 style={styles.sectionTitle}>Comentários</h3>
          {error && (
            <div style={styles.error}>
              {error}
            </div>
          )}
          {loading ? (
            <p style={styles.muted}>Carregando comentários…</p>
          ) : (
            <ul style={styles.commentList}>
              {comments.length === 0 ? (
                <li style={styles.muted}>Nenhum comentário ainda.</li>
              ) : (
                comments.map((c) => (
                  <li key={c.id} style={styles.commentItem}>
                    {editingId === c.id ? (
                      <div style={styles.editRow}>
                        <input
                          value={editContent}
                          onChange={(e) => setEditContent(e.target.value)}
                          style={styles.editInput}
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => c.id && saveEdit(c.id)}
                          style={styles.smallBtn}
                        >
                          Salvar
                        </button>
                        <button
                          type="button"
                          onClick={cancelEdit}
                          style={styles.smallBtnSecondary}
                        >
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <>
                        <p style={styles.commentContent}>{c.content}</p>
                        <div style={styles.commentMeta}>
                          <span style={styles.commentDate}>
                            {formatCommentDate(c.createdAt)}
                          </span>
                          <div style={styles.commentActions}>
                            <button
                              type="button"
                              onClick={() => startEdit(c)}
                              style={styles.smallBtn}
                            >
                              Editar
                            </button>
                            <button
                              type="button"
                              onClick={() => c.id && handleDelete(c.id)}
                              disabled={deletingId === c.id}
                              style={styles.smallBtnDanger}
                            >
                              {deletingId === c.id ? "Excluindo…" : "Excluir"}
                            </button>
                          </div>
                        </div>
                      </>
                    )}
                  </li>
                ))
              )}
            </ul>
          )}

          <form onSubmit={handleAddComment} style={styles.form}>
            <textarea
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              placeholder="Novo comentário..."
              style={styles.textarea}
              rows={2}
              disabled={sending}
            />
            <button
              type="submit"
              disabled={sending || !newComment.trim()}
              style={styles.submitBtn}
            >
              {sending ? "Salvando…" : "Salvar comentário"}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  overlay: {
    position: "fixed",
    inset: 0,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    zIndex: 1000,
    padding: "1rem",
  },
  modal: {
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    borderRadius: "16px",
    border: "1px solid rgba(255,255,255,0.12)",
    maxWidth: "560px",
    width: "100%",
    maxHeight: "90vh",
    overflow: "auto",
    boxShadow: "0 20px 60px rgba(0,0,0,0.4)",
  },
  header: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  title: {
    margin: 0,
    fontSize: "1.25rem",
    fontWeight: 700,
    color: "#fff",
  },
  closeBtn: {
    background: "none",
    border: "none",
    color: "#aaa",
    fontSize: "1.5rem",
    cursor: "pointer",
    lineHeight: 1,
    padding: "0.25rem",
  },
  actionInfo: {
    padding: "1.25rem 1.5rem",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  actionContent: {
    margin: "0 0 0.5rem",
    fontSize: "1rem",
    color: "#eee",
    lineHeight: 1.5,
  },
  meta: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.75rem",
    fontSize: "0.8rem",
    color: "#888",
  },
  meetingLabel: {
    color: "#4ecdc4",
  },
  status: {
    color: "#aaa",
  },
  due: {
    color: "#aaa",
  },
  dueEditor: {
    marginTop: "0.75rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    alignItems: "center",
    fontSize: "0.85rem",
    color: "#ccc",
  },
  dueLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
  },
  dueInput: {
    padding: "0.3rem 0.5rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(0,0,0,0.3)",
    color: "#eee",
    fontSize: "0.85rem",
  },
  dueButton: {
    padding: "0.4rem 0.7rem",
    borderRadius: "8px",
    border: "1px solid rgba(78, 205, 196, 0.6)",
    background: "rgba(78, 205, 196, 0.2)",
    color: "#4ecdc4",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  ownersEditor: {
    marginTop: "0.75rem",
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    alignItems: "center",
    fontSize: "0.85rem",
    color: "#ccc",
  },
  ownersLabel: {
    display: "flex",
    flexDirection: "column",
    gap: "0.25rem",
    flex: "1 1 220px",
  },
  ownersInput: {
    padding: "0.3rem 0.5rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.3)",
    background: "rgba(0,0,0,0.3)",
    color: "#eee",
    fontSize: "0.85rem",
  },
  ownersButton: {
    padding: "0.4rem 0.7rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.3)",
    background: "transparent",
    color: "#ddd",
    fontSize: "0.85rem",
    cursor: "pointer",
  },
  section: {
    padding: "1.25rem 1.5rem",
  },
  sectionTitle: {
    margin: "0 0 1rem",
    fontSize: "1rem",
    fontWeight: 600,
    color: "#fff",
  },
  error: {
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    background: "rgba(255, 107, 107, 0.2)",
    border: "1px solid rgba(255, 107, 107, 0.4)",
    color: "#ffb3b3",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  commentList: {
    listStyle: "none",
    margin: "0 0 1rem",
    padding: 0,
  },
  commentItem: {
    padding: "0.75rem 0",
    borderBottom: "1px solid rgba(255,255,255,0.06)",
  },
  commentContent: {
    margin: "0 0 0.35rem",
    fontSize: "0.95rem",
    color: "#ddd",
    lineHeight: 1.4,
  },
  commentMeta: {
    display: "flex",
    flexWrap: "wrap",
    alignItems: "center",
    gap: "0.5rem",
    fontSize: "0.75rem",
    color: "#888",
  },
  commentDate: {
    marginRight: "0.5rem",
  },
  commentActions: {
    display: "flex",
    gap: "0.4rem",
  },
  editRow: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
    alignItems: "flex-start",
  },
  editInput: {
    flex: "1 1 100%",
    minWidth: 0,
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.06)",
    color: "#eee",
    fontSize: "0.95rem",
  },
  form: {
    marginTop: "1rem",
  },
  textarea: {
    width: "100%",
    padding: "0.75rem",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(255,255,255,0.06)",
    color: "#eee",
    fontSize: "0.95rem",
    resize: "vertical",
    minHeight: "60px",
    marginBottom: "0.75rem",
    boxSizing: "border-box",
  },
  submitBtn: {
    padding: "0.5rem 1rem",
    borderRadius: "8px",
    border: "1px solid rgba(78, 205, 196, 0.5)",
    background: "rgba(78, 205, 196, 0.2)",
    color: "#4ecdc4",
    fontSize: "0.9rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  smallBtn: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    background: "rgba(78, 205, 196, 0.2)",
    border: "1px solid rgba(78, 205, 196, 0.4)",
    color: "#4ecdc4",
    borderRadius: "6px",
    cursor: "pointer",
  },
  smallBtnSecondary: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    background: "transparent",
    border: "1px solid rgba(255,255,255,0.3)",
    color: "#aaa",
    borderRadius: "6px",
    cursor: "pointer",
  },
  smallBtnDanger: {
    padding: "0.25rem 0.5rem",
    fontSize: "0.75rem",
    background: "rgba(255, 107, 107, 0.2)",
    border: "1px solid rgba(255, 107, 107, 0.4)",
    color: "#ffb3b3",
    borderRadius: "6px",
    cursor: "pointer",
  },
  muted: {
    color: "#888",
    fontSize: "0.9rem",
    margin: 0,
  },
};
