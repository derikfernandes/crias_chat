"use client";

import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function HeaderAuth() {
  const router = useRouter();
  const { user, logout } = useAuth();

  async function handleLogout() {
    await logout();
    router.replace("/login");
  }

  if (!user) return null;

  return (
    <div className="header-auth">
      <span className="header-auth__email">{user.email}</span>
      <button
        type="button"
        className="header-auth__btn"
        onClick={handleLogout}
        aria-label="Sair"
      >
        Sair
      </button>
    </div>
  );
}
