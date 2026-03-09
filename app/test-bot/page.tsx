"use client";

import Link from "next/link";
import { useState, useRef, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  time: string;
};

type DebugStep = { name: string; reply: string };

type DebugEntry = {
  userText: string;
  botReply: string;
  time: string;
  steps: DebugStep[];
};

export default function TestBotPage() {
  const { user } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(true);
  const [debugEntries, setDebugEntries] = useState<DebugEntry[]>([]);
  const [debugOpen, setDebugOpen] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

  useEffect(() => {
    if (!user?.email?.trim()) {
      setMessages([]);
      setLoadingHistory(false);
      return;
    }
    fetch("/api/telegram/test/history", {
      headers: { "X-User-Email": user.email },
    })
      .then((res) => res.json())
      .then((data) => {
        const history = Array.isArray(data?.history) ? data.history : [];
        const loaded: Message[] = history.map((m: { role: string; text: string }, i: number) => ({
          id: `hist-${i}`,
          role: m.role === "model" ? "bot" : "user",
          text: m.text ?? "",
          time: "—",
        }));
        setMessages(loaded);
      })
      .catch(() => setMessages([]))
      .finally(() => setLoadingHistory(false));
  }, [user?.email]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || loading) return;

    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      text,
      time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
    };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const res = await fetch("/api/telegram/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          text,
          debug: true,
          userEmail: user?.email ?? undefined,
        }),
      });
      const data = await res.json();
      const replyText = data?.reply ?? (data?.ok === false ? "Erro ao obter resposta." : "...");
      const steps: DebugStep[] = Array.isArray(data?.debug) ? data.debug : [];

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);

      if (steps.length > 0) {
        setDebugEntries((prev) => [
          ...prev,
          {
            userText: text,
            botReply: replyText,
            time: botMsg.time,
            steps,
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: crypto.randomUUID(),
          role: "bot",
          text: "Erro de conexão. Verifique se o servidor está rodando.",
          time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  function downloadDebugTxt() {
    if (debugEntries.length === 0) return;
    const lines: string[] = [
      "=== Debug — Bots e respostas ===",
      `Gerado em: ${new Date().toLocaleString("pt-BR")}`,
      "",
    ];
    debugEntries.forEach((entry, idx) => {
      lines.push(`--- Entrada ${idx + 1} (${entry.time}) ---`);
      lines.push(`Você: ${entry.userText}`);
      lines.push(`Resposta final: ${entry.botReply}`);
      entry.steps.forEach((step) => {
        lines.push("");
        lines.push(`[${step.name}]`);
        lines.push(step.reply);
      });
      lines.push("");
    });
    const blob = new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `debug-bot-${new Date().toISOString().slice(0, 10)}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <main style={styles.main}>
      <button
        type="button"
        onClick={() => setDebugOpen((o) => !o)}
        style={styles.debugIcon}
        title="Ver debug (bots e respostas)"
        aria-label="Abrir painel de debug"
      >
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" />
          <path d="M7 8h10M7 12h10M7 16h6" />
        </svg>
      </button>

      {debugOpen && (
        <div style={styles.debugOverlay} onClick={() => setDebugOpen(false)} role="presentation">
          <div style={styles.debugPanel} onClick={(e) => e.stopPropagation()}>
            <div style={styles.debugHeader}>
              <h2 style={styles.debugTitle}>Debug — Bots e respostas</h2>
              <div style={styles.debugHeaderActions}>
                <button
                  type="button"
                  onClick={downloadDebugTxt}
                  disabled={debugEntries.length === 0}
                  style={{
                    ...styles.debugDownload,
                    opacity: debugEntries.length === 0 ? 0.5 : 1,
                    cursor: debugEntries.length === 0 ? "not-allowed" : "pointer",
                  }}
                  title="Baixar debug completo em .txt"
                >
                  Baixar .txt
                </button>
                <button type="button" onClick={() => setDebugOpen(false)} style={styles.debugClose}>×</button>
              </div>
            </div>
            <div style={styles.debugContent}>
              {debugEntries.length === 0 ? (
                <p style={styles.debugEmpty}>Envie uma mensagem para ver aqui qual bot respondeu e o que cada um retornou.</p>
              ) : (
                debugEntries.map((entry, idx) => (
                  <div key={idx} style={styles.debugEntry}>
                    <div style={styles.debugEntryMeta}>
                      <strong>Você:</strong> {entry.userText}
                    </div>
                    <div style={styles.debugEntryMeta}>
                      <strong>Resposta final:</strong> {entry.botReply}
                    </div>
                    <div style={styles.debugSteps}>
                      {entry.steps.map((step, i) => (
                        <div key={i} style={styles.debugStep}>
                          <span style={styles.debugStepName}>{step.name}</span>
                          <pre style={styles.debugStepReply}>{step.reply}</pre>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      <div style={styles.card}>
        <div style={styles.homeButtonRow}>
          <Link href="/" style={styles.homeButton}>
            ← Início
          </Link>
        </div>
        <h1 style={styles.title}>Testar Bot (localhost)</h1>
        <p style={styles.subtitle}>
          Simula conversas com o bot sem conectar ao Telegram. O histórico é restaurado ao abrir a página.
        </p>

        <div ref={listRef} style={styles.messageList}>
          {loadingHistory && (
            <p style={styles.placeholder}>Carregando histórico...</p>
          )}
          {!loadingHistory && messages.length === 0 && (
            <p style={styles.placeholder}>Envie uma mensagem para testar o bot.</p>
          )}
          {!loadingHistory && messages.map((msg) => (
            <div
              key={msg.id}
              style={{
                ...styles.message,
                ...(msg.role === "user" ? styles.userMessage : styles.botMessage),
              }}
            >
              <span style={styles.messageRole}>{msg.role === "user" ? "Você" : "Bot"}</span>
              <span style={styles.messageText}>{msg.text}</span>
              <span style={styles.messageTime}>{msg.time}</span>
            </div>
          ))}
        </div>

        <form onSubmit={handleSubmit} style={styles.form}>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Digite uma mensagem..."
            style={styles.input}
            disabled={loading}
          />
          <button type="submit" style={styles.button} disabled={loading}>
            {loading ? "..." : "Enviar"}
          </button>
        </form>
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
    position: "relative",
  },
  debugIcon: {
    position: "fixed",
    top: "1rem",
    right: "1rem",
    zIndex: 50,
    width: "44px",
    height: "44px",
    borderRadius: "12px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(255,255,255,0.08)",
    color: "#4ecdc4",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: "0 4px 12px rgba(0,0,0,0.2)",
  },
  debugOverlay: {
    position: "fixed",
    inset: 0,
    zIndex: 100,
    background: "rgba(0,0,0,0.6)",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    padding: "1.5rem",
  },
  debugPanel: {
    background: "linear-gradient(180deg, #1a1a2e 0%, #16213e 100%)",
    borderRadius: "16px",
    maxWidth: "560px",
    width: "100%",
    maxHeight: "85vh",
    overflow: "hidden",
    boxShadow: "0 20px 60px rgba(0,0,0,0.5)",
    border: "1px solid rgba(255,255,255,0.1)",
    display: "flex",
    flexDirection: "column",
  },
  debugHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "1rem 1.25rem",
    borderBottom: "1px solid rgba(255,255,255,0.1)",
  },
  debugHeaderActions: {
    display: "flex",
    alignItems: "center",
    gap: "0.5rem",
  },
  debugDownload: {
    padding: "0.5rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid rgba(78, 205, 196, 0.5)",
    background: "rgba(78, 205, 196, 0.15)",
    color: "#4ecdc4",
    fontSize: "0.85rem",
    fontWeight: 600,
    cursor: "pointer",
  },
  debugTitle: {
    margin: 0,
    fontSize: "1.1rem",
    fontWeight: 600,
    color: "#eee",
  },
  debugClose: {
    width: "36px",
    height: "36px",
    borderRadius: "8px",
    border: "none",
    background: "rgba(255,255,255,0.08)",
    color: "#aaa",
    fontSize: "1.5rem",
    lineHeight: 1,
    cursor: "pointer",
  },
  debugContent: {
    overflowY: "auto",
    padding: "1rem 1.25rem",
    flex: 1,
  },
  debugEmpty: {
    color: "#888",
    fontSize: "0.95rem",
    textAlign: "center" as const,
    padding: "2rem",
  },
  debugEntry: {
    marginBottom: "1.5rem",
    paddingBottom: "1.5rem",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
  },
  debugEntryMeta: {
    fontSize: "0.85rem",
    marginBottom: "0.5rem",
    color: "#bbb",
    wordBreak: "break-word" as const,
  },
  debugSteps: {
    marginTop: "0.75rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.5rem",
  },
  debugStep: {
    background: "rgba(0,0,0,0.25)",
    borderRadius: "8px",
    padding: "0.6rem 0.8rem",
    borderLeft: "3px solid #4ecdc4",
  },
  debugStepName: {
    fontSize: "0.75rem",
    fontWeight: 700,
    color: "#4ecdc4",
    textTransform: "uppercase" as const,
    letterSpacing: "0.05em",
    display: "block",
    marginBottom: "0.35rem",
  },
  debugStepReply: {
    margin: 0,
    fontSize: "0.8rem",
    whiteSpace: "pre-wrap" as const,
    wordBreak: "break-word" as const,
    color: "#ddd",
    fontFamily: "inherit",
  },
  card: {
    maxWidth: "480px",
    margin: "0 auto",
    background: "rgba(255,255,255,0.06)",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
  },
  homeButtonRow: {
    display: "flex",
    justifyContent: "flex-start",
    marginBottom: "0.75rem",
  },
  homeButton: {
    display: "inline-block",
    padding: "0.45rem 0.75rem",
    borderRadius: "8px",
    border: "1px solid rgba(78, 205, 196, 0.45)",
    color: "#4ecdc4",
    textDecoration: "none",
    fontSize: "0.85rem",
    fontWeight: 600,
    background: "rgba(78, 205, 196, 0.12)",
  },
  title: {
    margin: "0 0 0.5rem",
    fontSize: "1.5rem",
  },
  subtitle: {
    margin: "0 0 1rem",
    fontSize: "0.9rem",
    color: "#aaa",
    lineHeight: 1.4,
  },
  messageList: {
    minHeight: "240px",
    maxHeight: "360px",
    overflowY: "auto",
    marginBottom: "1rem",
    padding: "0.5rem 0",
  },
  placeholder: {
    color: "#666",
    fontSize: "0.9rem",
    textAlign: "center" as const,
    padding: "2rem",
  },
  message: {
    padding: "0.6rem 0.8rem",
    borderRadius: "10px",
    marginBottom: "0.5rem",
    display: "flex",
    flexDirection: "column",
    gap: "0.2rem",
  },
  userMessage: {
    background: "rgba(78, 205, 196, 0.2)",
    marginLeft: "1.5rem",
    borderLeft: "3px solid #4ecdc4",
  },
  botMessage: {
    background: "rgba(255, 107, 107, 0.15)",
    marginRight: "1.5rem",
    borderLeft: "3px solid #ff6b6b",
  },
  messageRole: {
    fontSize: "0.75rem",
    fontWeight: 600,
    color: "#aaa",
  },
  messageText: {
    fontSize: "1rem",
  },
  messageTime: {
    fontSize: "0.7rem",
    color: "#888",
    alignSelf: "flex-end",
  },
  form: {
    display: "flex",
    gap: "0.5rem",
  },
  input: {
    flex: 1,
    padding: "0.6rem 0.8rem",
    borderRadius: "8px",
    border: "1px solid rgba(255,255,255,0.15)",
    background: "rgba(0,0,0,0.2)",
    color: "#eee",
    fontSize: "1rem",
  },
  button: {
    padding: "0.6rem 1rem",
    borderRadius: "8px",
    border: "none",
    background: "#4ecdc4",
    color: "#1a1a2e",
    fontWeight: 600,
    cursor: "pointer",
  },
};
