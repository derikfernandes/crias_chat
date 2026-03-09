import RequireAuth from "@/app/RequireAuth";

export default function ConfiguracoesLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
