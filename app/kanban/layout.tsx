import RequireAuth from "@/app/RequireAuth";

export default function KanbanLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
