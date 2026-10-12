import "server-only";
import { getCurrentUser } from "./auth";
import { getGuestAccess, type GuestAccessState } from "./guest-auth";
import { prisma } from "./db";

export type RoomViewer =
  | { kind: "guest"; access: Extract<GuestAccessState, { ok: true }> }
  | { kind: "owner"; room: { id: string; name: string; description: string; ndaRequired: boolean; allowDownload: boolean; watermarkEnabled: boolean; ownerName: string }; nda: { id: string; version: number; title: string; body: string } | null }
  | { kind: "none"; reason: "no-session" | "revoked" | "expired" };

/**
 * Who is looking at the guest-facing room pages: a guest with a session, or the
 * room's owner previewing it. Owners are never tracked.
 */
export async function getRoomViewer(roomId: string): Promise<RoomViewer> {
  const access = await getGuestAccess(roomId);
  if (access.ok) return { kind: "guest", access };
  const user = await getCurrentUser();
  if (user) {
    const room = await prisma.dataRoom.findFirst({ where: { id: roomId, ownerId: user.id }, include: { ndaVersions: { orderBy: { version: "desc" }, take: 1 } } });
    if (room) {
      const nda = room.ndaVersions[0] ?? null;
      return {
        kind: "owner",
        room: { id: room.id, name: room.name, description: room.description, ndaRequired: room.ndaRequired, allowDownload: room.allowDownload, watermarkEnabled: room.watermarkEnabled, ownerName: user.name },
        nda: nda ? { id: nda.id, version: nda.version, title: nda.title, body: nda.body } : null,
      };
    }
  }
  return { kind: "none", reason: access.reason };
}
