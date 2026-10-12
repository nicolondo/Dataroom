import Link from "next/link";
import { requireRoom } from "@/lib/auth";
import { documentEngagement, guestEngagement, roomTotals } from "@/lib/analytics";
import { prisma } from "@/lib/db";
import { Avatar, Badge, Card, CardHeader, Stat, Table, Td, Th } from "@/components/ui";
import { formatDuration, initials, timeAgo } from "@/lib/format";

export const metadata = { title: "Analytics" };

export default async function AnalyticsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { room } = await requireRoom(roomId);
  const [totals, guests, docs, matrix] = await Promise.all([
    roomTotals(roomId),
    guestEngagement(roomId),
    documentEngagement(roomId),
    prisma.viewSession.groupBy({ by: ["guestId", "documentId"], where: { roomId }, _sum: { activeSeconds: true } }),
  ]);
  const activeGuests = guests.filter((g) => g.status !== "revoked").sort((a, b) => b.totalSeconds - a.totalSeconds);
  const topDocs = [...docs].sort((a, b) => b.totalSeconds - a.totalSeconds);
  const cell = new Map(matrix.map((m) => [`${m.guestId}:${m.documentId}`, m._sum.activeSeconds ?? 0]));
  const engagedGuests = activeGuests.filter((g) => g.totalSeconds > 0);
  const maxCell = Math.max(1, ...matrix.map((m) => m._sum.activeSeconds ?? 0));

  return (
    <div className="space-y-6">
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <Stat label="Guests" value={totals.invites} hint={room.ndaRequired ? `${totals.ndaSigned} signed the NDA` : "NDA not required"} />
        <Stat label="Documents" value={totals.documents} />
        <Stat label="Total review time" value={formatDuration(totals.totalSeconds)} hint={`${totals.views} sessions`} />
        <Stat label="Avg per guest" value={formatDuration(engagedGuests.length ? totals.totalSeconds / engagedGuests.length : 0)} hint={`${engagedGuests.length} engaged`} />
        <Stat label="Downloads" value={totals.downloads} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader title="Most engaged guests" description="Ranked by active review time." />
          {activeGuests.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No guests yet.</p>
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Guest</Th>
                  <Th>Time</Th>
                  <Th>Docs</Th>
                  <Th>Last seen</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activeGuests.slice(0, 10).map((g) => (
                  <tr key={g.inviteId}>
                    <Td>
                      <Link href={`/rooms/${roomId}/people/${g.inviteId}`} className="flex items-center gap-2 hover:text-accent">
                        <Avatar text={initials(g.name || g.email)} className="h-7 w-7" />
                        <span className="truncate">
                          <span className="block font-medium">{g.name || g.email}</span>
                          {g.company && <span className="block text-xs text-muted">{g.company}</span>}
                        </span>
                      </Link>
                    </Td>
                    <Td className="tabular-nums font-medium">{formatDuration(g.totalSeconds)}</Td>
                    <Td className="tabular-nums">
                      {g.documentsViewed}/{totals.documents}
                    </Td>
                    <Td className="text-muted">{timeAgo(g.lastSeenAt)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>

        <Card>
          <CardHeader title="Most reviewed documents" description="Where guests spend their time." />
          {topDocs.length === 0 ? (
            <p className="px-5 py-6 text-sm text-muted">No documents yet.</p>
          ) : (
            <Table>
              <thead className="bg-slate-50">
                <tr>
                  <Th>Document</Th>
                  <Th>Time</Th>
                  <Th>Viewers</Th>
                  <Th>Avg/viewer</Th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {topDocs.slice(0, 10).map((d) => (
                  <tr key={d.documentId}>
                    <Td>
                      <Link href={`/rooms/${roomId}/documents/${d.documentId}`} className="font-medium hover:text-accent">
                        {d.title}
                      </Link>
                      {!d.published && (
                        <Badge variant="warning" className="ml-2">
                          Hidden
                        </Badge>
                      )}
                    </Td>
                    <Td className="tabular-nums font-medium">{formatDuration(d.totalSeconds)}</Td>
                    <Td className="tabular-nums">{d.uniqueViewers}</Td>
                    <Td className="tabular-nums">{formatDuration(d.avgSecondsPerViewer)}</Td>
                  </tr>
                ))}
              </tbody>
            </Table>
          )}
        </Card>
      </div>

      {engagedGuests.length > 0 && docs.length > 0 && (
        <Card>
          <CardHeader title="Guest × document heatmap" description="Minutes each guest spent on each document. Darker means more time." />
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50">
                <tr>
                  <th className="sticky left-0 bg-slate-50 px-4 py-2 text-left font-medium text-muted">Guest</th>
                  {docs.map((d) => (
                    <th key={d.documentId} className="max-w-32 px-2 py-2 text-left font-medium text-muted">
                      <span className="line-clamp-2" title={d.title}>
                        {d.title}
                      </span>
                    </th>
                  ))}
                  <th className="px-3 py-2 text-right font-medium text-muted">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {engagedGuests.map((g) => (
                  <tr key={g.inviteId}>
                    <td className="sticky left-0 whitespace-nowrap bg-white px-4 py-2 font-medium">{g.name || g.email}</td>
                    {docs.map((d) => {
                      const s = cell.get(`${g.guestId}:${d.documentId}`) ?? 0;
                      const intensity = s ? 0.15 + (s / maxCell) * 0.75 : 0;
                      return (
                        <td key={d.documentId} className="px-2 py-1">
                          <div className="flex h-8 items-center justify-center rounded tabular-nums" style={{ background: s ? `rgba(29, 78, 216, ${intensity})` : "#f1f5f9", color: intensity > 0.55 ? "#fff" : "#0f172a" }} title={formatDuration(s)}>
                            {s ? formatDuration(s) : "·"}
                          </div>
                        </td>
                      );
                    })}
                    <td className="px-3 py-2 text-right font-medium tabular-nums">{formatDuration(g.totalSeconds)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}
    </div>
  );
}
