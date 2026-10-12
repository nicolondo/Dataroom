import Link from "next/link";
import { ChevronLeft, ExternalLink } from "lucide-react";
import { requireRoom } from "@/lib/auth";
import { prisma } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { RoomTabs } from "@/components/room/room-tabs";
import { Badge } from "@/components/ui";

export default async function RoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const { user, room } = await requireRoom(roomId);
  const [docs, people, openQuestions] = await Promise.all([
    prisma.document.count({ where: { roomId } }),
    prisma.invite.count({ where: { roomId, status: { not: "revoked" } } }),
    prisma.question.count({ where: { roomId, answer: null } }),
  ]);
  return (
    <AppShell user={user}>
      <div className="mb-5">
        <Link href="/dashboard" className="mb-2 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
          <ChevronLeft className="h-3.5 w-3.5" /> All rooms
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="flex items-center gap-2 text-2xl font-semibold tracking-tight">
              {room.name}
              {room.ndaRequired ? <Badge variant="info">NDA required</Badge> : <Badge variant="warning">No NDA</Badge>}
            </h1>
            {room.description && <p className="mt-1 text-sm text-muted">{room.description}</p>}
          </div>
          <Link href={`/rooms/${roomId}/preview`} className="inline-flex items-center gap-1.5 text-sm text-accent hover:underline" prefetch={false}>
            <ExternalLink className="h-3.5 w-3.5" /> Preview as guest
          </Link>
        </div>
      </div>
      <RoomTabs roomId={roomId} counts={{ Documents: docs, People: people, "Q&A": openQuestions }} />
      <div className="pt-6">{children}</div>
    </AppShell>
  );
}
