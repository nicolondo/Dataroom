"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { UploadCloud } from "lucide-react";
import { Alert, Button, Select, cx } from "@/components/ui";

type Progress = { name: string; pct: number; error?: string; done?: boolean };

export function UploadDropzone({
  roomId,
  folders,
  documentId,
  compact,
}: {
  roomId: string;
  folders?: Array<{ id: string; name: string }>;
  /** When set, uploads create a new version of this document instead of a new one. */
  documentId?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [folderId, setFolderId] = useState("");
  const [dragging, setDragging] = useState(false);
  const [items, setItems] = useState<Progress[]>([]);

  function upload(file: File): Promise<void> {
    return new Promise((resolve) => {
      const fd = new FormData();
      fd.append("file", file);
      if (folderId) fd.append("folderId", folderId);
      if (documentId) fd.append("documentId", documentId);
      const xhr = new XMLHttpRequest();
      xhr.open("POST", `/api/rooms/${roomId}/upload`);
      xhr.upload.onprogress = (e) => {
        if (e.lengthComputable) setItems((prev) => prev.map((p) => (p.name === file.name ? { ...p, pct: Math.round((e.loaded / e.total) * 100) } : p)));
      };
      xhr.onload = () => {
        let error: string | undefined;
        if (xhr.status >= 400) {
          try {
            error = JSON.parse(xhr.responseText).error ?? `Upload failed (${xhr.status})`;
          } catch {
            error = `Upload failed (${xhr.status})`;
          }
        }
        setItems((prev) => prev.map((p) => (p.name === file.name ? { ...p, pct: 100, done: !error, error } : p)));
        resolve();
      };
      xhr.onerror = () => {
        setItems((prev) => prev.map((p) => (p.name === file.name ? { ...p, error: "Network error" } : p)));
        resolve();
      };
      xhr.send(fd);
    });
  }

  async function handleFiles(list: FileList | null) {
    if (!list || list.length === 0) return;
    const files = Array.from(list);
    setItems(files.map((f) => ({ name: f.name, pct: 0 })));
    for (const f of files) await upload(f);
    router.refresh();
    setTimeout(() => setItems((prev) => prev.filter((p) => p.error)), 1500);
  }

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void handleFiles(e.dataTransfer.files);
        }}
        onClick={() => inputRef.current?.click()}
        className={cx(
          "flex cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed text-center transition-colors",
          compact ? "px-4 py-5" : "px-6 py-10",
          dragging ? "border-accent bg-blue-50" : "border-border bg-white hover:border-slate-400",
        )}
      >
        <UploadCloud className="mb-2 h-6 w-6 text-muted" />
        <p className="text-sm font-medium">{documentId ? "Drop a new version here" : "Drop files here, or click to browse"}</p>
        <p className="mt-1 text-xs text-muted">PDFs get the in-browser viewer with page-level tracking. Images, Office files and other types are also accepted.</p>
        <input ref={inputRef} type="file" multiple={!documentId} className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
      </div>
      {folders && folders.length > 0 && (
        <div className="mt-3 flex items-center gap-2 text-sm">
          <span className="text-muted">Upload into</span>
          <Select value={folderId} onChange={(e) => setFolderId(e.target.value)} className="w-auto">
            <option value="">Root</option>
            {folders.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name}
              </option>
            ))}
          </Select>
        </div>
      )}
      {items.length > 0 && (
        <ul className="mt-3 space-y-2">
          {items.map((it) => (
            <li key={it.name} className="text-xs">
              <div className="flex justify-between">
                <span className="truncate">{it.name}</span>
                <span className="text-muted">{it.error ? "Failed" : it.done ? "Done" : `${it.pct}%`}</span>
              </div>
              <div className="mt-1 h-1.5 overflow-hidden rounded bg-slate-100">
                <div className={cx("h-full transition-all", it.error ? "bg-red-500" : "bg-accent")} style={{ width: `${it.pct}%` }} />
              </div>
              {it.error && (
                <div className="mt-1">
                  <Alert variant="error">{it.error}</Alert>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
      {!compact && (
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => inputRef.current?.click()}>
            Choose files
          </Button>
        </div>
      )}
    </div>
  );
}
