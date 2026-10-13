import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { guestTokenFromRequest, resolveGuestAccessFromToken } from "@/lib/guest-auth";
import { readFile } from "@/lib/storage";
import { watermarkPdf } from "@/lib/pdf";
import { logEvent } from "@/lib/audit";
import { requestMetaFrom } from "@/lib/request";

/**
 * Serves a document's current file to the room owner, or to a guest who has an
 * active session and (when required) has signed the current NDA.
 * `?download=1` applies the identity watermark (PDFs) and records the download.
 */
export async function GET(req: Request, ctx: { params: Promise<{ docId: string }> }) {
  const { docId } = await ctx.params;
  const doc = await prisma.document.findUnique({ where: { id: docId }, include: { room: { select: { id: true, ownerId: true, allowDownload: true, watermarkEnabled: true, name: true } } } });
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });
  const url = new URL(req.url);
  const wantsDownload = url.searchParams.get("download") === "1";

  const user = await getCurrentUser();
  const isOwner = Boolean(user); // any team member
  let guest: { id: string; email: string; inviteId: string } | null = null;
  if (!isOwner) {
    const access = await resolveGuestAccessFromToken(doc.roomId, guestTokenFromRequest(req, doc.roomId));
    if (!access.ok) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    if (!access.ndaSatisfied) return NextResponse.json({ error: "NDA signature required" }, { status: 403 });
    if (!doc.published) return NextResponse.json({ error: "Not found" }, { status: 404 });
    guest = { id: access.guest.id, email: access.guest.email, inviteId: access.invite.id };
  }

  const downloadAllowed = isOwner || (doc.allowDownload ?? doc.room.allowDownload);
  if (wantsDownload && !downloadAllowed) return NextResponse.json({ error: "Downloads are disabled for this document" }, { status: 403 });

  let bytes: Uint8Array = await readFile(doc.storageKey);
  let watermarked = false;
  if (wantsDownload && guest && doc.room.watermarkEnabled && doc.mimeType === "application/pdf") {
    try {
      bytes = await watermarkPdf(bytes, `${guest.email} · ${doc.room.name} · ${new Date().toISOString().slice(0, 16).replace("T", " ")} UTC`);
      watermarked = true;
    } catch (err) {
      console.error("watermark failed, serving original", err);
    }
  }

  if (wantsDownload && guest) {
    const meta = requestMetaFrom(req);
    await prisma.download.create({ data: { roomId: doc.roomId, documentId: doc.id, guestId: guest.id, inviteId: guest.inviteId, watermarked } });
    await logEvent({ roomId: doc.roomId, actorType: "guest", actorId: guest.id, actorEmail: guest.email, action: "document.download", targetType: "document", targetId: doc.id, targetName: doc.title, metadata: { watermarked, version: doc.version }, ...meta });
  }

  const safeName = doc.fileName.replace(/["\r\n]/g, "");
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": doc.mimeType,
      "Content-Length": String(bytes.byteLength),
      "Content-Disposition": `${wantsDownload ? "attachment" : "inline"}; filename="${safeName}"`,
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
