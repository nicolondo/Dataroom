"use client";

import { useCallback, useRef, useState } from "react";
import Link from "next/link";
import { Download, MessageSquare, FileWarning, ChevronLeft } from "lucide-react";
import { PdfViewer } from "./pdf-viewer";
import { Watermark } from "./watermark";
import { useEngagementTracker } from "./use-engagement";
import { LinkButton } from "@/components/ui";

type Props = {
  roomId: string;
  documentId: string;
  title: string;
  description: string;
  mimeType: string;
  fileName: string;
  version: number;
  pageCount: number | null;
  watermarkText: string | null;
  canDownload: boolean;
  tracking: boolean;
  askHref: string;
};

export function DocumentViewer(props: Props) {
  const pageRef = useRef(1);
  const [, setTick] = useState(0);
  const getPage = useCallback(() => pageRef.current, []);
  const onPageChange = useCallback((p: number) => {
    pageRef.current = p;
    setTick((t) => t + 1);
  }, []);
  useEngagementTracker({ documentId: props.documentId, enabled: props.tracking, getPage });

  const fileUrl = `/api/files/${props.documentId}`;
  const isPdf = props.mimeType === "application/pdf";
  const isImage = props.mimeType.startsWith("image/");
  const isText = props.mimeType.startsWith("text/");

  return (
    <div onContextMenu={(e) => e.preventDefault()} className="select-none">
      <div className="no-print mb-4 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link href={`/r/${props.roomId}`} className="mb-1 inline-flex items-center gap-1 text-xs text-muted hover:text-foreground">
            <ChevronLeft className="h-3.5 w-3.5" /> All documents
          </Link>
          <h1 className="truncate text-xl font-semibold">{props.title}</h1>
          <p className="text-xs text-muted">
            {props.fileName} · v{props.version}
            {props.pageCount ? ` · ${props.pageCount} pages` : ""}
            {props.description ? ` — ${props.description}` : ""}
          </p>
        </div>
        <div className="flex shrink-0 gap-2">
          <LinkButton variant="secondary" size="sm" href={props.askHref}>
            <MessageSquare className="h-3.5 w-3.5" /> Ask a question
          </LinkButton>
          {props.canDownload && (
            <a href={`${fileUrl}?download=1`} className="inline-flex h-8 items-center gap-2 rounded-md bg-accent px-3 text-xs font-medium text-white hover:bg-blue-800">
              <Download className="h-3.5 w-3.5" /> Download
            </a>
          )}
        </div>
      </div>

      <div className="relative min-h-96 rounded-lg bg-slate-200/60 p-3 sm:p-6">
        {props.watermarkText && <Watermark text={props.watermarkText} />}
        {isPdf ? (
          <PdfViewer src={fileUrl} onPageChange={onPageChange} />
        ) : isImage ? (
          <div className="flex justify-center">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={fileUrl} alt={props.title} className="max-h-[80vh] max-w-full rounded bg-white shadow-md" draggable={false} />
          </div>
        ) : isText ? (
          <iframe src={fileUrl} title={props.title} className="h-[80vh] w-full rounded bg-white shadow-md" sandbox="" />
        ) : (
          <div className="flex flex-col items-center justify-center gap-2 py-20 text-center">
            <FileWarning className="h-8 w-8 text-muted" />
            <p className="font-medium">No in-browser preview for this file type.</p>
            <p className="max-w-md text-sm text-muted">
              {props.canDownload ? "Use the download button above to open it on your computer." : "Downloads are disabled for this document. Ask the room owner to provide a PDF version."}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
