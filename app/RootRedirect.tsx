"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

/**
 * Na raiz (/): redireciona para /home se logado, senão para /login.
 */
export default function RootRedirect() {
  const router = useRouter();
  const { user, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (user) {
      router.replace("/home");
    } else {
      router.replace("/login");
    }
  }, [user, loading, router]);

  return (
    <main style={{
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0d0f14",
          color: "#8b8f9a",
          fontFamily: "system-ui, sans-serif",
        }}
    >
      Carregando...
    </main>
  );
}
