import Link from "next/link";
import { FileText, Users, Clock, Plus } from "lucide-react";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { Card, EmptyState, PageHeader, Badge } from "@/components/ui";
import { formatDuration, timeAgo } from "@/lib/format";
import { CreateRoomDialog } from "./create-room";

export const metadata = { title: "Dashboard" };

export default async function DashboardPage() {
  const user = await requireUser();
  const rooms = await prisma.dataRoom.findMany({
    where: { ownerId: user.id },
    orderBy: { updatedAt: "desc" },
    include: {
      _count: { select: { documents: true, invites: true, signatures: true } },
      viewSessions: { select: { activeSeconds: true, lastHeartbeatAt: true } },
    },
  });

  return (
    <>
      <PageHeader title="Data rooms" description="Each room has its own documents, NDA, guest list and analytics." action={<CreateRoomDialog />} />
      {rooms.length === 0 ? (
        <EmptyState
          title="No data rooms yet"
          description="Create a room, upload documents, and invite reviewers. They will sign your NDA before seeing anything."
          action={<CreateRoomDialog label="Create your first room" />}
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {rooms.map((room) => {
            const totalSeconds = room.viewSessions.reduce((s, v) => s + v.activeSeconds, 0);
            const lastActivity = room.viewSessions.reduce<Date | null>((latest, v) => (!latest || v.lastHeartbeatAt > latest ? v.lastHeartbeatAt : latest), null);
            return (
              <Link key={room.id} href={`/rooms/${room.id}`} className="group">
                <Card className="h-full p-5 transition-shadow group-hover:shadow-md">
                  <div className="flex items-start justify-between gap-2">
                    <h2 className="font-semibold group-hover:text-accent">{room.name}</h2>
                    {room.ndaRequired ? <Badge variant="info">NDA</Badge> : <Badge>Open</Badge>}
                  </div>
                  <p className="mt-1 line-clamp-2 min-h-10 text-sm text-muted">{room.description || "No description"}</p>
                  <dl className="mt-4 grid grid-cols-3 gap-2 text-xs text-muted">
                    <div className="flex items-center gap-1.5">
                      <FileText className="h-3.5 w-3.5" /> {room._count.documents} docs
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Users className="h-3.5 w-3.5" /> {room._count.invites} guests
                    </div>
                    <div className="flex items-center gap-1.5">
                      <Clock className="h-3.5 w-3.5" /> {formatDuration(totalSeconds)}
                    </div>
                  </dl>
                  <p className="mt-3 text-xs text-muted">Last viewed {timeAgo(lastActivity)}</p>
                </Card>
              </Link>
            );
          })}
          <CreateRoomDialog
            trigger={
              <div className="flex h-full min-h-40 items-center justify-center rounded-lg border border-dashed border-border text-sm text-muted hover:border-accent hover:text-accent">
                <Plus className="mr-1.5 h-4 w-4" /> New data room
              </div>
            }
          />
        </div>
      )}
    </>
  );
}
