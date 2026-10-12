import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { ACTION_LABELS } from "@/lib/audit";
import { Badge, Card, CardHeader, EmptyState, LinkButton } from "@/components/ui";
import { formatDate } from "@/lib/format";

export const metadata = { title: "Activity" };

const PAGE_SIZE = 100;

export default async function ActivityPage({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ page?: string; actor?: string }> }) {
  const { roomId } = await params;
  const { page: pageRaw, actor } = await searchParams;
  await requireRoom(roomId);
  const page = Math.max(1, Number(pageRaw ?? 1) || 1);
  const where = { roomId, ...(actor === "guest" || actor === "owner" ? { actorType: actor } : {}) };
  const [events, total] = await Promise.all([
    prisma.auditEvent.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * PAGE_SIZE, take: PAGE_SIZE }),
    prisma.auditEvent.count({ where }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <Card>
      <CardHeader
        title="Activity log"
        description={`${total} events. Every sign-in, NDA signature, document view, download and change is recorded.`}
        action={
          <div className="flex gap-1">
            {[
              ["", "All"],
              ["guest", "Guests"],
              ["owner", "Owner"],
            ].map(([value, label]) => (
              <LinkButton key={value} href={`/rooms/${roomId}/activity${value ? `?actor=${value}` : ""}`} variant={(actor ?? "") === value ? "primary" : "secondary"} size="sm">
                {label}
              </LinkButton>
            ))}
          </div>
        }
      />
      {events.length === 0 ? (
        <div className="p-5">
          <EmptyState title="Nothing recorded yet" />
        </div>
      ) : (
        <ul className="divide-y divide-border">
          {events.map((e) => {
            let meta: Record<string, unknown> = {};
            try {
              meta = JSON.parse(e.metadata);
            } catch {}
            const extras: string[] = [];
            if (typeof meta.seconds === "number") extras.push(`${meta.seconds}s active`);
            if (typeof meta.page === "number") extras.push(`page ${meta.page}`);
            if (typeof meta.version === "number") extras.push(`v${meta.version}`);
            if (meta.watermarked === true) extras.push("watermarked");
            return (
              <li key={e.id} className="flex items-start gap-3 px-5 py-3 text-sm">
                <Badge variant={e.actorType === "guest" ? "info" : e.actorType === "owner" ? "neutral" : "warning"} className="mt-0.5 w-14 justify-center">
                  {e.actorType}
                </Badge>
                <div className="min-w-0 flex-1">
                  <p>
                    <span className="font-medium">{e.actorEmail || "system"}</span> {ACTION_LABELS[e.action] ?? e.action}
                    {e.targetName && (
                      <>
                        {" "}
                        <span className="font-medium">“{e.targetName}”</span>
                      </>
                    )}
                    {extras.length > 0 && <span className="text-muted"> · {extras.join(" · ")}</span>}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDate(e.createdAt)}
                    {e.ipAddress ? ` · ${e.ipAddress}` : ""}
                  </p>
                </div>
              </li>
            );
          })}
        </ul>
      )}
      {pages > 1 && (
        <div className="flex items-center justify-between border-t border-border px-5 py-3 text-sm text-muted">
          <span>
            Page {page} of {pages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <LinkButton variant="secondary" size="sm" href={`/rooms/${roomId}/activity?page=${page - 1}${actor ? `&actor=${actor}` : ""}`}>
                Previous
              </LinkButton>
            )}
            {page < pages && (
              <LinkButton variant="secondary" size="sm" href={`/rooms/${roomId}/activity?page=${page + 1}${actor ? `&actor=${actor}` : ""}`}>
                Next
              </LinkButton>
            )}
          </div>
        </div>
      )}
    </Card>
  );
}
