"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { createGuestSession, destroyGuestSession, getGuestAccess } from "@/lib/guest-auth";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { notifyOwner } from "@/lib/email";
import type { FormState } from "./auth";

/** Validate an invite token and open a guest session. */
export async function acceptInvite(token: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const invite = await prisma.invite.findUnique({ where: { token }, include: { guest: true, room: { include: { owner: true } } } });
  if (!invite) return { error: "This invitation link is not valid." };
  if (invite.status === "revoked") return { error: "Access to this data room has been revoked." };
  if (invite.expiresAt && invite.expiresAt < new Date()) {
    await logEvent({ roomId: invite.roomId, actorType: "guest", actorId: invite.guestId, actorEmail: invite.guest.email, action: "invite.expired", targetType: "invite", targetId: invite.id });
    return { error: "This invitation has expired. Ask the sender for a new link." };
  }
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  if (!invite.guest.name && name.length < 2) return { error: "Please enter your full name." };

  const meta = await getRequestMeta();
  const firstTime = !invite.acceptedAt;
  await prisma.$transaction([
    prisma.guest.update({ where: { id: invite.guestId }, data: { ...(name ? { name } : {}), ...(company ? { company } : {}) } }),
    prisma.invite.update({ where: { id: invite.id }, data: { status: "active", acceptedAt: invite.acceptedAt ?? new Date(), lastSeenAt: new Date() } }),
  ]);
  await createGuestSession({ guestId: invite.guestId, inviteId: invite.id, roomId: invite.roomId, ...meta });
  await logEvent({ roomId: invite.roomId, actorType: "guest", actorId: invite.guestId, actorEmail: invite.guest.email, action: firstTime ? "invite.accept" : "guest.login", targetType: "room", targetId: invite.roomId, targetName: invite.room.name, ...meta });
  if (firstTime && invite.room.notifyOnFirstView) {
    await notifyOwner({
      to: invite.room.owner.email,
      subject: `${name || invite.guest.name || invite.guest.email} entered "${invite.room.name}"`,
      text: `${name || invite.guest.name || invite.guest.email} (${invite.guest.email}) has opened their invitation to "${invite.room.name}".`,
    });
  }
  redirect(`/r/${invite.roomId}`);
}

export async function signNda(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const access = await getGuestAccess(roomId);
  if (!access.ok) return { error: "Your session has ended. Open your invitation link again." };
  if (!access.nda) return { error: "This room has no NDA to sign." };
  const signerName = String(formData.get("signerName") ?? "").trim();
  const signerTitle = String(formData.get("signerTitle") ?? "").trim();
  const signerCompany = String(formData.get("signerCompany") ?? "").trim();
  const agreed = formData.get("agree") === "on";
  const ndaVersionId = String(formData.get("ndaVersionId") ?? "");
  if (ndaVersionId !== access.nda.id) return { error: "The agreement was updated while you were reading. Please review the new version." };
  if (signerName.length < 2) return { error: "Type your full legal name to sign." };
  if (!agreed) return { error: "You must confirm that you have read and agree to the terms." };

  const meta = await getRequestMeta();
  const signature = await prisma.ndaSignature.create({
    data: {
      roomId,
      ndaVersionId: access.nda.id,
      guestId: access.guest.id,
      inviteId: access.invite.id,
      signerName,
      signerEmail: access.guest.email,
      signerTitle,
      signerCompany,
      ipAddress: meta.ip,
      userAgent: meta.userAgent,
    },
  });
  await prisma.guest.update({ where: { id: access.guest.id }, data: { ...(signerName ? { name: signerName } : {}), ...(signerCompany ? { company: signerCompany } : {}) } });
  await logEvent({ roomId, actorType: "guest", actorId: access.guest.id, actorEmail: access.guest.email, action: "nda.sign", targetType: "nda", targetId: access.nda.id, targetName: `${access.nda.title} v${access.nda.version}`, metadata: { signatureId: signature.id, signerName }, ...meta });

  const room = await prisma.dataRoom.findUnique({ where: { id: roomId }, include: { owner: true } });
  if (room?.notifyOnNda) {
    await notifyOwner({
      to: room.owner.email,
      subject: `${signerName} signed the NDA for "${room.name}"`,
      text: `${signerName} (${access.guest.email}) signed "${access.nda.title}" version ${access.nda.version} at ${new Date().toUTCString()}.`,
    });
  }
  revalidatePath(`/r/${roomId}`, "layout");
  redirect(`/r/${roomId}`);
}

export async function askQuestion(roomId: string, documentId: string | null, _prev: FormState, formData: FormData): Promise<FormState> {
  const access = await getGuestAccess(roomId);
  if (!access.ok) return { error: "Your session has ended." };
  if (!access.ndaSatisfied) return { error: "Sign the NDA first." };
  const body = String(formData.get("body") ?? "").trim();
  if (body.length < 5) return { error: "Please write a longer question." };
  if (documentId) {
    const doc = await prisma.document.findFirst({ where: { id: documentId, roomId, published: true } });
    if (!doc) return { error: "Document not found." };
  }
  const q = await prisma.question.create({ data: { roomId, documentId, guestId: access.guest.id, body } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "guest", actorId: access.guest.id, actorEmail: access.guest.email, action: "question.ask", targetType: "question", targetId: q.id, targetName: body.slice(0, 80), ...meta });
  const room = await prisma.dataRoom.findUnique({ where: { id: roomId }, include: { owner: true } });
  if (room) {
    await notifyOwner({ to: room.owner.email, subject: `New question in "${room.name}"`, text: `${access.guest.name || access.guest.email} asked:\n\n${body}` });
  }
  revalidatePath(`/r/${roomId}`, "layout");
  return { success: "Question sent. You will see the answer here." };
}

export async function leaveRoom(roomId: string): Promise<void> {
  const access = await getGuestAccess(roomId);
  if (access.ok) {
    const meta = await getRequestMeta();
    await logEvent({ roomId, actorType: "guest", actorId: access.guest.id, actorEmail: access.guest.email, action: "guest.logout", ...meta });
  }
  await destroyGuestSession(roomId);
  redirect(`/r/${roomId}`);
}
