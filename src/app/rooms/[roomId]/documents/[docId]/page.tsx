import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Eye, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { Badge, Card, CardHeader, LinkButton, Stat, Table, Td, Th, Avatar } from "@/components/ui";
import { formatBytes, formatDate, formatDuration, initials, timeAgo } from "@/lib/format";
import { documentViewersBreakdown, pageHeatmap } from "@/lib/analytics";
import { DocumentEditForm } from "@/components/room/document-edit-form";
import { UploadDropzone } from "@/components/room/upload-dropzone";
import { PageHeatmap } from "@/components/room/page-heatmap";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deleteDocument } from "@/app/actions/documents";

export default async function DocumentDetailPage({ params }: { params: Promise<{ roomId: string; docId: string }> }) {
  const { roomId, docId } = await params;
  const { room } = await requireRoom(roomId);
  const doc = await prisma.document.findFirst({ where: { id: docId, roomId }, include: { versions: { orderBy: { version: "desc" } }, folder: true, _count: { select: { downloads: true } } } });
  if (!doc) notFound();
  const [folders, viewers, pages] = await Promise.all([prisma.folder.findMany({ where: { roomId }, orderBy: { sortOrder: "asc" } }), documentViewersBreakdown(docId), pageHeatmap(docId)]);
  const totalSeconds = viewers.reduce((s, v) => s + v.seconds, 0);
  const totalSessions = viewers.reduce((s, v) => s + v.sessions, 0);
  const downloadsAllowed = doc.allowDownload ?? room.allowDownload;

  return (
    <div className="space-y-6">
      <div>
        <Link href={`/rooms/${roomId}`} className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Documents
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="flex items-center gap-2 text-xl font-semibold">
              {doc.title}
              {doc.published ? <Badge variant="success">Published</Badge> : <Badge variant="warning">Hidden</Badge>}
              {downloadsAllowed ? <Badge variant="info">Downloadable</Badge> : <Badge>View only</Badge>}
            </h2>
            <p className="mt-1 text-sm text-muted">
              {doc.fileName} · {formatBytes(doc.size)} · v{doc.version}
              {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
              {doc.folder ? ` · in ${doc.folder.name}` : ""}
            </p>
          </div>
          <div className="flex gap-2">
            <LinkButton variant="secondary" href={`/r/${roomId}/doc/${doc.id}`} prefetch={false}>
              <Eye className="h-4 w-4" /> Open viewer
            </LinkButton>
            <form action={deleteDocument.bind(null, roomId, doc.id)}>
              <ConfirmButton variant="dangerOutline" confirm={`Delete "${doc.title}" and all its versions and analytics? This cannot be undone.`}>
                <Trash2 className="h-4 w-4" /> Delete
              </ConfirmButton>
            </form>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-4">
        <Stat label="Unique viewers" value={viewers.length} />
        <Stat label="Total time" value={formatDuration(totalSeconds)} hint={`${totalSessions} sessions`} />
        <Stat label="Avg per viewer" value={formatDuration(viewers.length ? totalSeconds / viewers.length : 0)} />
        <Stat label="Downloads" value={doc._count.downloads} />
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader title="Who reviewed this document" description="Active time only: tabs in the background and idle periods are not counted." />
            {viewers.length === 0 ? (
              <p className="px-5 py-6 text-sm text-muted">Nobody has opened this document yet.</p>
            ) : (
              <Table>
                <thead className="bg-slate-50">
                  <tr>
                    <Th>Guest</Th>
                    <Th>Time spent</Th>
                    <Th>Sessions</Th>
                    <Th>Furthest page</Th>
                    <Th>Last viewed</Th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {viewers.map((v) => (
                    <tr key={v.guestId}>
                      <Td>
                        <Link href={`/rooms/${roomId}/people/${v.inviteId}`} className="flex items-center gap-2 hover:text-accent">
                          <Avatar text={initials(v.name || v.email)} />
                          <span>
                            <span className="block font-medium">{v.name || v.email}</span>
                            <span className="block text-xs text-muted">{v.name ? v.email : v.company}</span>
                          </span>
                        </Link>
                      </Td>
                      <Td className="tabular-nums font-medium">{formatDuration(v.seconds)}</Td>
                      <Td className="tabular-nums">{v.sessions}</Td>
                      <Td className="tabular-nums">
                        {doc.pageCount ? `${v.maxPage} / ${doc.pageCount}` : "—"}
                      </Td>
                      <Td className="text-muted">{timeAgo(v.lastViewedAt)}</Td>
                    </tr>
                  ))}
                </tbody>
              </Table>
            )}
          </Card>

          {doc.pageCount ? (
            <Card>
              <CardHeader title="Time per page" description="Where readers spent their attention across all sessions." />
              <div className="p-5">
                <PageHeatmap pages={pages} pageCount={doc.pageCount} />
              </div>
            </Card>
          ) : null}
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader title="Details" />
            <div className="p-5">
              <DocumentEditForm roomId={roomId} doc={doc} folders={folders} />
            </div>
          </Card>
          <Card>
            <CardHeader title="Versions" description="Upload a replacement; guests always see the latest version." />
            <div className="space-y-4 p-5">
              <UploadDropzone roomId={roomId} documentId={doc.id} compact />
              <ul className="divide-y divide-border text-sm">
                {doc.versions.map((v) => (
                  <li key={v.id} className="flex items-center justify-between py-2">
                    <span>
                      <span className="font-medium">v{v.version}</span> <span className="text-muted">· {v.fileName}</span>
                      {v.note && <span className="block text-xs text-muted">{v.note}</span>}
                    </span>
                    <span className="text-xs text-muted">{formatDate(v.createdAt)}</span>
                  </li>
                ))}
              </ul>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
