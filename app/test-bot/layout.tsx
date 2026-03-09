import RequireAuth from "@/app/RequireAuth";

export default function TestBotLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <RequireAuth>{children}</RequireAuth>;
}
