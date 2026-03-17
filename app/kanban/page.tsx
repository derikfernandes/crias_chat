"use client";

import Link from "next/link";
import { useEffect, useState, useMemo, useRef } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { MeetingItem } from "@/lib/firestore-types";
import KanbanBoard from "./KanbanBoard";

type ActionWithMeeting = MeetingItem & {
  meetingId: string;
  meetingAssunto: string;
  meetingTema?: string;
};

function extractActionsFromMeetings(
  meetings: Array<{ id?: string; assunto?: string; tema?: string; items: MeetingItem[] }>
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
          meetingTema: m.tema,
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
  const [selectedOwners, setSelectedOwners] = useState<string[]>([]);
  const [selectedThemes, setSelectedThemes] = useState<string[]>([]);
  const [themeFilter, setThemeFilter] = useState("");
  const [themeOptionsOpen, setThemeOptionsOpen] = useState(false);
  const themeOptionsRef = useRef<HTMLDivElement | null>(null);

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

  const subjects = useMemo(
    () =>
      Array.from(new Set(actions.map((a) => a.meetingAssunto))).sort((a, b) =>
        a.localeCompare(b, "pt-BR")
      ),
    [actions]
  );

  const themes = useMemo(
    () =>
      Array.from(
        new Set(
          actions
            .map((a) => (a.meetingTema ?? "").trim())
            .filter((t) => t.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [actions]
  );

  const owners = useMemo(
    () =>
      Array.from(
        new Set(
          actions
            .flatMap((a) =>
              Array.isArray(a.actionOwners) ? a.actionOwners : []
            )
            .map((o) => o.trim())
            .filter((o) => o.length > 0)
        )
      ).sort((a, b) => a.localeCompare(b, "pt-BR")),
    [actions]
  );

  useEffect(() => {
    if (!themeOptionsOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (
        themeOptionsRef.current &&
        !themeOptionsRef.current.contains(e.target as Node)
      ) {
        setThemeOptionsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [themeOptionsOpen]);

  const toggleSubject = (assunto: string) => {
    setSelectedSubjects((prev) =>
      prev.includes(assunto)
        ? prev.filter((s) => s !== assunto)
        : [...prev, assunto]
    );
  };

  const toggleOwner = (owner: string) => {
    setSelectedOwners((prev) =>
      prev.includes(owner)
        ? prev.filter((s) => s !== owner)
        : [...prev, owner]
    );
  };

  const toggleTheme = (tema: string) => {
    setSelectedThemes((prev) =>
      prev.includes(tema) ? prev.filter((s) => s !== tema) : [...prev, tema]
    );
  };

  let filteredActions = actions;
  if (selectedSubjects.length > 0) {
    filteredActions = filteredActions.filter((a) =>
      selectedSubjects.includes(a.meetingAssunto)
    );
  }
  if (selectedOwners.length > 0) {
    filteredActions = filteredActions.filter((a) =>
      (a.actionOwners ?? []).some((o) => selectedOwners.includes(o))
    );
  }
  if (selectedThemes.length > 0) {
    filteredActions = filteredActions.filter((a) => {
      const tema = (a.meetingTema ?? "").trim();
      return tema && selectedThemes.includes(tema);
    });
  }

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

            {themes.length > 0 && (
              <div
                style={{
                  marginTop: "0.25rem",
                  position: "relative",
                }}
                ref={themeOptionsRef}
              >
                <span style={styles.filtersLabel}>Filtrar por tema:</span>
                <div
                  style={{
                    display: "flex",
                    alignItems: "stretch",
                    gap: 0,
                    borderRadius: "999px",
                    border: "1px solid rgba(255,255,255,0.2)",
                    background: "rgba(0,0,0,0.25)",
                    overflow: "hidden",
                    marginTop: "0.25rem",
                  }}
                >
                  <input
                    type="text"
                    value={themeFilter}
                    onChange={(e) => setThemeFilter(e.target.value)}
                    placeholder="Digite ou selecione um tema..."
                    style={{
                      flex: 1,
                      padding: "0.4rem 0.7rem",
                      border: "none",
                      background: "transparent",
                      color: "#eee",
                      fontSize: "0.85rem",
                      fontFamily: "inherit",
                      outline: "none",
                    }}
                    onFocus={() => setThemeOptionsOpen(true)}
                  />
                  {themeFilter && (
                    <button
                      type="button"
                      onClick={() => setThemeFilter("")}
                      style={{
                        padding: "0.35rem 0.55rem",
                        border: "none",
                        borderLeft: "1px solid rgba(255,255,255,0.15)",
                        background: "transparent",
                        color: "#888",
                        cursor: "pointer",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        fontSize: "0.85rem",
                      }}
                      title="Limpar campo de tema"
                      aria-label="Limpar campo de tema"
                    >
                      ×
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => setThemeOptionsOpen((o) => !o)}
                    style={{
                      padding: "0.35rem 0.6rem",
                      border: "none",
                      borderLeft: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(255,255,255,0.06)",
                      color: "#4ecdc4",
                      cursor: "pointer",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      transition: "transform 0.2s ease",
                      transform: themeOptionsOpen
                        ? "rotate(180deg)"
                        : "rotate(0deg)",
                    }}
                    title={
                      themeOptionsOpen
                        ? "Fechar opções de tema"
                        : "Ver opções de tema"
                    }
                    aria-expanded={themeOptionsOpen}
                    aria-haspopup="listbox"
                  >
                    <svg
                      width="18"
                      height="18"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="6 9 12 15 18 9" />
                    </svg>
                  </button>
                </div>
                {themeOptionsOpen && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      marginTop: "0.25rem",
                      maxHeight: "220px",
                      overflowY: "auto",
                      borderRadius: "10px",
                      border: "1px solid rgba(255,255,255,0.2)",
                      background: "rgba(26,26,46,0.98)",
                      boxShadow: "0 8px 24px rgba(0,0,0,0.4)",
                      zIndex: 40,
                    }}
                    role="listbox"
                    aria-label="Temas disponíveis"
                  >
                    {themes
                      .filter((t) =>
                        themeFilter.trim()
                          ? t
                              .toLowerCase()
                              .includes(themeFilter.trim().toLowerCase())
                          : true
                      )
                      .map((tema, i, arr) => {
                        const active = selectedThemes.includes(tema);
                        return (
                          <div
                            key={tema}
                            role="option"
                            tabIndex={0}
                            style={{
                              padding: "0.5rem 0.85rem",
                              fontSize: "0.9rem",
                              color: active ? "#4ecdc4" : "#ddd",
                              cursor: "pointer",
                              borderBottom:
                                i === arr.length - 1
                                  ? "none"
                                  : "1px solid rgba(255,255,255,0.06)",
                              background: active
                                ? "rgba(78,205,196,0.22)"
                                : "transparent",
                              fontWeight: active ? 600 : 400,
                            }}
                            onMouseEnter={(e) => {
                              if (!active) {
                                e.currentTarget.style.background =
                                  "rgba(78,205,196,0.15)";
                                e.currentTarget.style.color = "#4ecdc4";
                              }
                            }}
                            onMouseLeave={(e) => {
                              e.currentTarget.style.background = active
                                ? "rgba(78,205,196,0.22)"
                                : "transparent";
                              e.currentTarget.style.color = active
                                ? "#4ecdc4"
                                : "#ddd";
                            }}
                            onClick={() => {
                              toggleTheme(tema);
                            }}
                          >
                            {tema}
                          </div>
                        );
                      })}
                    {themes.filter((t) =>
                      themeFilter.trim()
                        ? t
                            .toLowerCase()
                            .includes(themeFilter.trim().toLowerCase())
                        : true
                    ).length === 0 && (
                      <div
                        style={{
                          padding: "0.5rem 0.85rem",
                          fontSize: "0.85rem",
                          color: "#888",
                        }}
                      >
                        Nenhum tema encontrado.
                      </div>
                    )}
                  </div>
                )}
                {selectedThemes.length > 0 && (
                  <div
                    style={{
                      display: "flex",
                      flexWrap: "wrap",
                      gap: "0.4rem",
                      marginTop: "0.4rem",
                    }}
                  >
                    {selectedThemes.map((tema) => (
                      <button
                        key={tema}
                        type="button"
                        onClick={() => toggleTheme(tema)}
                        style={{
                          padding: "0.2rem 0.55rem",
                          borderRadius: "999px",
                          border:
                            "1px solid rgba(78,205,196,0.6)",
                          background: "rgba(78,205,196,0.12)",
                          color: "#4ecdc4",
                          fontSize: "0.8rem",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: "0.25rem",
                          cursor: "pointer",
                        }}
                      >
                        <span>{tema}</span>
                        <span aria-hidden="true">×</span>
                      </button>
                    ))}
                    {selectedThemes.length > 1 && (
                      <button
                        type="button"
                        onClick={() => setSelectedThemes([])}
                        style={{
                          padding: "0.2rem 0.55rem",
                          borderRadius: "999px",
                          border:
                            "1px solid rgba(255,255,255,0.2)",
                          background: "transparent",
                          color: "#999",
                          fontSize: "0.8rem",
                          cursor: "pointer",
                        }}
                      >
                        Limpar temas
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}

            {owners.length > 0 && (
              <>
                <span style={styles.filtersLabel}>
                  Filtrar por responsáveis:
                </span>
                <div style={styles.filtersChips}>
                  {owners.map((owner) => {
                    const active = selectedOwners.includes(owner);
                    return (
                      <button
                        key={owner}
                        type="button"
                        onClick={() => toggleOwner(owner)}
                        style={{
                          ...styles.filterChip,
                          ...(active ? styles.filterChipActive : null),
                        }}
                      >
                        {owner}
                      </button>
                    );
                  })}
                  {selectedOwners.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedOwners([])}
                      style={styles.clearFilters}
                    >
                      Limpar filtros de responsáveis
                    </button>
                  )}
                </div>
              </>
            )}
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
