import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { getRoomViewer } from "@/lib/room-viewer";
import { DocumentViewer } from "@/components/viewer/document-viewer";

export async function generateMetadata({ params }: { params: Promise<{ roomId: string; docId: string }> }) {
  const { docId } = await params;
  const doc = await prisma.document.findUnique({ where: { id: docId }, select: { title: true } });
  return { title: doc?.title ?? "Document" };
}

export default async function GuestDocumentPage({ params }: { params: Promise<{ roomId: string; docId: string }> }) {
  const { roomId, docId } = await params;
  const viewer = await getRoomViewer(roomId);
  if (viewer.kind === "none") return null;
  if (viewer.kind === "guest" && !viewer.access.ndaSatisfied) redirect(`/r/${roomId}/nda`);
  const doc = await prisma.document.findFirst({ where: { id: docId, roomId, ...(viewer.kind === "guest" ? { published: true } : {}) } });
  if (!doc) notFound();

  const room = viewer.kind === "guest" ? viewer.access.room : viewer.room;
  const isGuest = viewer.kind === "guest";
  const identity = isGuest ? viewer.access.guest.email : "OWNER PREVIEW";
  const watermarkText = room.watermarkEnabled ? `${identity} · ${new Date().toISOString().slice(0, 10)}` : null;
  const canDownload = isGuest ? (doc.allowDownload ?? room.allowDownload) : true;

  return (
    <DocumentViewer
      roomId={roomId}
      documentId={doc.id}
      title={doc.title}
      description={doc.description}
      mimeType={doc.mimeType}
      fileName={doc.fileName}
      version={doc.version}
      pageCount={doc.pageCount}
      watermarkText={watermarkText}
      canDownload={canDownload}
      tracking={isGuest}
      askHref={`/r/${roomId}/questions?doc=${doc.id}`}
    />
  );
}
