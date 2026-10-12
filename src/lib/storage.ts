import { promises as fs, createReadStream } from "node:fs";
import path from "node:path";
import { randomToken } from "./crypto";

function storageRoot(): string {
  const configured = process.env.STORAGE_DIR || "./storage";
  return path.isAbsolute(configured) ? configured : path.join(/*turbopackIgnore: true*/ process.cwd(), configured);
}

function safeExt(fileName: string): string {
  const ext = path.extname(fileName).toLowerCase().replace(/[^a-z0-9.]/g, "");
  return ext.length <= 10 ? ext : "";
}

/** Persist bytes under storage/<roomId>/<random>.<ext>. Returns the storage key. */
export async function saveFile(roomId: string, fileName: string, data: Uint8Array): Promise<string> {
  const key = path.posix.join(roomId, `${randomToken(16)}${safeExt(fileName)}`);
  const full = path.join(storageRoot(), key);
  await fs.mkdir(path.dirname(full), { recursive: true });
  await fs.writeFile(full, data);
  return key;
}

export function resolveKey(key: string): string {
  const root = storageRoot();
  const full = path.join(root, key);
  if (!full.startsWith(root + path.sep)) throw new Error("Invalid storage key");
  return full;
}

export async function readFile(key: string): Promise<Buffer> {
  return fs.readFile(resolveKey(key));
}

export function fileStream(key: string) {
  return createReadStream(resolveKey(key));
}

export async function deleteFile(key: string): Promise<void> {
  try {
    await fs.unlink(resolveKey(key));
  } catch (err) {
    if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
  }
}

export function maxUploadBytes(): number {
  const mb = Number(process.env.MAX_UPLOAD_MB || 100);
  return (Number.isFinite(mb) && mb > 0 ? mb : 100) * 1024 * 1024;
}
