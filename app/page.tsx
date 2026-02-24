import Link from "next/link";

export default function Home() {
  return (
    <main style={{ padding: "2rem", fontFamily: "system-ui" }}>
      <h1>Crias Chat Bot</h1>
      <p>Bot do Telegram. Use /api/telegram/setup para configurar o webhook.</p>
      <p style={{ marginTop: "1rem" }}>
        <Link href="/test-bot" style={{ color: "#4ecdc4" }}>
          Testar o bot no localhost (sem Telegram) →
        </Link>
      </p>
    </main>
  );
}
