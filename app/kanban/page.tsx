"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { MeetingItem } from "@/lib/firestore-types";
import KanbanBoard from "./KanbanBoard";

type ActionWithMeeting = MeetingItem & {
  meetingId: string;
  meetingAssunto: string;
};

function extractActionsFromMeetings(
  meetings: Array<{ id?: string; assunto?: string; items: MeetingItem[] }>
): ActionWithMeeting[] {
  const actions: ActionWithMeeting[] = [];
  for (const m of meetings) {
    if (!m.id) continue;
    for (const item of m.items ?? []) {
      if (item.type === "action") {
        actions.push({
          ...item,
          meetingId: m.id,
          meetingAssunto: m.assunto ?? "Reunião",
        });
      }
    }
  }
  return actions;
}

export default function KanbanPage() {
  const { user, loading: authLoading } = useAuth();
  const [actions, setActions] = useState<ActionWithMeeting[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedSubjects, setSelectedSubjects] = useState<string[]>([]);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email?.trim()) {
      setActions([]);
      setLoading(false);
      setError(null);
      return;
    }
    setLoading(true);
    setError(null);
    fetch("/api/meetings", {
      headers: { "X-User-Email": user.email },
      cache: "no-store",
    })
      .then((res) => res.json())
      .then((data) => {
        if (data?.ok && Array.isArray(data.meetings)) {
          setActions(extractActionsFromMeetings(data.meetings));
        } else {
          setActions([]);
        }
        setError(
          data?.ok ? null : (data?.error ?? "Erro ao carregar ações.")
        );
      })
      .catch(() => {
        setActions([]);
        setError("Erro ao carregar ações.");
      })
      .finally(() => setLoading(false));
  }, [user?.email, authLoading]);

  const subjects = Array.from(
    new Set(actions.map((a) => a.meetingAssunto))
  ).sort((a, b) => a.localeCompare(b, "pt-BR"));

  const toggleSubject = (assunto: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(assunto)
        ? prev.filter((s) => s !== assunto)
        : [...prev, assunto]
    );
  };

  const filteredActions =
    selectedSubjects.length === 0
      ? actions
      : actions.filter((a) => selectedSubjects.includes(a.meetingAssunto));

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Kanban de ações</h1>
          <p style={styles.subtitle}>
            Ações extraídas das reuniões. Mova entre colunas para atualizar o status.
          </p>
          <Link href="/" style={styles.backLink}>
            ← Voltar ao início
          </Link>
        </div>

        {user && !authLoading && !loading && actions.length > 0 && (
          <div style={styles.filtersContainer}>
            <span style={styles.filtersLabel}>Filtrar por assunto:</span>
            <div style={styles.filtersChips}>
              {subjects.map((assunto) => {
                const active = selectedSubjects.includes(assunto);
                return (
                  <button
                    key={assunto}
                    type="button"
                    onClick={() => toggleSubject(assunto)}
                    style={{
                      ...styles.filterChip,
                      ...(active ? styles.filterChipActive : null),
                    }}
                  >
                    {assunto}
                  </button>
                );
              })}
              {subjects.length > 0 && selectedSubjects.length > 0 && (
                <button
                  type="button"
                  onClick={() => setSelectedSubjects([])}
                  style={styles.clearFilters}
                >
                  Limpar filtros
                </button>
              )}
            </div>
          </div>
        )}

        {authLoading || loading ? (
          <div style={styles.empty}>
            <p>Carregando ações…</p>
          </div>
        ) : !user ? (
          <div style={styles.empty}>
            <p>Faça login para ver o Kanban de ações.</p>
            <p style={styles.emptyHint}>
              Itens do tipo &quot;action&quot; das suas reuniões aparecem aqui.
            </p>
          </div>
        ) : error ? (
          <div style={styles.error}>
            <strong>Erro:</strong> {error}
          </div>
        ) : actions.length === 0 ? (
          <div style={styles.empty}>
            <p>Nenhuma ação cadastrada.</p>
            <p style={styles.emptyHint}>
              Itens do tipo &quot;action&quot; das reuniões aparecem aqui.
            </p>
          </div>
        ) : (
          <KanbanBoard
            actions={filteredActions}
            userEmail={user?.email ?? undefined}
          />
        )}
      </div>
    </main>
  );
}

const styles: Record<string, React.CSSProperties> = {
  main: {
    minHeight: "100vh",
    padding: "2rem",
    fontFamily: "system-ui, sans-serif",
    background: "linear-gradient(135deg, #1a1a2e 0%, #16213e 100%)",
    color: "#eee",
  },
  container: {
    maxWidth: "1200px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "1.25rem",
  },
  title: {
    margin: "0 0 0.5rem",
    fontSize: "1.75rem",
    fontWeight: 700,
    color: "#fff",
  },
  subtitle: {
    margin: "0 0 1rem",
    fontSize: "0.95rem",
    color: "#aaa",
    lineHeight: 1.5,
  },
  backLink: {
    display: "inline-block",
    color: "#4ecdc4",
    fontSize: "0.9rem",
    textDecoration: "none",
    marginTop: "0.5rem",
  },
  filtersContainer: {
    marginBottom: "1.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  filtersLabel: {
    fontSize: "0.85rem",
    color: "#aaa",
  },
  filtersChips: {
    display: "flex",
    flexWrap: "wrap",
    gap: "0.5rem",
  },
  filterChip: {
    padding: "0.3rem 0.7rem",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.25)",
    background: "rgba(255,255,255,0.06)",
    color: "#ddd",
    fontSize: "0.8rem",
    cursor: "pointer",
  },
  filterChipActive: {
    border: "1px solid rgba(78, 205, 196, 0.8)",
    background: "rgba(78, 205, 196, 0.2)",
    color: "#4ecdc4",
  },
  clearFilters: {
    padding: "0.3rem 0.7rem",
    borderRadius: "999px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "transparent",
    color: "#aaa",
    fontSize: "0.75rem",
    cursor: "pointer",
  },
  error: {
    padding: "1rem 1.25rem",
    borderRadius: "12px",
    background: "rgba(255, 107, 107, 0.2)",
    border: "1px solid rgba(255, 107, 107, 0.4)",
    color: "#ffb3b3",
    marginBottom: "1.5rem",
  },
  empty: {
    textAlign: "center",
    padding: "3rem 1.5rem",
    background: "rgba(255,255,255,0.05)",
    borderRadius: "12px",
    color: "#aaa",
  },
  emptyHint: {
    marginTop: "0.75rem",
    fontSize: "0.9rem",
    color: "#888",
  },
};
