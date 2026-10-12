"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { sha256 } from "@/lib/crypto";
import type { FormState } from "./auth";

export async function publishNda(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireRoom(roomId);
  const title = String(formData.get("title") ?? "").trim();
  const body = String(formData.get("body") ?? "").replace(/\r\n/g, "\n").trim();
  if (!title) return { error: "Title is required." };
  if (body.length < 50) return { error: "The agreement text looks too short." };
  const latest = await prisma.ndaVersion.findFirst({ where: { roomId }, orderBy: { version: "desc" } });
  const bodyHash = sha256(body);
  if (latest && latest.title === title && latest.bodyHash === bodyHash) return { error: "No changes compared with the current version." };
  const version = (latest?.version ?? 0) + 1;
  const nda = await prisma.ndaVersion.create({ data: { roomId, version, title, body, bodyHash } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "nda.publish", targetType: "nda", targetId: nda.id, targetName: `${title} v${version}`, metadata: { version }, ...meta });
  revalidatePath(`/rooms/${roomId}`, "layout");
  return { success: `Version ${version} published. Guests who signed an earlier version must sign again before viewing documents.` };
}
