"use client";

import Link from "next/link";
import { useEffect, useState, useCallback } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { PROMPT_NAMES, getPrompt, setPrompt } from "@/lib/prompts/loader";
import {
  getAdminEmails,
  addAdmin,
  removeAdmin,
  isAdminEmail,
  SUPER_ADMIN_EMAIL,
} from "@/lib/admin";

type PromptsState = Record<string, string>;

export default function AdminPromptsPage() {
  const { user } = useAuth();

  // ----- estado de prompts -----
  const [prompts, setPromptsState] = useState<PromptsState>({});
  const [promptsLoading, setPromptsLoading] = useState(true);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [promptError, setPromptError] = useState<string | null>(null);
  const [promptSuccess, setPromptSuccess] = useState<string | null>(null);

  // ----- estado de admins -----
  const [adminEmails, setAdminEmailsState] = useState<string[]>([]);
  const [adminLoading, setAdminLoading] = useState(true);
  const [adminError, setAdminError] = useState<string | null>(null);
  const [newAdminEmail, setNewAdminEmail] = useState("");

  const loadAdmins = useCallback(async () => {
    if (!user?.email) return;
    setAdminLoading(true);
    setAdminError(null);
    try {
      const list = await getAdminEmails();
      setAdminEmailsState(list);
    } catch (e) {
      setAdminError(e instanceof Error ? e.message : "Erro ao carregar admins.");
    } finally {
      setAdminLoading(false);
    }
  }, [user?.email]);

  const loadPrompts = useCallback(async () => {
    setPromptsLoading(true);
    setPromptError(null);
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
      setPromptError(
        e instanceof Error
          ? e.message
          : "Erro ao carregar prompts. Verifique se o Firestore está configurado."
      );
    } finally {
      setPromptsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (user) {
      loadAdmins();
      loadPrompts();
    }
  }, [user, loadAdmins, loadPrompts]);

  const handlePromptChange = useCallback((key: string, value: string) => {
    setPromptsState((prev) => ({ ...prev, [key]: value }));
  }, []);

  const handleSavePrompt = useCallback(
    async (key: string) => {
      setSavingKey(key);
      setPromptError(null);
      setPromptSuccess(null);
      try {
        await setPrompt(key, prompts[key] ?? "");
        setPromptSuccess(`Prompt "${key}" salvo com sucesso.`);
      } catch (e) {
        setPromptError(
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

  const handleAddAdmin = useCallback(async () => {
    const email = newAdminEmail.trim().toLowerCase();
    if (!email) return;
    await addAdmin(email);
    setNewAdminEmail("");
    setAdminEmailsState(await getAdminEmails());
  }, [newAdminEmail]);

  const handleRemoveAdmin = useCallback(async (email: string) => {
    await removeAdmin(email);
    setAdminEmailsState(await getAdminEmails());
  }, []);

  if (!user) {
    return null;
  }

  const isAdmin = isAdminEmail(user.email, adminEmails);
  if (!isAdmin) {
    return (
      <main style={styles.main}>
        <div style={styles.container}>
          <header style={styles.header}>
            <h1 style={styles.title}>Acesso negado</h1>
            <p style={styles.subtitle}>
              Apenas administradores podem acessar esta página.
            </p>
            <Link href="/home" style={styles.backLink}>
              ← Voltar à home
            </Link>
          </header>
        </div>
      </main>
    );
  }

  return (
    <main style={styles.main}>
      <div style={styles.container}>
        <header style={styles.header}>
          <h1 style={styles.title}>Admin</h1>
          <p style={styles.subtitle}>
            Gerencie quem é administrador e edite os prompts dos bots
            (coleção <code>prompts</code> no Firestore).
          </p>
          <Link href="/home" style={styles.backLink}>
            ← Voltar à home
          </Link>
        </header>

        {/* Administradores */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Administradores</h2>
          <p style={styles.hint}>
            E-mails que podem acessar esta página e editar os prompts.
            O super admin <code>{SUPER_ADMIN_EMAIL}</code> é sempre admin
            e não pode ser removido.
          </p>
          {adminError && <div style={styles.error}>{adminError}</div>}

          <div style={styles.addRow}>
            <input
              type="email"
              placeholder="E-mail do novo admin"
              value={newAdminEmail}
              onChange={(e) => setNewAdminEmail(e.target.value)}
              style={styles.input}
            />
            <button
              type="button"
              onClick={handleAddAdmin}
              disabled={!newAdminEmail.trim()}
              style={styles.button}
            >
              Adicionar admin
            </button>
          </div>

          {adminLoading ? (
            <p style={styles.muted}>Carregando admins...</p>
          ) : (
            <ul style={styles.adminList}>
              <li style={styles.adminItem}>
                <span style={styles.adminEmail}>{SUPER_ADMIN_EMAIL}</span>
                <span style={styles.badge}>super admin</span>
              </li>
              {adminEmails
                .filter((e) => e !== SUPER_ADMIN_EMAIL.toLowerCase())
                .map((email) => (
                  <li key={email} style={styles.adminItem}>
                    <span style={styles.adminEmail}>{email}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveAdmin(email)}
                      style={styles.removeBtn}
                    >
                      Remover
                    </button>
                  </li>
                ))}
            </ul>
          )}
        </section>

        {/* Prompts */}
        <section style={styles.section}>
          <h2 style={styles.sectionTitle}>Prompts dos bots</h2>
          {promptError && <div style={styles.error}>{promptError}</div>}
          {promptSuccess && <div style={styles.success}>{promptSuccess}</div>}

          {promptsLoading ? (
            <p style={styles.muted}>Carregando prompts...</p>
          ) : (
            Object.values(PROMPT_NAMES).map((name) => (
              <div key={name} style={styles.promptCard}>
                <label style={styles.promptLabel}>{name}</label>
                <textarea
                  value={prompts[name] ?? ""}
                  onChange={(e) => handlePromptChange(name, e.target.value)}
                  rows={10}
                  style={styles.textarea}
                  placeholder={`Texto completo do prompt "${name}"`}
                />
                <button
                  type="button"
                  onClick={() => handleSavePrompt(name)}
                  disabled={savingKey === name}
                  style={styles.button}
                >
                  {savingKey === name ? "Salvando…" : "Salvar"}
                </button>
              </div>
            ))
          )}
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
    marginBottom: "1.5rem",
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
  sectionTitle: {
    margin: "0 0 1rem",
    fontSize: "1.25rem",
    fontWeight: 600,
    color: "#fff",
  },
  hint: {
    margin: "0 0 1rem",
    fontSize: "0.85rem",
    color: "#888",
  },
  addRow: {
    display: "flex",
    gap: "0.75rem",
    flexWrap: "wrap",
    alignItems: "center",
    marginBottom: "1rem",
  },
  input: {
    flex: "1 1 220px",
    minWidth: "200px",
    padding: "0.6rem 0.9rem",
    borderRadius: "10px",
    border: "1px solid rgba(255,255,255,0.2)",
    background: "rgba(0,0,0,0.25)",
    color: "#eee",
    fontSize: "0.95rem",
  },
  adminList: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  adminItem: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    padding: "0.35rem 0",
    borderBottom: "1px solid rgba(255,255,255,0.08)",
    gap: "0.75rem",
  },
  adminEmail: {
    color: "#ddd",
    fontSize: "0.95rem",
  },
  badge: {
    fontSize: "0.75rem",
    color: "#4ecdc4",
    background: "rgba(78,205,196,0.15)",
    padding: "0.2rem 0.5rem",
    borderRadius: "6px",
  },
  removeBtn: {
    padding: "0.35rem 0.75rem",
    fontSize: "0.85rem",
    background: "rgba(255, 107, 107, 0.2)",
    border: "1px solid rgba(255, 107, 107, 0.4)",
    color: "#ffb3b3",
    borderRadius: "8px",
    cursor: "pointer",
  },
};

