"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { sendMail, emailConfigured, verifySmtp } from "@/lib/email";
import type { FormState } from "./auth";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

export async function createUser(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) return { error: "Enter the person's name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  if (password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  if (await prisma.user.findUnique({ where: { email } })) return { error: "A user with that email already exists." };
  const user = await prisma.user.create({ data: { name, email, passwordHash: hashPassword(password) } });
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: actor.id, actorEmail: actor.email, action: "user.create", targetType: "user", targetId: user.id, targetName: email, ...meta });
  revalidatePath("/users");
  return { success: `${name} can now sign in with ${email}.` };
}

export async function resetUserPassword(userId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser();
  const password = String(formData.get("password") ?? "");
  if (password.length < MIN_PASSWORD) return { error: `Password must be at least ${MIN_PASSWORD} characters.` };
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return { error: "User not found." };
  await prisma.$transaction([
    prisma.user.update({ where: { id: userId }, data: { passwordHash: hashPassword(password) } }),
    // Sign that user out everywhere except, if it is the actor, the current session.
    prisma.session.deleteMany({ where: { userId, ...(userId === actor.id ? { expiresAt: { lt: new Date() } } : {}) } }),
  ]);
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: actor.id, actorEmail: actor.email, action: "user.password_reset", targetType: "user", targetId: user.id, targetName: user.email, ...meta });
  revalidatePath("/users");
  return { success: `Password updated for ${user.email}.` };
}

export async function deleteUser(userId: string): Promise<void> {
  const actor = await requireUser();
  if (userId === actor.id) return;
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) return;
  const total = await prisma.user.count();
  if (total <= 1) return;
  // Keep their rooms, invitations and answers: hand them to the person removing the account.
  await prisma.$transaction([
    prisma.dataRoom.updateMany({ where: { ownerId: userId }, data: { ownerId: actor.id } }),
    prisma.invite.updateMany({ where: { invitedById: userId }, data: { invitedById: actor.id } }),
    prisma.question.updateMany({ where: { answeredById: userId }, data: { answeredById: actor.id } }),
    prisma.user.delete({ where: { id: userId } }),
  ]);
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: actor.id, actorEmail: actor.email, action: "user.delete", targetType: "user", targetId: userId, targetName: user.email, ...meta });
  revalidatePath("/users");
}

export async function changeOwnPassword(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser();
  const current = String(formData.get("current") ?? "");
  const password = String(formData.get("password") ?? "");
  const confirm = String(formData.get("confirm") ?? "");
  const user = await prisma.user.findUnique({ where: { id: actor.id } });
  if (!user || !verifyPassword(current, user.passwordHash)) return { error: "Your current password is incorrect." };
  if (password.length < MIN_PASSWORD) return { error: `New password must be at least ${MIN_PASSWORD} characters.` };
  if (password !== confirm) return { error: "The new passwords do not match." };
  await prisma.user.update({ where: { id: actor.id }, data: { passwordHash: hashPassword(password) } });
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: actor.id, actorEmail: actor.email, action: "owner.password_change", ...meta });
  return { success: "Password changed." };
}

export async function updateProfile(_prev: FormState, formData: FormData): Promise<FormState> {
  const actor = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (name.length < 2) return { error: "Enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Enter a valid email address." };
  const clash = await prisma.user.findUnique({ where: { email } });
  if (clash && clash.id !== actor.id) return { error: "That email is used by another account." };
  await prisma.user.update({ where: { id: actor.id }, data: { name, email } });
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: actor.id, actorEmail: email, action: "owner.profile_update", ...meta });
  revalidatePath("/", "layout");
  return { success: "Profile saved." };
}

export async function sendTestEmail(): Promise<FormState> {
  const actor = await requireUser();
  if (!emailConfigured()) return { error: "SMTP is not configured on the server (SMTP_URL is empty in .env)." };
  const check = await verifySmtp();
  if (!check.ok) return { error: `SMTP connection failed: ${check.error}` };
  const result = await sendMail({
    to: actor.email,
    subject: "Data Room test email",
    text: `Hello ${actor.name},\n\nEmail delivery from your data room works. Invitations, NDA notifications and Q&A alerts will be sent from this address.`,
  });
  if (!result.sent) return { error: `Sending failed: ${result.error}` };
  return { success: `Test email sent to ${actor.email}. Check your inbox (and spam folder).` };
}
