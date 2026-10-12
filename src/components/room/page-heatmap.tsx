import { formatDuration } from "@/lib/format";

/** Horizontal bar per page: where readers actually spent their time. */
export function PageHeatmap({ pages, pageCount }: { pages: Array<{ page: number; seconds: number }>; pageCount: number | null }) {
  const count = Math.max(pageCount ?? 0, ...pages.map((p) => p.page), 1);
  const bySec = new Map(pages.map((p) => [p.page, p.seconds]));
  const max = Math.max(1, ...pages.map((p) => p.seconds));
  const total = pages.reduce((s, p) => s + p.seconds, 0);
  if (total === 0) return <p className="text-sm text-muted">No page-level data yet.</p>;
  return (
    <ol className="space-y-1">
      {Array.from({ length: count }, (_, i) => i + 1).map((page) => {
        const seconds = bySec.get(page) ?? 0;
        const pct = Math.round((seconds / max) * 100);
        return (
          <li key={page} className="flex items-center gap-3 text-xs">
            <span className="w-14 shrink-0 text-muted">Page {page}</span>
            <div className="h-4 flex-1 overflow-hidden rounded bg-slate-100">
              <div className="h-full rounded bg-accent/80" style={{ width: `${pct}%` }} title={`${formatDuration(seconds)}`} />
            </div>
            <span className="w-16 shrink-0 text-right tabular-nums text-slate-700">{formatDuration(seconds)}</span>
            <span className="w-10 shrink-0 text-right tabular-nums text-muted">{total ? Math.round((seconds / total) * 100) : 0}%</span>
          </li>
        );
      })}
    </ol>
  );
}
