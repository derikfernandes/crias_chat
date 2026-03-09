"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const router = useRouter();
  const {
    user,
    loading: authLoading,
    signInWithEmail,
    signInWithGoogle,
    getRememberedEmail,
    setRememberEmail,
  } = useAuth();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberEmail, setRememberEmailChecked] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const saved = getRememberedEmail();
    if (saved) {
      setEmail(saved);
      setRememberEmailChecked(true);
    }
  }, [getRememberedEmail]);

  useEffect(() => {
    if (authLoading) return;
    if (user) {
      router.replace("/home");
    }
  }, [user, authLoading, router]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      await signInWithEmail(email.trim(), password);
      if (rememberEmail) {
        setRememberEmail(email.trim());
      } else {
        setRememberEmail(null);
      }
      router.replace("/home");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code === "auth/invalid-credential"
            ? "E-mail ou senha incorretos."
            : (err as { code: string }).code === "auth/invalid-email"
              ? "E-mail inválido."
              : (err as { code: string }).code === "auth/too-many-requests"
                ? "Muitas tentativas. Tente mais tarde."
                : "Erro ao entrar. Tente novamente."
          : "Erro ao entrar. Tente novamente.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  async function handleGoogleSignIn() {
    setError("");
    setLoading(true);
    try {
      await signInWithGoogle();
      router.replace("/home");
    } catch (err: unknown) {
      const message =
        err && typeof err === "object" && "code" in err
          ? (err as { code: string }).code === "auth/popup-closed-by-user"
            ? "Login com Google cancelado."
            : "Erro ao entrar com Google. Tente novamente."
          : "Erro ao entrar com Google. Tente novamente.";
      setError(message);
    } finally {
      setLoading(false);
    }
  }

  if (authLoading) {
    return (
      <>
        <style dangerouslySetInnerHTML={{ __html: loginStyles }} />
        <main className="login">
          <div className="login__bg" aria-hidden />
          <div className="login__content">
            <div className="login__spinner" aria-label="Carregando" />
            <p className="login__loading-text">Carregando...</p>
          </div>
        </main>
      </>
    );
  }

  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: loginStyles }} />
      <main className="login">
        <div className="login__bg" aria-hidden />
        <div className="login__content">
          <header className="login__header">
            <span className="login__badge">Telegram Bot</span>
            <h1 className="login__title">
              Crias <span className="login__title-accent">Chat</span>
            </h1>
            <p className="login__subtitle">
              Entre com seu e-mail ou com o Google para acessar a central.
            </p>
          </header>

          <div className="login__card">
            {error && (
              <div className="login__error" role="alert">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="login__form">
              <label className="login__label" htmlFor="login-email">
                E-mail
              </label>
              <input
                id="login-email"
                type="email"
                className="login__input"
                placeholder="seu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                required
                disabled={loading}
              />

              <label className="login__label" htmlFor="login-password">
                Senha
              </label>
              <input
                id="login-password"
                type="password"
                className="login__input"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                required
                disabled={loading}
              />

              <label className="login__checkbox-wrap">
                <input
                  type="checkbox"
                  checked={rememberEmail}
                  onChange={(e) => setRememberEmailChecked(e.target.checked)}
                  disabled={loading}
                  className="login__checkbox"
                />
                <span className="login__checkbox-label">Lembrar meu e-mail</span>
              </label>

              <button
                type="submit"
                className="login__btn login__btn--primary"
                disabled={loading}
              >
                {loading ? "Entrando..." : "Entrar"}
              </button>
            </form>

            <div className="login__divider">
              <span>ou</span>
            </div>

            <button
              type="button"
              className="login__btn login__btn--google"
              onClick={handleGoogleSignIn}
              disabled={loading}
            >
              <span className="login__google-icon" aria-hidden />
              Entrar com Google
            </button>
          </div>
        </div>
      </main>
    </>
  );
}

const loginStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  .login {
    --bg: #0d0f14;
    --surface: #161922;
    --surface-hover: #1e212d;
    --border: rgba(255, 255, 255, 0.06);
    --text: #e8eaef;
    --text-muted: #8b8f9a;
    --accent: #22c4b8;
    --accent-soft: rgba(34, 196, 184, 0.15);
    --accent-glow: rgba(34, 196, 184, 0.25);
    --error-bg: rgba(239, 68, 68, 0.12);
    --error-border: rgba(239, 68, 68, 0.35);
    font-family: 'Outfit', system-ui, sans-serif;
    min-height: 100vh;
    color: var(--text);
    position: relative;
    overflow: hidden;
  }

  .login__bg {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% -20%, var(--accent-glow), transparent),
      radial-gradient(ellipse 60% 40% at 100% 100%, rgba(34, 196, 184, 0.08), transparent),
      var(--bg);
    pointer-events: none;
  }

  .login__content {
    position: relative;
    z-index: 1;
    max-width: 24rem;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) 1.5rem;
    min-height: 100vh;
    display: flex;
    flex-direction: column;
    justify-content: center;
  }

  .login__header {
    text-align: center;
    margin-bottom: 2rem;
  }

  .login__badge {
    display: inline-block;
    font-size: 0.75rem;
    font-weight: 500;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent);
    background: var(--accent-soft);
    padding: 0.35rem 0.75rem;
    border-radius: 999px;
    margin-bottom: 1.25rem;
  }

  .login__title {
    font-size: clamp(2rem, 4vw, 2.5rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 0.5rem;
  }

  .login__title-accent {
    color: var(--accent);
  }

  .login__subtitle {
    font-size: 0.95rem;
    color: var(--text-muted);
    line-height: 1.5;
    margin: 0;
  }

  .login__card {
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: 1.75rem;
  }

  .login__error {
    background: var(--error-bg);
    border: 1px solid var(--error-border);
    color: #fca5a5;
    font-size: 0.9rem;
    padding: 0.75rem 1rem;
    border-radius: 0.5rem;
    margin-bottom: 1.25rem;
  }

  .login__form {
    display: flex;
    flex-direction: column;
    gap: 1rem;
  }

  .login__label {
    font-size: 0.875rem;
    font-weight: 500;
    color: var(--text-muted);
  }

  .login__input {
    box-sizing: border-box;
    width: 100%;
    min-width: 0;
    padding: 0.75rem 1rem;
    font-size: 1rem;
    font-family: inherit;
    color: var(--text);
    background: var(--bg);
    border: 1px solid var(--border);
    border-radius: 0.5rem;
    outline: none;
    transition: border-color 0.2s;
  }

  .login__input::placeholder {
    color: var(--text-muted);
    opacity: 0.7;
  }

  .login__input:focus {
    border-color: var(--accent);
  }

  .login__input:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .login__checkbox-wrap {
    display: flex;
    align-items: center;
    gap: 0.5rem;
    cursor: pointer;
    user-select: none;
  }

  .login__checkbox {
    width: 1.125rem;
    height: 1.125rem;
    accent-color: var(--accent);
    cursor: pointer;
  }

  .login__checkbox-label {
    font-size: 0.9rem;
    color: var(--text-muted);
  }

  .login__btn {
    font-family: inherit;
    font-size: 1rem;
    font-weight: 600;
    padding: 0.75rem 1.25rem;
    border-radius: 0.5rem;
    border: none;
    cursor: pointer;
    transition: background 0.2s, opacity 0.2s;
  }

  .login__btn:disabled {
    opacity: 0.7;
    cursor: not-allowed;
  }

  .login__btn--primary {
    background: var(--accent);
    color: #0d0f14;
    margin-top: 0.25rem;
  }

  .login__btn--primary:hover:not(:disabled) {
    filter: brightness(1.08);
  }

  .login__divider {
    margin: 1.25rem 0;
    text-align: center;
    color: var(--text-muted);
    font-size: 0.85rem;
  }

  .login__btn--google {
    width: 100%;
    background: var(--surface-hover);
    color: var(--text);
    border: 1px solid var(--border);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
  }

  .login__btn--google:hover:not(:disabled) {
    background: #252932;
    border-color: rgba(255, 255, 255, 0.1);
  }

  .login__google-icon {
    width: 1.25rem;
    height: 1.25rem;
    background: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'%3E%3Cpath fill='%234285F4' d='M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z'/%3E%3Cpath fill='%2334A853' d='M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z'/%3E%3Cpath fill='%23FBBC05' d='M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z'/%3E%3Cpath fill='%23EA4335' d='M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z'/%3E%3C/svg%3E") center/contain no-repeat;
  }

  .login__spinner {
    width: 2.5rem;
    height: 2.5rem;
    border: 3px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: login-spin 0.8s linear infinite;
    margin: 0 auto 1rem;
  }

  .login__loading-text {
    text-align: center;
    color: var(--text-muted);
    font-size: 0.95rem;
    margin: 0;
  }

  @keyframes login-spin {
    to { transform: rotate(360deg); }
  }
`;
