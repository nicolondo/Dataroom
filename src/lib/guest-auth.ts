import "server-only";
import { cookies } from "next/headers";
import { cache } from "react";
import { prisma } from "./db";
import { randomToken } from "./crypto";

export const GUEST_COOKIE = "dr_guest_session";
const GUEST_SESSION_HOURS = 24 * 7;

export async function createGuestSession(args: {
  guestId: string;
  inviteId: string;
  roomId: string;
  ip: string;
  userAgent: string;
}): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + GUEST_SESSION_HOURS * 3600 * 1000);
  await prisma.guestSession.create({
    data: { token, expiresAt, ipAddress: args.ip, userAgent: args.userAgent, guestId: args.guestId, inviteId: args.inviteId, roomId: args.roomId },
  });
  const store = await cookies();
  // One guest cookie per room so a reviewer in several rooms keeps separate sessions.
  store.set(`${GUEST_COOKIE}_${args.roomId}`, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyGuestSession(roomId: string): Promise<void> {
  const store = await cookies();
  const name = `${GUEST_COOKIE}_${roomId}`;
  const token = store.get(name)?.value;
  if (token) await prisma.guestSession.deleteMany({ where: { token } });
  store.delete(name);
}

export type GuestAccessState =
  | { ok: false; reason: "no-session" | "revoked" | "expired" }
  | {
      ok: true;
      guest: { id: string; email: string; name: string; company: string };
      invite: { id: string; status: string; expiresAt: Date | null };
      room: {
        id: string;
        name: string;
        description: string;
        ndaRequired: boolean;
        allowDownload: boolean;
        watermarkEnabled: boolean;
        ownerName: string;
      };
      /** Current NDA version, if the room has one. */
      nda: { id: string; version: number; title: string; body: string } | null;
      /** Whether the guest has signed the *current* NDA version. */
      ndaSatisfied: boolean;
    };

/** Resolve the guest's access to a room from the session cookie. */
export async function getGuestAccess(roomId: string): Promise<GuestAccessState> {
  const store = await cookies();
  const token = store.get(`${GUEST_COOKIE}_${roomId}`)?.value;
  return resolveGuestAccessFromToken(roomId, token);
}

export const resolveGuestAccessFromToken = cache(async (roomId: string, token: string | undefined): Promise<GuestAccessState> => {
  if (!token) return { ok: false, reason: "no-session" };
  const session = await prisma.guestSession.findUnique({
    where: { token },
    include: {
      guest: true,
      invite: true,
      room: { include: { owner: { select: { name: true } }, ndaVersions: { orderBy: { version: "desc" }, take: 1 } } },
    },
  });
  if (!session || session.roomId !== roomId || session.expiresAt < new Date()) return { ok: false, reason: "no-session" };
  if (session.invite.status === "revoked") return { ok: false, reason: "revoked" };
  if (session.invite.expiresAt && session.invite.expiresAt < new Date()) return { ok: false, reason: "expired" };

  const nda = session.room.ndaVersions[0] ?? null;
  let ndaSatisfied = !session.room.ndaRequired || !nda;
  if (!ndaSatisfied && nda) {
    const sig = await prisma.ndaSignature.findFirst({ where: { guestId: session.guestId, ndaVersionId: nda.id } });
    ndaSatisfied = Boolean(sig);
  }

  return {
    ok: true,
    guest: { id: session.guest.id, email: session.guest.email, name: session.guest.name, company: session.guest.company },
    invite: { id: session.invite.id, status: session.invite.status, expiresAt: session.invite.expiresAt },
    room: {
      id: session.room.id,
      name: session.room.name,
      description: session.room.description,
      ndaRequired: session.room.ndaRequired,
      allowDownload: session.room.allowDownload,
      watermarkEnabled: session.room.watermarkEnabled,
      ownerName: session.room.owner.name,
    },
    nda: nda ? { id: nda.id, version: nda.version, title: nda.title, body: nda.body } : null,
    ndaSatisfied,
  };
});

/** Read the guest cookie for a room from a raw Request (route handlers). */
export function guestTokenFromRequest(req: Request, roomId: string): string | undefined {
  const raw = req.headers.get("cookie") ?? "";
  const name = `${GUEST_COOKIE}_${roomId}=`;
  for (const part of raw.split(";")) {
    const trimmed = part.trim();
    if (trimmed.startsWith(name)) return decodeURIComponent(trimmed.slice(name.length));
  }
  return undefined;
}
