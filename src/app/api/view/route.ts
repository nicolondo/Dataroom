import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { guestTokenFromRequest, resolveGuestAccessFromToken } from "@/lib/guest-auth";
import { logEvent } from "@/lib/audit";
import { requestMetaFrom } from "@/lib/request";

const MAX_SECONDS_PER_HEARTBEAT = 30;
const TOLERANCE_S = 5;

type Body =
  | { op: "start"; documentId: string }
  | { op: "heartbeat" | "end"; sessionId: string; pages?: Record<string, number>; maxPage?: number };

/**
 * Engagement tracking endpoint.
 *  - start: opens a ViewSession for the guest + document, returns its id.
 *  - heartbeat / end: adds active seconds per page. The server caps what a
 *    heartbeat may add to the wall-clock time elapsed since the last one, so a
 *    tampered client cannot inflate its numbers.
 */
export async function POST(req: Request) {
  let body: Body;
  try {
    body = (await req.json()) as Body;
  } catch {
    return NextResponse.json({ error: "Bad request" }, { status: 400 });
  }
  const meta = requestMetaFrom(req);

  if (body.op === "start") {
    const doc = await prisma.document.findUnique({ where: { id: body.documentId }, select: { id: true, roomId: true, title: true, published: true, version: true } });
    if (!doc || !doc.published) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const access = await resolveGuestAccessFromToken(doc.roomId, guestTokenFromRequest(req, doc.roomId));
    if (!access.ok || !access.ndaSatisfied) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const session = await prisma.viewSession.create({
      data: { roomId: doc.roomId, documentId: doc.id, guestId: access.guest.id, inviteId: access.invite.id, documentVersion: doc.version, ipAddress: meta.ip, userAgent: meta.userAgent },
    });
    await prisma.invite.update({ where: { id: access.invite.id }, data: { lastSeenAt: new Date() } });
    await logEvent({ roomId: doc.roomId, actorType: "guest", actorId: access.guest.id, actorEmail: access.guest.email, action: "document.view", targetType: "document", targetId: doc.id, targetName: doc.title, metadata: { sessionId: session.id, version: doc.version }, ...meta });
    return NextResponse.json({ sessionId: session.id });
  }

  if (body.op === "heartbeat" || body.op === "end") {
    const session = await prisma.viewSession.findUnique({ where: { id: body.sessionId } });
    if (!session) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const access = await resolveGuestAccessFromToken(session.roomId, guestTokenFromRequest(req, session.roomId));
    if (!access.ok || access.guest.id !== session.guestId) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const now = new Date();
    const elapsed = Math.max(0, (now.getTime() - session.lastHeartbeatAt.getTime()) / 1000);
    const allowance = Math.min(MAX_SECONDS_PER_HEARTBEAT, Math.ceil(elapsed) + TOLERANCE_S);

    const raw = Object.entries(body.pages ?? {})
      .map(([p, s]) => ({ page: Math.max(1, Math.floor(Number(p)) || 1), seconds: Math.max(0, Math.floor(Number(s)) || 0) }))
      .filter((x) => x.seconds > 0);
    const requested = raw.reduce((s, x) => s + x.seconds, 0);
    const factor = requested > allowance ? allowance / requested : 1;
    const pages = raw.map((x) => ({ page: x.page, seconds: Math.round(x.seconds * factor) })).filter((x) => x.seconds > 0);
    const added = pages.reduce((s, x) => s + x.seconds, 0);
    const maxPage = Math.max(session.maxPage, Math.floor(Number(body.maxPage) || 1), ...pages.map((p) => p.page));

    await prisma.$transaction([
      prisma.viewSession.update({
        where: { id: session.id },
        data: { activeSeconds: { increment: added }, lastHeartbeatAt: now, maxPage, ...(body.op === "end" ? { endedAt: now } : {}) },
      }),
      ...pages.map((p) =>
        prisma.pageTime.upsert({
          where: { viewSessionId_page: { viewSessionId: session.id, page: p.page } },
          update: { seconds: { increment: p.seconds } },
          create: { viewSessionId: session.id, page: p.page, seconds: p.seconds },
        }),
      ),
      prisma.invite.update({ where: { id: session.inviteId }, data: { lastSeenAt: now } }),
    ]);
    return NextResponse.json({ ok: true, added });
  }

  return NextResponse.json({ error: "Unknown op" }, { status: 400 });
}
