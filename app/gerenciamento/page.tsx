"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import type { Meeting, MeetingItem } from "@/lib/firestore-types";
import GerenciamentoList from "./GerenciamentoList";

type MeetingWithItems = Meeting & { items: MeetingItem[] };

export default function GerenciamentoPage() {
  const { user, loading: authLoading } = useAuth();
  const [meetingsWithItems, setMeetingsWithItems] = useState<
    MeetingWithItems[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (authLoading) return;
    if (!user?.email?.trim()) {
      setMeetingsWithItems([]);
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
          setMeetingsWithItems(data.meetings);
        } else {
          setMeetingsWithItems([]);
        }
        setError(data?.ok ? null : (data?.error ?? "Erro ao carregar dados."));
      })
      .catch(() => {
        setMeetingsWithItems([]);
        setError("Erro ao carregar dados do banco.");
      })
      .finally(() => setLoading(false));
  }, [user?.email, authLoading]);

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Gerenciamento de dados</h1>
          <p style={styles.subtitle}>
            Reuniões e itens salvos no Firestore. Ordenado por data (mais
            recente primeiro).
          </p>
          <Link href="/" style={styles.backLink}>
            ← Voltar ao início
          </Link>
        </div>

        {authLoading || loading ? (
          <div style={styles.empty}>
            <p>Carregando reuniões…</p>
          </div>
        ) : !user ? (
          <div style={styles.empty}>
            <p>Faça login para ver suas reuniões.</p>
            <p style={styles.emptyHint}>
              Use o mesmo e-mail vinculado às reuniões (ex.: no bot ou na migração).
            </p>
          </div>
        ) : error ? (
          <div style={styles.error}>
            <strong>Erro:</strong> {error}
          </div>
        ) : meetingsWithItems.length === 0 ? (
          <div style={styles.empty}>
            <p>Nenhuma reunião cadastrada no banco de dados.</p>
            <p style={styles.emptyHint}>
              Use o bot do Telegram para incluir reuniões; elas aparecerão aqui.
            </p>
          </div>
        ) : (
          <GerenciamentoList meetings={meetingsWithItems} />
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
    maxWidth: "720px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "2rem",
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
  stats: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    marginBottom: "1.5rem",
  },
  statsBadge: {
    padding: "0.5rem 0.9rem",
    borderRadius: "10px",
    background: "rgba(78, 205, 196, 0.2)",
    border: "1px solid rgba(78, 205, 196, 0.4)",
    color: "#4ecdc4",
    fontSize: "0.85rem",
    fontWeight: 600,
  },
  statsBadgeAccent: {
    padding: "0.5rem 0.9rem",
    borderRadius: "10px",
    background: "#4ecdc4",
    border: "1px solid rgba(78, 205, 196, 0.6)",
    color: "#1a1a2e",
    fontSize: "0.85rem",
    fontWeight: 700,
  },
  list: {
    display: "flex",
    flexDirection: "column",
    gap: "1.25rem",
  },
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
  textoCompleto: {
    marginBottom: "1rem",
  },
  textoContent: {
    margin: 0,
    fontSize: "0.95rem",
    lineHeight: 1.5,
    color: "#ccc",
    whiteSpace: "pre-wrap",
    wordBreak: "break-word",
  },
  itemsSection: {
    marginBottom: "0.5rem",
  },
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
  itemContent: {
    flex: 1,
    fontSize: "0.95rem",
    color: "#ddd",
    lineHeight: 1.4,
  },
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
};
