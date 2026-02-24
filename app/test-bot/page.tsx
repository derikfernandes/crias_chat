"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "bot";
  text: string;
  time: string;
};

export default function TestBotPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    listRef.current?.scrollTo(0, listRef.current.scrollHeight);
  }, [messages]);

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
        body: JSON.stringify({ text }),
      });
      const data = await res.json();
      const replyText = data?.reply ?? (data?.ok === false ? "Erro ao obter resposta." : "...");

      const botMsg: Message = {
        id: crypto.randomUUID(),
        role: "bot",
        text: replyText,
        time: new Date().toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" }),
      };
      setMessages((prev) => [...prev, botMsg]);
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

  return (
    <main style={styles.main}>
      <div style={styles.card}>
        <h1 style={styles.title}>Testar Bot (localhost)</h1>
        <p style={styles.subtitle}>
          Simula conversas com o bot sem conectar ao Telegram. A primeira mensagem recebe &quot;oi&quot;, as seguintes &quot;bot ta bão&quot;.
        </p>

        <div ref={listRef} style={styles.messageList}>
          {messages.length === 0 && (
            <p style={styles.placeholder}>Envie uma mensagem para testar o bot.</p>
          )}
          {messages.map((msg) => (
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
  },
  card: {
    maxWidth: "480px",
    margin: "0 auto",
    background: "rgba(255,255,255,0.06)",
    borderRadius: "12px",
    padding: "1.5rem",
    boxShadow: "0 8px 32px rgba(0,0,0,0.3)",
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
