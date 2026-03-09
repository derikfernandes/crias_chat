import RequireAuth from "@/app/RequireAuth";

export default function GerenciamentoLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
