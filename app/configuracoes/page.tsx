"use client";

import Link from "next/link";
import { useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { saveTelegramLink } from "@/lib/telegram-links";

const BOT_USERNAME = "Crias_chat_bot";

export default function ConfiguracoesPage() {
  const { user } = useAuth();
  const [telegramId, setTelegramId] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSave = useCallback(async () => {
    if (!user?.email?.trim()) {
      setError("Faça login para vincular.");
      return;
    }
    const raw = telegramId.trim().replace(/\D/g, "");
    const num = raw ? parseInt(raw, 10) : NaN;
    if (!Number.isInteger(num) || num <= 0) {
      setError("Digite o número do seu perfil no Telegram (apenas números).");
      return;
    }
    setError(null);
    setSuccess(false);
    setLoading(true);
    try {
      await saveTelegramLink(num, user.email);
      setSuccess(true);
    } catch (e) {
      const message =
        e instanceof Error ? e.message : "Erro ao salvar. Tente de novo.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }, [user?.email, telegramId]);

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <div style={styles.header}>
          <h1 style={styles.title}>Configurações</h1>
          <p style={styles.subtitle}>
            Vincule seu perfil do Telegram à sua conta. Assim, no bot você só
            vê e grava as suas reuniões.
          </p>
          <Link href="/" style={styles.backLink}>
            ← Voltar ao início
          </Link>
        </div>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Vincular Telegram</h2>
          <p style={styles.cardDesc}>
            Informe o <strong>número do seu perfil no Telegram</strong> (ID
            numérico). Esse número será vinculado ao e-mail desta conta (
            {user?.email ?? "—"}).
          </p>
          <p style={styles.hint}>
            Para descobrir seu ID: envie qualquer mensagem para @{BOT_USERNAME}{" "}
            e o bot pode responder com seu ID, ou use o bot @userinfobot no
            Telegram.
          </p>

          {error && <div style={styles.error}>{error}</div>}
          {success && (
            <div style={styles.success}>
              Vinculação salva. Use o bot no Telegram; consultas e gravações
              usarão esta conta.
            </div>
          )}

          <div style={styles.row}>
            <input
              type="text"
              inputMode="numeric"
              placeholder="Ex: 123456789"
              value={telegramId}
              onChange={(e) => setTelegramId(e.target.value)}
              style={styles.input}
              aria-label="ID do perfil no Telegram"
            />
            <button
              type="button"
              onClick={handleSave}
              disabled={loading}
              style={styles.button}
            >
              {loading ? "Salvando…" : "Salvar vinculação"}
            </button>
          </div>
        </section>
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
    maxWidth: "560px",
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
  card: {
    background: "rgba(255,255,255,0.06)",
    borderRadius: "14px",
    padding: "1.5rem 1.75rem",
    border: "1px solid rgba(255,255,255,0.08)",
    boxShadow: "0 8px 32px rgba(0,0,0,0.2)",
  },
  cardTitle: {
    margin: "0 0 0.5rem",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#fff",
  },
  cardDesc: {
    margin: "0 0 0.75rem",
    fontSize: "0.9rem",
    color: "#aaa",
    lineHeight: 1.5,
  },
  hint: {
    margin: "0 0 1rem",
    fontSize: "0.85rem",
    color: "#888",
    lineHeight: 1.4,
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
  row: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
  },
  input: {
    flex: "1 1 200px",
    minWidth: "120px",
    padding: "0.75rem 1rem",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.2)",
    color: "#eee",
    fontSize: "1rem",
  },
  button: {
    padding: "0.75rem 1.5rem",
    borderRadius: "10px",
    background: "#4ecdc4",
    border: "none",
    color: "#1a1a2e",
    fontSize: "1rem",
    fontWeight: 600,
    cursor: "pointer",
  },
};
