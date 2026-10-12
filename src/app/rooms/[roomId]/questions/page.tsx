import Link from "next/link";
import { MessageSquare, Trash2 } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { Badge, Card, CardHeader, EmptyState } from "@/components/ui";
import { formatDate } from "@/lib/format";
import { AnswerForm } from "@/components/room/answer-form";
import { ConfirmButton } from "@/components/forms/confirm-button";
import { deleteQuestion } from "@/app/actions/questions";

export const metadata = { title: "Q&A" };

export default async function QuestionsPage({ params }: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  await requireRoom(roomId);
  const questions = await prisma.question.findMany({
    where: { roomId },
    orderBy: [{ answeredAt: "asc" }, { createdAt: "desc" }],
    include: { guest: true, document: { select: { id: true, title: true } }, answeredBy: { select: { name: true } } },
  });
  const open = questions.filter((q) => !q.answer);
  const answered = questions.filter((q) => q.answer);

  if (questions.length === 0) {
    return <EmptyState title="No questions yet" description="Guests can ask questions about the room or a specific document from the viewer. They show up here for you to answer." />;
  }

  const render = (q: (typeof questions)[number]) => (
    <li key={q.id} className="px-5 py-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs text-muted">
            <span className="font-medium text-foreground">{q.guest.name || q.guest.email}</span>
            {q.guest.company ? ` (${q.guest.company})` : ""} · {formatDate(q.createdAt)}
            {q.document && (
              <>
                {" "}
                · on{" "}
                <Link href={`/rooms/${roomId}/documents/${q.document.id}`} className="text-accent hover:underline">
                  {q.document.title}
                </Link>
              </>
            )}
          </p>
          <p className="mt-1 whitespace-pre-wrap text-sm">{q.body}</p>
        </div>
        <form action={deleteQuestion.bind(null, roomId, q.id)}>
          <ConfirmButton variant="ghost" size="sm" confirm="Delete this question?">
            <Trash2 className="h-3.5 w-3.5" />
          </ConfirmButton>
        </form>
      </div>
      {q.answer && (
        <div className="mt-3 rounded-md bg-slate-50 p-3 text-sm">
          <p className="text-xs text-muted">
            Answered by {q.answeredBy?.name ?? "owner"} · {formatDate(q.answeredAt)}
          </p>
          <p className="mt-1 whitespace-pre-wrap">{q.answer}</p>
        </div>
      )}
      <details className="mt-1">
        <summary className="cursor-pointer text-xs text-accent">{q.answer ? "Edit answer" : "Answer"}</summary>
        <AnswerForm roomId={roomId} questionId={q.id} existing={q.answer} />
      </details>
    </li>
  );

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader title="Open questions" action={<Badge variant={open.length ? "warning" : "success"}>{open.length} open</Badge>} />
        {open.length === 0 ? <p className="px-5 py-6 text-sm text-muted">All caught up.</p> : <ul className="divide-y divide-border">{open.map(render)}</ul>}
      </Card>
      {answered.length > 0 && (
        <Card>
          <CardHeader title="Answered" action={<MessageSquare className="h-4 w-4 text-muted" />} />
          <ul className="divide-y divide-border">{answered.map(render)}</ul>
        </Card>
      )}
    </div>
  );
}
