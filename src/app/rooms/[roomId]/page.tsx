import Link from "next/link";
import { FileText, Folder, Image as ImageIcon, File, Trash2, EyeOff } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { Badge, Card, CardHeader, EmptyState, Table, Td, Th } from "@/components/ui";
import { formatBytes, formatDuration, isImage, isPdf } from "@/lib/format";
import { UploadDropzone } from "@/components/room/upload-dropzone";
import { FolderForm } from "@/components/room/folder-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deleteFolder, togglePublished } from "@/app/actions/documents";

export const metadata = { title: "Documents" };

export default async function DocumentsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  await requireRoom(roomId);
  const [folders, documents] = await Promise.all([
    prisma.folder.findMany({ where: { roomId }, orderBy: { sortOrder: "asc" } }),
    prisma.document.findMany({
      where: { roomId },
      orderBy: [{ sortOrder: "asc" }, { createdAt: "asc" }],
      include: { viewSessions: { select: { activeSeconds: true, guestId: true } }, _count: { select: { downloads: true } } },
    }),
  ]);

  const groups: Array<{ id: string | null; name: string; docs: typeof documents }> = [
    { id: null, name: "Root", docs: documents.filter((d) => !d.folderId) },
    ...folders.map((f) => ({ id: f.id, name: f.name, docs: documents.filter((d) => d.folderId === f.id) })),
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Upload documents" description="Files are stored privately and only served to guests who have signed the NDA." />
        <div className="p-5">
          <UploadDropzone roomId={roomId} folders={folders} />
        </div>
      </Card>

      <div className="flex items-center justify-between">
        <h2 className="text-base font-semibold">
          Documents <span className="text-sm font-normal text-muted">({documents.length})</span>
        </h2>
        <FolderForm roomId={roomId} />
      </div>

      {documents.length === 0 && folders.length === 0 ? (
        <EmptyState title="No documents yet" description="Upload your first file above. You can organise files into folders and control downloads per document." />
      ) : (
        groups.map((group) =>
          group.id === null && group.docs.length === 0 && folders.length > 0 ? null : (
            <Card key={group.id ?? "root"}>
              <div className="flex items-center justify-between border-b border-border px-5 py-3">
                <h3 className="flex items-center gap-2 text-sm font-semibold">
                  <Folder className="h-4 w-4 text-muted" /> {group.name}
                  <span className="font-normal text-muted">({group.docs.length})</span>
                </h3>
                {group.id && (
                  <form action={deleteFolder.bind(null, roomId, group.id)}>
                    <ConfirmButton variant="ghost" size="sm" confirm={`Delete folder "${group.name}"? Documents inside move to the root.`}>
                      <Trash2 className="h-3.5 w-3.5" /> Delete folder
                    </ConfirmButton>
                  </form>
                )}
              </div>
              {group.docs.length === 0 ? (
                <p className="px-5 py-4 text-sm text-muted">Empty folder.</p>
              ) : (
                <Table>
                  <thead className="bg-slate-50">
                    <tr>
                      <Th>Document</Th>
                      <Th>Size</Th>
                      <Th>Version</Th>
                      <Th>Viewers</Th>
                      <Th>Time viewed</Th>
                      <Th>Downloads</Th>
                      <Th>Status</Th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {group.docs.map((doc) => {
                      const totalSeconds = doc.viewSessions.reduce((s, v) => s + v.activeSeconds, 0);
                      const viewers = new Set(doc.viewSessions.map((v) => v.guestId)).size;
                      const Icon = isPdf(doc.mimeType) ? FileText : isImage(doc.mimeType) ? ImageIcon : File;
                      return (
                        <tr key={doc.id} className="hover:bg-slate-50/60">
                          <Td>
                            <Link href={`/rooms/${roomId}/documents/${doc.id}`} className="flex items-center gap-2.5 font-medium hover:text-accent">
                              <Icon className="h-4 w-4 shrink-0 text-muted" />
                              <span>
                                {doc.title}
                                <span className="block text-xs font-normal text-muted">
                                  {doc.fileName}
                                  {doc.pageCount ? ` · ${doc.pageCount} pages` : ""}
                                </span>
                              </span>
                            </Link>
                          </Td>
                          <Td className="text-muted">{formatBytes(doc.size)}</Td>
                          <Td className="text-muted">v{doc.version}</Td>
                          <Td className="tabular-nums">{viewers}</Td>
                          <Td className="tabular-nums">{formatDuration(totalSeconds)}</Td>
                          <Td className="tabular-nums">{doc._count.downloads}</Td>
                          <Td>
                            <form action={togglePublished.bind(null, roomId, doc.id)}>
                              <button type="submit" title={doc.published ? "Click to hide from guests" : "Click to publish"}>
                                {doc.published ? (
                                  <Badge variant="success">Published</Badge>
                                ) : (
                                  <Badge variant="warning">
                                    <EyeOff className="mr-1 h-3 w-3" /> Hidden
                                  </Badge>
                                )}
                              </button>
                            </form>
                          </Td>
                        </tr>
                      );
                    })}
                  </tbody>
                </Table>
              )}
            </Card>
          ),
        )
      )}
    </div>
  );
}
