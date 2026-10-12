"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/db";
import { requireRoom } from "@/lib/auth";
import { logEvent } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request";
import { deleteFile } from "@/lib/storage";
import type { FormState } from "./auth";

export async function createFolder(roomId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireRoom(roomId);
  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "Folder name is required." };
  const last = await prisma.folder.findFirst({ where: { roomId }, orderBy: { sortOrder: "desc" } });
  const folder = await prisma.folder.create({ data: { roomId, name, sortOrder: (last?.sortOrder ?? 0) + 1 } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "folder.create", targetType: "folder", targetId: folder.id, targetName: name, ...meta });
  revalidatePath(`/rooms/${roomId}`);
  return { success: "Folder created." };
}

export async function deleteFolder(roomId: string, folderId: string): Promise<void> {
  const { user } = await requireRoom(roomId);
  const folder = await prisma.folder.findFirst({ where: { id: folderId, roomId } });
  if (!folder) return;
  // Documents fall back to the root (folderId -> null) via onDelete: SetNull.
  await prisma.folder.delete({ where: { id: folderId } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "folder.delete", targetType: "folder", targetId: folderId, targetName: folder.name, ...meta });
  revalidatePath(`/rooms/${roomId}`);
}

export async function updateDocument(roomId: string, documentId: string, _prev: FormState, formData: FormData): Promise<FormState> {
  const { user } = await requireRoom(roomId);
  const doc = await prisma.document.findFirst({ where: { id: documentId, roomId } });
  if (!doc) return { error: "Document not found." };
  const title = String(formData.get("title") ?? "").trim();
  if (!title) return { error: "Title is required." };
  const folderIdRaw = String(formData.get("folderId") ?? "");
  const folderId = folderIdRaw ? folderIdRaw : null;
  if (folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, roomId } });
    if (!folder) return { error: "Folder not found." };
  }
  const downloadRaw = String(formData.get("allowDownload") ?? "inherit");
  const allowDownload = downloadRaw === "inherit" ? null : downloadRaw === "yes";
  const data = {
    title,
    description: String(formData.get("description") ?? "").trim(),
    folderId,
    published: formData.get("published") === "on",
    allowDownload,
  };
  await prisma.document.update({ where: { id: documentId }, data });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "document.update", targetType: "document", targetId: documentId, targetName: title, metadata: data, ...meta });
  revalidatePath(`/rooms/${roomId}`, "layout");
  return { success: "Saved." };
}

export async function deleteDocument(roomId: string, documentId: string): Promise<void> {
  const { user } = await requireRoom(roomId);
  const doc = await prisma.document.findFirst({ where: { id: documentId, roomId }, include: { versions: true } });
  if (!doc) return;
  await prisma.document.delete({ where: { id: documentId } });
  for (const v of doc.versions) await deleteFile(v.storageKey);
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "document.delete", targetType: "document", targetId: documentId, targetName: doc.title, ...meta });
  revalidatePath(`/rooms/${roomId}`, "layout");
}

export async function togglePublished(roomId: string, documentId: string): Promise<void> {
  const { user } = await requireRoom(roomId);
  const doc = await prisma.document.findFirst({ where: { id: documentId, roomId } });
  if (!doc) return;
  await prisma.document.update({ where: { id: documentId }, data: { published: !doc.published } });
  const meta = await getRequestMeta();
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "document.update", targetType: "document", targetId: documentId, targetName: doc.title, metadata: { published: !doc.published }, ...meta });
  revalidatePath(`/rooms/${roomId}`, "layout");
}
