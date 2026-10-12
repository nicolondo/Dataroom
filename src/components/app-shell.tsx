import Link from "next/link";
import { Lock, LogOut } from "lucide-react";
import { logout } from "@/app/actions/auth";
import type { CurrentUser } from "@/lib/auth";
import { Avatar } from "@/components/ui";
import { initials } from "@/lib/format";

export function AppShell({ user, children }: { user: CurrentUser; children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href="/dashboard" className="flex items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-white">
              <Lock className="h-3.5 w-3.5" />
            </span>
            Data Room
          </Link>
          <div className="flex items-center gap-3">
            <div className="hidden items-center gap-2 text-sm sm:flex">
              <Avatar text={initials(user.name || user.email)} className="h-7 w-7" />
              <span className="text-slate-700">{user.name}</span>
            </div>
            <form action={logout}>
              <button type="submit" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-foreground" title="Sign out">
                <LogOut className="h-4 w-4" />
                <span className="hidden sm:inline">Sign out</span>
              </button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
    </div>
  );
}
