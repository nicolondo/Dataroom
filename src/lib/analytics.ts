import "server-only";
import { prisma } from "./db";

export interface GuestEngagement {
  inviteId: string;
  guestId: string;
  email: string;
  name: string;
  company: string;
  status: string;
  expiresAt: Date | null;
  acceptedAt: Date | null;
  lastSeenAt: Date | null;
  ndaSignedAt: Date | null;
  ndaCurrent: boolean;
  totalSeconds: number;
  documentsViewed: number;
  views: number;
  downloads: number;
}

/** Per-guest engagement summary for a room. */
export async function guestEngagement(roomId: string): Promise<GuestEngagement[]> {
  const [room, invites] = await Promise.all([
    prisma.dataRoom.findUnique({ where: { id: roomId }, include: { ndaVersions: { orderBy: { version: "desc" }, take: 1 } } }),
    prisma.invite.findMany({
      where: { roomId },
      orderBy: { createdAt: "desc" },
      include: {
        guest: true,
        signatures: { orderBy: { signedAt: "desc" }, take: 1 },
        views: { select: { activeSeconds: true, documentId: true } },
        _count: { select: { downloads: true } },
      },
    }),
  ]);
  const currentNdaId = room?.ndaVersions[0]?.id;
  return invites.map((inv) => {
    const sig = inv.signatures[0];
    return {
      inviteId: inv.id,
      guestId: inv.guestId,
      email: inv.guest.email,
      name: inv.guest.name,
      company: inv.guest.company,
      status: inv.status,
      expiresAt: inv.expiresAt,
      acceptedAt: inv.acceptedAt,
      lastSeenAt: inv.lastSeenAt,
      ndaSignedAt: sig?.signedAt ?? null,
      ndaCurrent: Boolean(sig && currentNdaId && sig.ndaVersionId === currentNdaId),
      totalSeconds: inv.views.reduce((s, v) => s + v.activeSeconds, 0),
      documentsViewed: new Set(inv.views.map((v) => v.documentId)).size,
      views: inv.views.length,
      downloads: inv._count.downloads,
    };
  });
}

export interface DocumentEngagement {
  documentId: string;
  title: string;
  folderName: string | null;
  pageCount: number | null;
  published: boolean;
  views: number;
  uniqueViewers: number;
  totalSeconds: number;
  avgSecondsPerViewer: number;
  downloads: number;
  lastViewedAt: Date | null;
}

/** Per-document engagement summary for a room. */
export async function documentEngagement(roomId: string): Promise<DocumentEngagement[]> {
  const docs = await prisma.document.findMany({
    where: { roomId },
    orderBy: [{ sortOrder: "asc" }],
    include: {
      folder: { select: { name: true } },
      viewSessions: { select: { activeSeconds: true, guestId: true, lastHeartbeatAt: true } },
      _count: { select: { downloads: true } },
    },
  });
  return docs.map((d) => {
    const totalSeconds = d.viewSessions.reduce((s, v) => s + v.activeSeconds, 0);
    const uniqueViewers = new Set(d.viewSessions.map((v) => v.guestId)).size;
    const lastViewedAt = d.viewSessions.reduce<Date | null>((latest, v) => (!latest || v.lastHeartbeatAt > latest ? v.lastHeartbeatAt : latest), null);
    return {
      documentId: d.id,
      title: d.title,
      folderName: d.folder?.name ?? null,
      pageCount: d.pageCount,
      published: d.published,
      views: d.viewSessions.length,
      uniqueViewers,
      totalSeconds,
      avgSecondsPerViewer: uniqueViewers ? Math.round(totalSeconds / uniqueViewers) : 0,
      downloads: d._count.downloads,
      lastViewedAt,
    };
  });
}

/** Total seconds spent on each page of a document, across all guests (or one guest). */
export async function pageHeatmap(documentId: string, guestId?: string): Promise<Array<{ page: number; seconds: number }>> {
  const rows = await prisma.pageTime.groupBy({
    by: ["page"],
    where: { viewSession: { documentId, ...(guestId ? { guestId } : {}) } },
    _sum: { seconds: true },
    orderBy: { page: "asc" },
  });
  return rows.map((r) => ({ page: r.page, seconds: r._sum.seconds ?? 0 }));
}

/** Guest × document matrix of seconds for one document. */
export async function documentViewersBreakdown(documentId: string) {
  const sessions = await prisma.viewSession.findMany({
    where: { documentId },
    include: { guest: true, invite: { select: { id: true } } },
    orderBy: { startedAt: "desc" },
  });
  const byGuest = new Map<string, { guestId: string; inviteId: string; email: string; name: string; company: string; seconds: number; sessions: number; maxPage: number; lastViewedAt: Date; firstViewedAt: Date }>();
  for (const s of sessions) {
    const existing = byGuest.get(s.guestId);
    if (existing) {
      existing.seconds += s.activeSeconds;
      existing.sessions += 1;
      existing.maxPage = Math.max(existing.maxPage, s.maxPage);
      if (s.lastHeartbeatAt > existing.lastViewedAt) existing.lastViewedAt = s.lastHeartbeatAt;
      if (s.startedAt < existing.firstViewedAt) existing.firstViewedAt = s.startedAt;
    } else {
      byGuest.set(s.guestId, {
        guestId: s.guestId,
        inviteId: s.invite.id,
        email: s.guest.email,
        name: s.guest.name,
        company: s.guest.company,
        seconds: s.activeSeconds,
        sessions: 1,
        maxPage: s.maxPage,
        lastViewedAt: s.lastHeartbeatAt,
        firstViewedAt: s.startedAt,
      });
    }
  }
  return Array.from(byGuest.values()).sort((a, b) => b.seconds - a.seconds);
}

/** Chronological view sessions for a guest in a room, with page breakdowns. */
export async function guestTimeline(roomId: string, guestId: string) {
  return prisma.viewSession.findMany({
    where: { roomId, guestId },
    orderBy: { startedAt: "desc" },
    include: { document: { select: { id: true, title: true, pageCount: true } }, pageTimes: { orderBy: { page: "asc" } } },
  });
}

export async function roomTotals(roomId: string) {
  const [invites, signed, views, downloads, documents] = await Promise.all([
    prisma.invite.count({ where: { roomId, status: { not: "revoked" } } }),
    prisma.ndaSignature.groupBy({ by: ["guestId"], where: { roomId } }),
    prisma.viewSession.aggregate({ where: { roomId }, _sum: { activeSeconds: true }, _count: true }),
    prisma.download.count({ where: { roomId } }),
    prisma.document.count({ where: { roomId } }),
  ]);
  return {
    invites,
    ndaSigned: signed.length,
    totalSeconds: views._sum.activeSeconds ?? 0,
    views: views._count,
    downloads,
    documents,
  };
}
