"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { randomToken } from "@/lib/crypto";
import { sendInviteEmail, inviteUrl } from "@/lib/email";
import type { FormState } from "./auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export type InviteState = (FormState & { link?: string; emailed?: boolean }) | undefined;

export async function createInvite(roomId: string, _prev: InviteState, formData: FormData): Promise<InviteState> {
  const { user, room } = await requireRoom(roomId);
  const rawEmails = String(formData.get("emails") ?? "");
  const emails = Array.from(new Set(rawEmails.split(/[\s,;]+/).map((e) => e.trim().toLowerCase()).filter(Boolean)));
  if (emails.length === 0) return { error: "Enter at least one email address." };
  const invalid = emails.filter((e) => !EMAIL_RE.test(e));
  if (invalid.length) return { error: `Invalid email: ${invalid.join(", ")}` };
  const name = String(formData.get("name") ?? "").trim();
  const company = String(formData.get("company") ?? "").trim();
  const message = String(formData.get("message") ?? "").trim();
  const expiryDays = Number(formData.get("expiryDays") ?? room.inviteExpiryDays);
  const expiresAt = Number.isFinite(expiryDays) && expiryDays > 0 ? new Date(Date.now() + expiryDays * 86400 * 1000) : null;
  const meta = await getRequestMeta();

  let lastLink = "";
  let emailed = true;
  for (const email of emails) {
    const guest = await prisma.guest.upsert({
      where: { email },
      update: { ...(name && emails.length === 1 ? { name } : {}), ...(company ? { company } : {}) },
      create: { email, name: emails.length === 1 ? name : "", company },
    });
    const existing = await prisma.invite.findUnique({ where: { roomId_guestId: { roomId, guestId: guest.id } } });
    let invite;
    if (existing) {
      invite = await prisma.invite.update({
        where: { id: existing.id },
        data: { status: existing.status === "revoked" ? "pending" : existing.status, revokedAt: null, expiresAt, message, token: existing.status === "revoked" ? randomToken(24) : existing.token },
      });
    } else {
      invite = await prisma.invite.create({ data: { roomId, guestId: guest.id, invitedById: user.id, token: randomToken(24), expiresAt, message } });
    }
    const result = await sendInviteEmail({ to: email, roomName: room.name, inviterName: user.name, token: invite.token, message, ndaRequired: room.ndaRequired, expiresAt });
    emailed = emailed && result.sent;
    lastLink = inviteUrl(invite.token);
    await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "invite.create", targetType: "invite", targetId: invite.id, targetName: email, metadata: { expiresAt, emailed: result.sent }, ...meta });
  }
  revalidatePath(`/rooms/${roomId}`, "layout");
  return {
    success: emails.length === 1 ? `Invitation ready for ${emails[0]}.` : `${emails.length} invitations created.`,
    link: emails.length === 1 ? lastLink : undefined,
    emailed,
  };
}

export async function resendInvite(roomId: string, inviteId: string): Promise<void> {
  const { user, room } = await requireRoom(roomId);
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, roomId }, include: { guest: true } });
  if (!invite || invite.status === "revoked") return;
  await sendInviteEmail({ to: invite.guest.email, roomName: room.name, inviterName: user.name, token: invite.token, message: invite.message, ndaRequired: room.ndaRequired, expiresAt: invite.expiresAt });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "invite.resend", targetType: "invite", targetId: invite.id, targetName: invite.guest.email, ...meta });
  revalidatePath(`/rooms/${roomId}/people`);
}

export async function revokeInvite(roomId: string, inviteId: string): Promise<void> {
  const { user } = await requireRoom(roomId);
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, roomId }, include: { guest: true } });
  if (!invite) return;
  await prisma.$transaction([
    prisma.invite.update({ where: { id: inviteId }, data: { status: "revoked", revokedAt: new Date() } }),
    // Kill live sessions immediately.
    prisma.guestSession.deleteMany({ where: { inviteId } }),
  ]);
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "invite.revoke", targetType: "invite", targetId: invite.id, targetName: invite.guest.email, ...meta });
  revalidatePath(`/rooms/${roomId}`, "layout");
}

export async function restoreInvite(roomId: string, inviteId: string): Promise<void> {
  const { user, room } = await requireRoom(roomId);
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, roomId }, include: { guest: true } });
  if (!invite || invite.status !== "revoked") return;
  const expiresAt = room.inviteExpiryDays > 0 ? new Date(Date.now() + room.inviteExpiryDays * 86400 * 1000) : null;
  await prisma.invite.update({ where: { id: inviteId }, data: { status: "pending", revokedAt: null, token: randomToken(24), expiresAt } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "invite.restore", targetType: "invite", targetId: invite.id, targetName: invite.guest.email, ...meta });
  revalidatePath(`/rooms/${roomId}`, "layout");
}

export async function extendInvite(roomId: string, inviteId: string, formData: FormData): Promise<void> {
  const { user } = await requireRoom(roomId);
  const invite = await prisma.invite.findFirst({ where: { id: inviteId, roomId }, include: { guest: true } });
  if (!invite) return;
  const days = Number(formData.get("days") ?? 0);
  const expiresAt = days > 0 ? new Date(Date.now() + days * 86400 * 1000) : null;
  await prisma.invite.update({ where: { id: inviteId }, data: { expiresAt } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "invite.create", targetType: "invite", targetId: invite.id, targetName: invite.guest.email, metadata: { expiresAt, extended: true }, ...meta });
  revalidatePath(`/rooms/${roomId}/people`);
}
