import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { guestTokenFromRequest, resolveGuestAccessFromToken } from "@/lib/guest-auth";
import { buildNdaCertificate } from "@/lib/pdf";

/** Signed-NDA record. Available to the room owner and to the signer. */
export async function GET(req: Request, ctx: { params: Promise<{ signatureId: string }> }) {
  const { signatureId } = await ctx.params;
  const sig = await prisma.ndaSignature.findUnique({ where: { id: signatureId }, include: { ndaVersion: true, room: { select: { id: true, name: true, ownerId: true } } } });
  if (!sig) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const user = await getCurrentUser();
  let allowed = Boolean(user && user.id === sig.room.ownerId);
  if (!allowed) {
    const access = await resolveGuestAccessFromToken(sig.roomId, guestTokenFromRequest(req, sig.roomId));
    allowed = access.ok && access.guest.id === sig.guestId;
  }
  if (!allowed) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const bytes = await buildNdaCertificate({
    roomName: sig.room.name,
    ndaTitle: sig.ndaVersion.title,
    ndaVersion: sig.ndaVersion.version,
    ndaBody: sig.ndaVersion.body,
    bodyHash: sig.ndaVersion.bodyHash,
    signerName: sig.signerName,
    signerEmail: sig.signerEmail,
    signerTitle: sig.signerTitle,
    signerCompany: sig.signerCompany,
    signedAt: sig.signedAt,
    ipAddress: sig.ipAddress,
    userAgent: sig.userAgent,
    signatureId: sig.id,
  });
  const safeName = sig.signerName.replace(/[^a-z0-9]+/gi, "-").toLowerCase();
  return new NextResponse(Buffer.from(bytes), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="nda-${safeName}-v${sig.ndaVersion.version}.pdf"`,
      "Cache-Control": "private, no-store",
    },
  });
}
