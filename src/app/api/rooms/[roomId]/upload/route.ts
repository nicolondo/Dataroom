import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { saveFile, maxUploadBytes } from "@/lib/storage";
import { countPdfPages } from "@/lib/pdf";
import { logEvent } from "@/lib/audit";
import { requestMetaFrom } from "@/lib/request";

const ALLOWED_PREFIXES = ["application/pdf", "image/", "text/", "application/vnd", "application/msword", "application/zip", "application/x-zip", "application/json", "application/octet-stream"];

function sniffMime(file: File): string {
  if (file.type && file.type !== "application/octet-stream") return file.type;
  const ext = file.name.split(".").pop()?.toLowerCase();
  const map: Record<string, string> = {
    pdf: "application/pdf",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    gif: "image/gif",
    webp: "image/webp",
    txt: "text/plain",
    csv: "text/csv",
    md: "text/markdown",
    docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    doc: "application/msword",
    xls: "application/vnd.ms-excel",
    zip: "application/zip",
  };
  return (ext && map[ext]) || "application/octet-stream";
}

/**
 * POST multipart/form-data: file, title?, folderId?, documentId? (upload a new version), note?
 */
export async function POST(req: Request, ctx: { params: Promise<{ roomId: string }> }) {
  const { roomId } = await ctx.params;
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const room = await prisma.dataRoom.findFirst({ where: { id: roomId, ownerId: user.id } });
  if (!room) return NextResponse.json({ error: "Room not found" }, { status: 404 });

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) return NextResponse.json({ error: "No file received" }, { status: 400 });
  if (file.size > maxUploadBytes()) return NextResponse.json({ error: `File exceeds the ${Math.round(maxUploadBytes() / 1024 / 1024)} MB limit` }, { status: 413 });
  const mimeType = sniffMime(file);
  if (!ALLOWED_PREFIXES.some((p) => mimeType.startsWith(p))) return NextResponse.json({ error: "Unsupported file type" }, { status: 415 });

  const bytes = new Uint8Array(await file.arrayBuffer());
  const pageCount = mimeType === "application/pdf" ? await countPdfPages(bytes) : null;
  const storageKey = await saveFile(roomId, file.name, bytes);
  const meta = requestMetaFrom(req);

  const documentId = String(form.get("documentId") ?? "");
  const note = String(form.get("note") ?? "").trim();

  if (documentId) {
    const existing = await prisma.document.findFirst({ where: { id: documentId, roomId } });
    if (!existing) return NextResponse.json({ error: "Document not found" }, { status: 404 });
    const version = existing.version + 1;
    const updated = await prisma.document.update({
      where: { id: documentId },
      data: {
        fileName: file.name,
        mimeType,
        size: file.size,
        storageKey,
        pageCount,
        version,
        versions: { create: { version, fileName: file.name, mimeType, size: file.size, storageKey, pageCount, note } },
      },
    });
    await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "document.version", targetType: "document", targetId: updated.id, targetName: updated.title, metadata: { version, fileName: file.name, size: file.size }, ...meta });
    return NextResponse.json({ ok: true, documentId: updated.id, version });
  }

  const title = String(form.get("title") ?? "").trim() || file.name.replace(/\.[^.]+$/, "");
  const folderIdRaw = String(form.get("folderId") ?? "");
  const folderId = folderIdRaw ? folderIdRaw : null;
  if (folderId) {
    const folder = await prisma.folder.findFirst({ where: { id: folderId, roomId } });
    if (!folder) return NextResponse.json({ error: "Folder not found" }, { status: 400 });
  }
  const last = await prisma.document.findFirst({ where: { roomId }, orderBy: { sortOrder: "desc" } });
  const doc = await prisma.document.create({
    data: {
      roomId,
      folderId,
      title,
      fileName: file.name,
      mimeType,
      size: file.size,
      storageKey,
      pageCount,
      sortOrder: (last?.sortOrder ?? 0) + 1,
      versions: { create: { version: 1, fileName: file.name, mimeType, size: file.size, storageKey, pageCount, note } },
    },
  });
  await logEvent({ roomId, actorType: "owner", actorId: user.id, actorEmail: user.email, action: "document.upload", targetType: "document", targetId: doc.id, targetName: title, metadata: { fileName: file.name, size: file.size, mimeType }, ...meta });
  return NextResponse.json({ ok: true, documentId: doc.id, version: 1 });
}
