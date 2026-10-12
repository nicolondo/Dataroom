import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronLeft } from "lucide-react";
import { prisma } from "@/lib/db";
import { getRoomViewer } from "@/lib/room-viewer";
import { Card, CardHeader, Alert } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { AskForm } from "./ask-form";

export const metadata = { title: "Questions" };

export default async function GuestQuestionsPage({ params, searchParams }: { params: Promise<{ roomId: string }>; searchParams: Promise<{ doc?: string }> }) {
  const { roomId } = await params;
  const { doc: docId } = await searchParams;
  const viewer = await getRoomViewer(roomId);
  if (viewer.kind === "none") return null;
  if (viewer.kind === "guest" && !viewer.access.ndaSatisfied) redirect(`/r/${roomId}/nda`);

  const doc = docId ? await prisma.document.findFirst({ where: { id: docId, roomId, published: true }, select: { id: true, title: true } }) : null;
  const questions =
    viewer.kind === "guest"
      ? await prisma.question.findMany({ where: { roomId, guestId: viewer.access.guest.id }, orderBy: { createdAt: "desc" }, include: { document: { select: { title: true } } } })
      : [];

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href={docId ? `/r/${roomId}/doc/${docId}` : `/r/${roomId}`} className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> Back
        </Link>
        <h1 className="text-xl font-semibold">Questions</h1>
        <p className="text-sm text-muted">Ask the room owner anything about the materials. Only you and the owner see your questions.</p>
      </div>
      {viewer.kind === "owner" ? (
        <Alert variant="info">Owners answer questions from the admin Q&amp;A tab.</Alert>
      ) : (
        <Card>
          <CardHeader title={doc ? `Ask about “${doc.title}”` : "Ask a question"} />
          <div className="p-5">
            <AskForm roomId={roomId} documentId={doc?.id ?? null} />
          </div>
        </Card>
      )}
      {questions.length > 0 && (
        <Card>
          <CardHeader title="Your questions" />
          <ul className="divide-y divide-border">
            {questions.map((q) => (
              <li key={q.id} className="px-5 py-4 text-sm">
                <p className="text-xs text-muted">
                  {formatDate(q.createdAt)}
                  {q.document ? ` · ${q.document.title}` : ""}
                </p>
                <p className="mt-1 whitespace-pre-wrap font-medium">{q.body}</p>
                {q.answer ? (
                  <div className="mt-2 rounded-md bg-emerald-50 p-3 text-emerald-900">
                    <p className="text-xs">Answer · {formatDate(q.answeredAt)}</p>
                    <p className="mt-1 whitespace-pre-wrap">{q.answer}</p>
                  </div>
                ) : (
                  <p className="mt-2 text-xs text-muted">Awaiting answer.</p>
                )}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  );
}
