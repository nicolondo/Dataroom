"use server";

import { redirect } from "next/navigation";
import { prisma } from "@/lib/db";
import { hashPassword, verifyPassword } from "@/lib/crypto";
import { createOwnerSession, destroyOwnerSession, getCurrentUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";

export type FormState = { error?: string; success?: string } | undefined;

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export async function signup(_prev: FormState, formData: FormData): Promise<FormState> {
  if (process.env.ALLOW_SIGNUP === "false") return { error: "New accounts are disabled on this server." };
  const name = String(formData.get("name") ?? "").trim();
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  if (name.length < 2) return { error: "Please enter your name." };
  if (!EMAIL_RE.test(email)) return { error: "Please enter a valid email address." };
  if (password.length < 8) return { error: "Password must be at least 8 characters." };

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) return { error: "An account with that email already exists." };

  const user = await prisma.user.create({ data: { name, email, passwordHash: hashPassword(password) } });
  await createOwnerSession(user.id);
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: user.id, actorEmail: email, action: "owner.signup", ...meta });
  redirect("/dashboard");
}

export async function login(_prev: FormState, formData: FormData): Promise<FormState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user || !verifyPassword(password, user.passwordHash)) {
    return { error: "Incorrect email or password." };
  }
  await createOwnerSession(user.id);
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: user.id, actorEmail: email, action: "owner.login", ...meta });
  redirect("/dashboard");
}

export async function logout(): Promise<void> {
  const user = await getCurrentUser();
  if (user) {
    const meta = await getRequestMeta();
    await logEvent({ actorType: "owner", actorId: user.id, actorEmail: user.email, action: "owner.logout", ...meta });
  }
  await destroyOwnerSession();
  redirect("/login");
}
