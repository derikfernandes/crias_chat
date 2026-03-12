"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PROMPT_NAMES, getPrompt, setPrompt } from "@/lib/prompts/loader";

type PromptsState = Record<string, string>;

export default function AdminPromptsPage() {
  const { user } = useAuth();
  const [prompts, setPromptsState] = useState<PromptsState>({});
  const [loading, setLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const names = Object.values(PROMPT_NAMES);
      const entries = await Promise.all(
        names.map(async (name) => {
          try {
            const content = await getPrompt(name);
            return [name, content] as const;
          } catch {
            // Ainda não criado → mostrar vazio para o admin preencher.
            return [name, ""] as const;
          }
        })
      );
      setPromptsState(Object.fromEntries(entries));
    } catch (e) {
      setError(
        e instanceof Error
          ? e.message
          : "Erro ao carregar prompts. Verifique se o Firestore está configurado."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadAll();
    }
  }, [user, loadAll]);

  const handleChange = useCallback((key: string, value: string) => {
    setPromptsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSave = useCallback(
    async (key: string) => {
      setSavingKey(key);
      setError(null);
      setSuccess(null);
      try {
        await setPrompt(key, prompts[key] ?? "");
        setSuccess(`Prompt "${key}" salvo com sucesso.`);
      } catch (e) {
        setError(
          e instanceof Error
            ? e.message
            : "Erro ao salvar prompt. Verifique se você é admin no Firestore."
        );
      } finally {
        setSavingKey(null);
      }
    },
    [prompts]
  );

  if (!user) {
    return null;
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Admin · Prompts dos bots</h1>
          <p style={styles.subtitle}>
            Todos os bots e o classificador usam exclusivamente estes textos
            salvos no Firestore (coleção <code>prompts</code>).
          </p>
          <Link href="/home" style={styles.backLink}>
            ← Voltar à home
          </Link>
        </header>

        {error && <div style={styles.error}>{error}</div>}
        {success && <div style={styles.success}>{success}</div>}

        {loading ? (
          <p style={styles.muted}>Carregando prompts...</p>
        ) : (
          <section style={styles.section}>
            {Object.values(PROMPT_NAMES).map((name) => (
              <div key={name} style={styles.promptCard}>
                <label style={styles.promptLabel}>{name}</label>
                <textarea
                  value={prompts[name] ?? ""}
                  onChange={(e) => handleChange(name, e.target.value)}
                  rows={10}
                  style={styles.textarea}
                  placeholder={`Texto completo do prompt "${name}"`}
                />
                <button
                  type="button"
                  onClick={() => handleSave(name)}
                  disabled={savingKey === name}
                  style={styles.button}
                >
                  {savingKey === name ? "Salvando…" : "Salvar"}
                </button>
              </div>
            ))}
          </section>
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
    maxWidth: "900px",
    margin: "0 auto",
  },
  header: {
    marginBottom: "2rem",
  },
  title: {
    margin: "0 0 0.5rem",
    fontSize: "1.8rem",
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
  section: {
    background: "rgba(255,255,255,0.04)",
    borderRadius: "14px",
    padding: "1.5rem 1.75rem",
    border: "1px solid rgba(255,255,255,0.06)",
  },
  promptCard: {
    marginBottom: "1.5rem",
  },
  promptLabel: {
    display: "block",
    marginBottom: "0.5rem",
    fontWeight: 600,
    color: "#ddd",
    fontSize: "0.95rem",
  },
  textarea: {
    width: "100%",
    boxSizing: "border-box",
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.25)",
    color: "#eee",
    fontSize: "0.9rem",
    fontFamily: "inherit",
    resize: "vertical",
    marginBottom: "0.5rem",
  },
  button: {
    padding: "0.6rem 1.4rem",
    borderRadius: "10px",
    background: "#4ecdc4",
    border: "none",
    color: "#1a1a2e",
    fontSize: "0.95rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  error: {
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    background: "rgba(255, 107, 107, 0.2)",
    border: "1px solid rgba(255, 107, 107, 0.4)",
    color: "#ffb3b3",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  success: {
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    background: "rgba(78, 205, 196, 0.15)",
    border: "1px solid rgba(78, 205, 196, 0.4)",
    color: "#4ecdc4",
    marginBottom: "1rem",
    fontSize: "0.9rem",
  },
  muted: {
    color: "#888",
    fontSize: "0.95rem",
  },
};

