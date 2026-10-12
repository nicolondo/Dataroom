"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cx } from "@/components/ui";

const TABS = [
  { href: "", label: "Documents" },
  { href: "/people", label: "People" },
  { href: "/nda", label: "NDA" },
  { href: "/questions", label: "Q&A" },
  { href: "/analytics", label: "Analytics" },
  { href: "/activity", label: "Activity" },
  { href: "/settings", label: "Settings" },
];

export function RoomTabs({ roomId, counts }: { roomId: string; counts?: Partial<Record<string, number>> }) {
  const pathname = usePathname();
  const base = `/rooms/${roomId}`;
  return (
    <nav className="-mb-px flex gap-1 overflow-x-auto border-b border-border">
      {TABS.map((tab) => {
        const href = `${base}${tab.href}`;
        const active = tab.href === "" ? pathname === base || pathname.startsWith(`${base}/documents`) : pathname.startsWith(href);
        const count = counts?.[tab.label];
        return (
          <Link
            key={tab.href}
            href={href}
            className={cx(
              "flex items-center gap-1.5 whitespace-nowrap border-b-2 px-3 py-2.5 text-sm font-medium transition-colors",
              active ? "border-accent text-accent" : "border-transparent text-muted hover:border-slate-300 hover:text-foreground",
            )}
          >
            {tab.label}
            {count ? <span className="rounded-full bg-slate-100 px-1.5 text-xs text-slate-600">{count}</span> : null}
          </Link>
        );
      })}
    </nav>
  );
}
