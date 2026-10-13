import "server-only";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { cache } from "react";
import { prisma } from "./db";
import { randomToken } from "./crypto";

export const OWNER_COOKIE = "dr_owner_session";
const SESSION_DAYS = 30;

export async function createOwnerSession(userId: string): Promise<void> {
  const token = randomToken(32);
  const expiresAt = new Date(Date.now() + SESSION_DAYS * 86400 * 1000);
  await prisma.session.create({ data: { token, userId, expiresAt } });
  const store = await cookies();
  store.set(OWNER_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroyOwnerSession(): Promise<void> {
  const store = await cookies();
  const token = store.get(OWNER_COOKIE)?.value;
  if (token) await prisma.session.deleteMany({ where: { token } });
  store.delete(OWNER_COOKIE);
}

export type CurrentUser = { id: string; email: string; name: string };

/** Returns the signed-in owner, or null. Memoised per request. */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const store = await cookies();
  const token = store.get(OWNER_COOKIE)?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { token },
    include: { user: { select: { id: true, email: true, name: true } } },
  });
  if (!session || session.expiresAt < new Date()) return null;
  return session.user;
});

export async function requireUser(): Promise<CurrentUser> {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  return user;
}

/**
 * Loads a room for a signed-in team member. All accounts on this installation
 * form one team and share every data room; redirects to the dashboard if the
 * room does not exist.
 */
export async function requireRoom(roomId: string) {
  const user = await requireUser();
  const room = await prisma.dataRoom.findUnique({ where: { id: roomId } });
  if (!room) redirect("/dashboard");
  return { user, room };
}
