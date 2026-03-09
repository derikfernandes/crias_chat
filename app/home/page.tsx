import Link from "next/link";
import HeaderAuth from "@/components/HeaderAuth";

export default function HomePage() {
  return (
    <>
      <style dangerouslySetInnerHTML={{ __html: homeStyles }} />
      <main className="home">
        <div className="home__bg" aria-hidden />
        <div className="home__content">
          <header className="home__header">
            <HeaderAuth />
            <span className="home__badge">Telegram Bot</span>
            <h1 className="home__title">
              Crias <span className="home__title-accent">Chat</span>
            </h1>
            <p className="home__subtitle">
              Central de controle do bot. Configure o webhook, teste localmente e
              gerencie reuniões e atividades.
            </p>
          </header>

          <nav className="home__nav" aria-label="Navegação principal">
            <Link href="/test-bot" className="home__card home__card--primary">
              <span className="home__card-icon" aria-hidden>
                ◐
              </span>
              <h2 className="home__card-title">Testar o bot</h2>
              <p className="home__card-desc">
                Simule conversas no localhost sem usar o Telegram
              </p>
              <span className="home__card-cta">Abrir →</span>
            </Link>

            <Link href="/gerenciamento" className="home__card">
              <span className="home__card-icon" aria-hidden>
                ◉
              </span>
              <h2 className="home__card-title">Gerenciamento</h2>
              <p className="home__card-desc">
                Ver e gerenciar dados do banco (reuniões e itens)
              </p>
              <span className="home__card-cta">Abrir →</span>
            </Link>

            <Link href="/kanban" className="home__card">
              <span className="home__card-icon" aria-hidden>
                ▣
              </span>
              <h2 className="home__card-title">Kanban</h2>
              <p className="home__card-desc">
                Ações e atividades em quadro visual
              </p>
              <span className="home__card-cta">Abrir →</span>
            </Link>
          </nav>

          <footer className="home__footer">
            <p>
              Webhook: <code className="home__code">/api/telegram/setup</code>
            </p>
          </footer>
        </div>
      </main>
    </>
  );
}

const homeStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500&display=swap');

  .home {
    --bg: #0d0f14;
    --surface: #161922;
    --surface-hover: #1e212d;
    --border: rgba(255, 255, 255, 0.06);
    --text: #e8eaef;
    --text-muted: #8b8f9a;
    --accent: #22c4b8;
    --accent-soft: rgba(34, 196, 184, 0.15);
    --accent-glow: rgba(34, 196, 184, 0.25);
    font-family: 'Outfit', system-ui, sans-serif;
    min-height: 100vh;
    color: var(--text);
    position: relative;
    overflow: hidden;
  }

  .home__bg {
    position: fixed;
    inset: 0;
    background:
      radial-gradient(ellipse 80% 50% at 50% -20%, var(--accent-glow), transparent),
      radial-gradient(ellipse 60% 40% at 100% 100%, rgba(34, 196, 184, 0.08), transparent),
      var(--bg);
    pointer-events: none;
  }

  .home__content {
    position: relative;
    z-index: 1;
    max-width: 52rem;
    margin: 0 auto;
    padding: clamp(2rem, 5vw, 4rem) 1.5rem;
  }

  .home__header {
    text-align: center;
    margin-bottom: 3rem;
    position: relative;
  }

  .header-auth {
    position: absolute;
    top: 0;
    right: 0;
    display: flex;
    align-items: center;
    gap: 0.75rem;
  }

  .header-auth__email {
    font-size: 0.85rem;
    color: var(--text-muted);
  }

  .header-auth__btn {
    font-family: inherit;
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--text-muted);
    background: transparent;
    border: 1px solid var(--border);
    padding: 0.35rem 0.75rem;
    border-radius: 0.5rem;
    cursor: pointer;
    transition: color 0.2s, border-color 0.2s;
  }

  .header-auth__btn:hover {
    color: var(--accent);
    border-color: var(--accent);
  }

  .home__badge {
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

  .home__title {
    font-size: clamp(2.25rem, 5vw, 3.25rem);
    font-weight: 700;
    letter-spacing: -0.02em;
    line-height: 1.15;
    margin: 0 0 0.75rem;
  }

  .home__title-accent {
    color: var(--accent);
    font-weight: 700;
  }

  .home__subtitle {
    font-size: 1.05rem;
    color: var(--text-muted);
    line-height: 1.55;
    margin: 0;
    max-width: 28rem;
    margin-left: auto;
    margin-right: auto;
  }

  .home__nav {
    display: grid;
    gap: 1rem;
    margin-bottom: 3rem;
  }

  .home__card {
    display: block;
    position: relative;
    z-index: 1;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 1rem;
    padding: 1.5rem 1.75rem;
    text-decoration: none;
    color: inherit;
    cursor: pointer;
    user-select: none;
    -webkit-tap-highlight-color: transparent;
    transition: background 0.2s, border-color 0.2s, box-shadow 0.2s;
  }

  .home__card:hover {
    background: var(--surface-hover);
    border-color: rgba(34, 196, 184, 0.25);
    box-shadow: 0 12px 32px rgba(0, 0, 0, 0.35);
  }

  .home__card:active {
    box-shadow: 0 4px 16px rgba(0, 0, 0, 0.3);
  }

  .home__card--primary {
    border-color: rgba(34, 196, 184, 0.35);
    background: linear-gradient(135deg, var(--surface) 0%, rgba(34, 196, 184, 0.06) 100%);
  }

  .home__card--primary:hover {
    border-color: rgba(34, 196, 184, 0.5);
    box-shadow: 0 12px 32px rgba(34, 196, 184, 0.12);
  }

  .home__card-icon {
    display: inline-block;
    font-size: 1.25rem;
    color: var(--accent);
    margin-bottom: 0.75rem;
  }

  .home__card-title {
    font-size: 1.2rem;
    font-weight: 600;
    margin: 0 0 0.35rem;
  }

  .home__card-desc {
    font-size: 0.9rem;
    color: var(--text-muted);
    line-height: 1.45;
    margin: 0 0 0.75rem;
  }

  .home__card-cta {
    font-size: 0.85rem;
    font-weight: 500;
    color: var(--accent);
  }

  .home__footer {
    text-align: center;
  }

  .home__footer p {
    font-size: 0.85rem;
    color: var(--text-muted);
    margin: 0;
  }

  .home__code {
    font-family: 'JetBrains Mono', monospace;
    font-size: 0.8em;
    background: var(--surface);
    padding: 0.2rem 0.5rem;
    border-radius: 0.35rem;
    border: 1px solid var(--border);
  }
`;
