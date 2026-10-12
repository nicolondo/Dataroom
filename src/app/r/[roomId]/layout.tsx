import Link from "next/link";
import { Lock, LogOut, Eye } from "lucide-react";
import { getRoomViewer } from "@/lib/room-viewer";
import { leaveRoom } from "@/app/actions/guest";
import { Alert, LinkButton } from "@/components/ui";

export default async function GuestRoomLayout({ children, params }: { children: React.ReactNode; params: Promise<{ roomId: string }> }) {
  const { roomId } = await params;
  const viewer = await getRoomViewer(roomId);

  if (viewer.kind === "none") {
    const message =
      viewer.reason === "revoked"
        ? "Your access to this data room has been revoked."
        : viewer.reason === "expired"
          ? "Your access to this data room has expired."
          : "Your session has ended. Open the link from your invitation email to sign in again.";
    return (
      <main className="flex flex-1 items-center justify-center px-4 py-12">
        <div className="w-full max-w-md space-y-4">
          <Alert variant="warning">{message}</Alert>
          <p className="text-center text-xs text-muted">
            Room owner?{" "}
            <Link href="/login" className="text-accent hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </main>
    );
  }

  const room = viewer.kind === "guest" ? viewer.access.room : viewer.room;
  const identity = viewer.kind === "guest" ? viewer.access.guest.name || viewer.access.guest.email : "Owner preview";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="no-print sticky top-0 z-20 border-b border-border bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
          <Link href={`/r/${roomId}`} className="flex min-w-0 items-center gap-2 font-semibold">
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-accent text-white">
              <Lock className="h-3.5 w-3.5" />
            </span>
            <span className="truncate">{room.name}</span>
          </Link>
          <div className="flex items-center gap-3 text-sm">
            {viewer.kind === "owner" ? (
              <>
                <span className="hidden items-center gap-1 rounded-full bg-amber-50 px-2.5 py-1 text-xs font-medium text-amber-800 ring-1 ring-amber-200 sm:inline-flex">
                  <Eye className="h-3.5 w-3.5" /> Preview mode · not tracked
                </span>
                <LinkButton variant="secondary" size="sm" href={`/rooms/${roomId}`}>
                  Back to admin
                </LinkButton>
              </>
            ) : (
              <>
                <span className="hidden text-slate-700 sm:inline">{identity}</span>
                <form action={leaveRoom.bind(null, roomId)}>
                  <button type="submit" className="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted hover:bg-slate-100 hover:text-foreground">
                    <LogOut className="h-4 w-4" /> <span className="hidden sm:inline">Leave</span>
                  </button>
                </form>
              </>
            )}
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
      <footer className="no-print border-t border-border py-4 text-center text-xs text-muted">Confidential. Access is logged and documents are watermarked with your identity.</footer>
    </div>
  );
}
