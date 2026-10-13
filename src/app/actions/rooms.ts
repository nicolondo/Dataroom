"use server";

import { redirectTo } from "@/lib/redirect";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRoom, requireUser } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { sha256 } from "@/lib/crypto";
import { deleteFile } from "@/lib/storage";
import { DEFAULT_NDA_TITLE, defaultNdaBody } from "@/lib/nda-template";
import type { FormState } from "./auth";

export async function createRoom(_prev: FormState, formData: FormData): Promise<FormState> {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  if (name.length < 2) return { error: "Give the data room a name." };

  const body = defaultNdaBody(name, user.name);
  const room = await prisma.dataRoom.create({
    data: {
      name,
      description,
      ownerId: user.id,
      ndaVersions: { create: { version: 1, title: DEFAULT_NDA_TITLE, body, bodyHash: sha256(body) } },
    },
  });
  const meta = await getRequestMeta();
  await logEvent({ roomId: room.id, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "room.create", targetType: "room", targetId: room.id, targetName: name, ...meta });
  await redirectTo(`/rooms/${room.id}`);
}

export async function updateRoomSettings(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user, room } = await requireRoom(roomId);
  const name = String(formData.get("name") ?? "").trim();
  const description = String(formData.get("description") ?? "").trim();
  const inviteExpiryDays = Math.max(0, Math.min(3650, Number(formData.get("inviteExpiryDays") ?? room.inviteExpiryDays) || 0));
  if (name.length < 2) return { error: "Give the data room a name." };
  const data = {
    name,
    description,
    ndaRequired: formData.get("ndaRequired") === "on",
    allowDownload: formData.get("allowDownload") === "on",
    watermarkEnabled: formData.get("watermarkEnabled") === "on",
    notifyOnNda: formData.get("notifyOnNda") === "on",
    notifyOnFirstView: formData.get("notifyOnFirstView") === "on",
    inviteExpiryDays,
  };
  await prisma.dataRoom.update({ where: { id: roomId }, data });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "room.update", targetType: "room", targetId: roomId, targetName: name, metadata: data, ...meta });
  revalidatePath(`/rooms/${roomId}`, "layout");
  return { success: "Settings saved." };
}

export async function deleteRoom(roomId: string): Promise<void> {
  const { user, room } = await requireRoom(roomId);
  const docs = await prisma.document.findMany({ where: { roomId }, include: { versions: true } });
  await prisma.dataRoom.delete({ where: { id: roomId } });
  for (const d of docs) {
    for (const v of d.versions) await deleteFile(v.storageKey);
  }
  const meta = await getRequestMeta();
  await logEvent({ actorType: "owner", actorId: user.id, actorEmail: user.email, action: "room.delete", targetType: "room", targetId: roomId, targetName: room.name, ...meta });
  await redirectTo("/dashboard");
}
