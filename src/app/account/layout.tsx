import { requireUser } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";

export default async function AccountLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  return <AppShell user={user}>{children}</AppShell>;
}
