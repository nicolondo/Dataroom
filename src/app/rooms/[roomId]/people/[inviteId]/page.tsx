import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, FileDown } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { guestTimeline } from "@/lib/analytics";
import { Badge, Card, CardHeader, Stat, Table, Td, Th, Alert } from "@/components/ui";
import { formatDate, formatDuration, timeAgo } from "@/lib/format";
import { PageHeatmap } from "@/components/room/page-heatmap";
import { extendInvite } from "@/app/actions/invites";
import { Button, Input } from "@/components/ui";

export default async function GuestDetailPage({ params }: { params: Promise<{ roomId: string; inviteId: string }> }) {
  const { roomId, inviteId } = await params;
  const { room } = await requireRoom(roomId);
  const invite = await prisma.invite.findFirst({
    where: { id: inviteId, roomId },
    include: { guest: true, signatures: { orderBy: { signedAt: "desc" }, include: { ndaVersion: true } }, sessions: { orderBy: { createdAt: "desc" }, take: 5 }, downloads: { include: { document: { select: { title: true } } }, orderBy: { createdAt: "desc" } } },
  });
  if (!invite) notFound();
  const timeline = await guestTimeline(roomId, invite.guestId);
  const totalSeconds = timeline.reduce((s, v) => s + v.activeSeconds, 0);
  const docsViewed = new Set(timeline.map((v) => v.documentId)).size;

  // Per-document totals for this guest.
  const perDoc = new Map<string, { title: string; pageCount: number | null; seconds: number; sessions: number; pages: Map<number, number> }>();
  for (const s of timeline) {
    const d = perDoc.get(s.documentId) ?? { title: s.document.title, pageCount: s.document.pageCount, seconds: 0, sessions: 0, pages: new Map() };
    d.seconds += s.activeSeconds;
    d.sessions += 1;
    for (const p of s.pageTimes) d.pages.set(p.page, (d.pages.get(p.page) ?? 0) + p.seconds);
    perDoc.set(s.documentId, d);
  }
  const g = invite.guest;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/rooms/${roomId}/people`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> People
        </Link>
        <h2 className="flex items-center gap-2 text-xl font-semibold">
          {g.name || g.email}
          {invite.status === "revoked" ? <Badge variant="danger">Revoked</Badge> : invite.status === "active" ? <Badge variant="success">Active</Badge> : <Badge>Invited</Badge>}
        </h2>
        <p className="mt-1 text-sm text-muted">
          {g.email}
          {g.company ? ` · ${g.company}` : ""} · invited {formatDate(invite.createdAt)}
          {invite.acceptedAt ? ` · first entered ${formatDate(invite.acceptedAt)}` : ""}
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Total review time" value={formatDuration(totalSeconds)} />
        <Stat label="Documents opened" value={docsViewed} hint={`${timeline.length} sessions`} />
        <Stat label="Downloads" value={invite.downloads.length} />
        <Stat label="Last seen" value={timeAgo(invite.lastSeenAt)} hint={invite.expiresAt ? `Access ends ${formatDate(invite.expiresAt)}` : "No expiry"} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Time per document" />
            {perDoc.size === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">This guest has not opened any documents yet.</p>
            ) : (
              <div className="divide-y divide-border">
                {Array.from(perDoc.entries())
                  .sort((a, b) => b[1].seconds - a[1].seconds)
                  .map(([docId, d]) => (
                    <div key={docId} className="px-5 py-4">
                      <div className="flex items-center justify-between">
                        <Link href={`/rooms/${roomId}/documents/${docId}`} className="font-medium hover:text-accent">
                          {d.title}
                        </Link>
                        <span className="text-sm tabular-nums">
                          <span className="font-medium">{formatDuration(d.seconds)}</span> <span className="text-muted">· {d.sessions} session{d.sessions === 1 ? "" : "s"}</span>
                        </span>
                      </div>
                      {d.pageCount ? (
                        <div className="mt-3">
                          <PageHeatmap pages={Array.from(d.pages.entries()).map(([page, seconds]) => ({ page, seconds }))} pageCount={d.pageCount} />
                        </div>
                      ) : null}
                    </div>
                  ))}
              </div>
            )}
          </Card>

          <Card>
            <CardHeader title="Session history" description="Each row is one time the guest opened a document." />
            {timeline.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">No sessions yet.</p>
            ) : (
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Started</Th>
                    <Th>Document</Th>
                    <Th>Active time</Th>
                    <Th>Pages reached</Th>
                    <Th>IP</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {timeline.map((s) => (
                    <tr key={s.id}>
                      <Td className="whitespace-nowrap text-muted">{formatDate(s.startedAt)}</Td>
                      <Td>{s.document.title}</Td>
                      <Td className="tabular-nums">{formatDuration(s.activeSeconds)}</Td>
                      <Td className="tabular-nums">{s.document.pageCount ? `${s.maxPage} / ${s.document.pageCount}` : "—"}</Td>
                      <Td className="font-mono text-xs text-muted">{s.ipAddress || "—"}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="NDA" />
            <div className="p-5 text-sm">
              {!room.ndaRequired ? (
                <p className="text-muted">Not required for this room.</p>
              ) : invite.signatures.length === 0 ? (
                <p className="text-muted">Not signed yet.</p>
              ) : (
                <ul className="space-y-3">
                  {invite.signatures.map((sig) => (
                    <li key={sig.id} className="rounded-md border border-border p-3">
                      <p className="font-medium">
                        {sig.ndaVersion.title} <span className="text-muted">v{sig.ndaVersion.version}</span>
                      </p>
                      <p className="text-xs text-muted">
                        Signed by {sig.signerName} on {formatDate(sig.signedAt)}
                        {sig.ipAddress ? ` from ${sig.ipAddress}` : ""}
                      </p>
                      <a href={`/api/nda/${sig.id}/certificate`} className="mt-2 inline-flex items-center gap-1 text-xs text-accent hover:underline">
                        <FileDown className="h-3.5 w-3.5" /> Download signed record (PDF)
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </Card>

          <Card>
            <CardHeader title="Access window" />
            <form action={extendInvite.bind(null, roomId, inviteId)} className="flex items-end gap-2 p-5">
              <div className="flex-1">
                <label className="mb-1 block text-xs text-muted">Expire in (days, 0 = never)</label>
                <Input name="days" type="number" min={0} max={3650} defaultValue={room.inviteExpiryDays} />
              </div>
              <Button type="submit" variant="secondary">
                Update
              </Button>
            </form>
          </Card>

          {invite.downloads.length > 0 && (
            <Card>
              <CardHeader title="Downloads" />
              <ul className="divide-y divide-border px-5 text-sm">
                {invite.downloads.map((d) => (
                  <li key={d.id} className="flex justify-between py-2">
                    <span>{d.document.title}</span>
                    <span className="text-xs text-muted">{formatDate(d.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {invite.sessions.length > 0 && (
            <Alert variant="info">
              Last sign-in from {invite.sessions[0].ipAddress || "unknown IP"} · {timeAgo(invite.sessions[0].createdAt)}
            </Alert>
          )}
        </div>
      </div>
    </div>
  );
}
