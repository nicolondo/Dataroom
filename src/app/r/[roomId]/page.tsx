import Link from "next/link";
import { redirect } from "next/navigation";
import { FileText, Image as ImageIcon, File, MessageSquare, ShieldCheck, Clock } from "lucide-react";
import { prisma } from "@/lib/db";
import { getRoomViewer } from "@/lib/room-viewer";
import { Badge, Card, CardHeader, EmptyState, LinkButton } from "@/components/ui";
import { formatBytes, formatDuration, isImage, isPdf, timeAgo } from "@/lib/format";

export const metadata = { title: "Documents" };

export default async function GuestRoomPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const viewer = await getRoomViewer(roomId);
  if (viewer.kind === "none") return null; // layout renders the message
  if (viewer.kind === "guest" && !viewer.access.ndaSatisfied) redirect(`/r/${roomId}/nda`);

  const room = viewer.kind === "guest" ? viewer.access.room : viewer.room;
  const guestId = viewer.kind === "guest" ? viewer.access.guest.id : null;
  const [folders, documents, myViews, openQuestions] = await Promise.all([
    prisma.folder.findMany({ where: { roomId }, orderBy: { sortOrder: "asc" } }),
    prisma.document.findMany({ where: { roomId, published: true }, orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }] }),
    guestId ? prisma.viewSession.groupBy({ by: ["documentId"], where: { roomId, guestId }, _sum: { activeSeconds: true }, _max: { lastHeartbeatAt: true } }) : Promise.resolve([]),
    guestId ? prisma.question.count({ where: { roomId, guestId, answer: { not: null } } }) : Promise.resolve(0),
  ]);
  const mine = new Map(myViews.map((v) => [v.documentId, { seconds: v._sum.activeSeconds ?? 0, last: v._max.lastHeartbeatAt }]));
  const groups = [{ id: null as string | null, name: "Documents" }, ...folders].map((f) => ({ ...f, docs: documents.filter((d) => (d.folderId ?? null) === f.id) })).filter((g) => g.docs.length > 0);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">{room.name}</h1>
          {room.description && <p className="mt-1 max-w-2xl text-sm text-muted">{room.description}</p>}
          <div className="mt-2 flex flex-wrap gap-2 text-xs">
            {room.ndaRequired && (
              <Badge variant="success">
                <ShieldCheck className="mr-1 h-3 w-3" /> NDA signed
              </Badge>
            )}
            <Badge>{documents.length} documents</Badge>
            {viewer.kind === "guest" && viewer.access.invite.expiresAt && <Badge variant="info">Access until {viewer.access.invite.expiresAt.toLocaleDateString()}</Badge>}
          </div>
        </div>
        <LinkButton variant="secondary" href={`/r/${roomId}/questions`}>
          <MessageSquare className="h-4 w-4" /> Questions{openQuestions ? ` (${openQuestions} answered)` : ""}
        </LinkButton>
      </div>

      {documents.length === 0 ? (
        <EmptyState title="No documents yet" description="The room owner has not published any documents. Check back later." />
      ) : (
        groups.map((group) => (
          <Card key={group.id ?? "root"}>
            <CardHeader title={group.name} />
            <ul className="divide-y divide-border">
              {group.docs.map((doc) => {
                const Icon = isPdf(doc.mimeType) ? FileText : isImage(doc.mimeType) ? ImageIcon : File;
                const my = mine.get(doc.id);
                return (
                  <li key={doc.id}>
                    <Link href={`/r/${roomId}/doc/${doc.id}`} className="flex items-center gap-4 px-5 py-3.5 hover:bg-slate-50">
                      <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-slate-100 text-muted">
                        <Icon className="h-5 w-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-medium">{doc.title}</span>
                        <span className="block truncate text-xs text-muted">
                          {doc.description || doc.fileName}
                          {doc.pageCount ? ` · ${doc.pageCount} pages` : ""} · {formatBytes(doc.size)}
                          {doc.version > 1 ? ` · updated v${doc.version}` : ""}
                        </span>
                      </span>
                      {my ? (
                        <span className="hidden shrink-0 items-center gap-1 text-xs text-muted sm:flex" title={`Last opened ${timeAgo(my.last)}`}>
                          <Clock className="h-3.5 w-3.5" /> {formatDuration(my.seconds)} reviewed
                        </span>
                      ) : (
                        <Badge variant="info">New</Badge>
                      )}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
