"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy } from "pdfjs-dist";
import { ZoomIn, ZoomOut, Loader2 } from "lucide-react";
import { Button, cx } from "@/components/ui";
import { installMapPolyfills } from "./map-polyfill";

type Props = {
  src: string;
  onPageChange: (page: number) => void;
  onLoaded?: (pageCount: number) => void;
};

/**
 * Renders every page of a PDF to canvases (lazily, as they scroll into view)
 * and reports which page occupies most of the viewport.
 */
export function PdfViewer({ src, onPageChange, onLoaded }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [pdf, setPdf] = useState<PDFDocumentProxy | null>(null);
  const [pageCount, setPageCount] = useState(0);
  const [scale, setScale] = useState(1);
  const [current, setCurrent] = useState(1);
  const [error, setError] = useState<string | null>(null);
  const [aspect, setAspect] = useState(1.3);
  const [containerWidth, setContainerWidth] = useState(800);
  const renderedRef = useRef<Map<number, number>>(new Map()); // page -> scale rendered
  const visibleRef = useRef<Map<number, number>>(new Map());

  useEffect(() => {
    let cancelled = false;
    let task: { destroy(): Promise<void> } | null = null;
    const rendered = renderedRef.current;
    (async () => {
      try {
        installMapPolyfills();
        const pdfjs = await import("pdfjs-dist");
        pdfjs.GlobalWorkerOptions.workerSrc = "/pdf-worker-shim.mjs";
        const res = await fetch(src, { credentials: "same-origin" });
        if (!res.ok) throw new Error(res.status === 401 ? "Your session has ended." : `Could not load document (${res.status}).`);
        const data = await res.arrayBuffer();
        const loadingTask = pdfjs.getDocument({ data });
        task = loadingTask;
        const doc = await loadingTask.promise;
        if (cancelled) return;
        const first = await doc.getPage(1);
        const vp = first.getViewport({ scale: 1 });
        setAspect(vp.height / vp.width);
        setPdf(doc);
        setPageCount(doc.numPages);
        onLoaded?.(doc.numPages);
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Could not load document.");
      }
    })();
    return () => {
      cancelled = true;
      rendered.clear();
      void task?.destroy();
    };
  }, [src, onLoaded]);

  // Keep the page width in sync with the container (resize-aware).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const update = () => setContainerWidth(el.clientWidth || 800);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const pageWidth = Math.min(containerWidth, 1000) * scale;

  const renderPage = useCallback(
    async (pageNumber: number, canvas: HTMLCanvasElement) => {
      if (!pdf) return;
      if (renderedRef.current.get(pageNumber) === scale) return;
      renderedRef.current.set(pageNumber, scale);
      const page = await pdf.getPage(pageNumber);
      const base = page.getViewport({ scale: 1 });
      const viewport = page.getViewport({ scale: pageWidth / base.width });
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(viewport.width * dpr);
      canvas.height = Math.floor(viewport.height * dpr);
      canvas.style.width = `${Math.floor(viewport.width)}px`;
      canvas.style.height = `${Math.floor(viewport.height)}px`;
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      await page.render({ canvasContext: ctx, viewport, canvas }).promise;
    },
    [pdf, scale, pageWidth],
  );

  // Re-render visible pages when zoom changes.
  useEffect(() => {
    renderedRef.current.clear();
    const container = containerRef.current;
    if (!container) return;
    container.querySelectorAll<HTMLCanvasElement>("canvas[data-page]").forEach((canvas) => {
      const p = Number(canvas.dataset.page);
      if (visibleRef.current.has(p)) void renderPage(p, canvas);
    });
  }, [scale, renderPage]);

  // Lazy rendering + current-page detection.
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !pdf) return;
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          const canvas = entry.target as HTMLCanvasElement;
          const p = Number(canvas.dataset.page);
          if (entry.isIntersecting) {
            visibleRef.current.set(p, entry.intersectionRatio);
            void renderPage(p, canvas);
          } else {
            visibleRef.current.delete(p);
          }
        }
        let best = current;
        let bestRatio = -1;
        visibleRef.current.forEach((ratio, p) => {
          if (ratio > bestRatio) {
            bestRatio = ratio;
            best = p;
          }
        });
        if (bestRatio >= 0 && best !== current) {
          setCurrent(best);
          onPageChange(best);
        }
      },
      { root: null, rootMargin: "600px 0px", threshold: [0, 0.1, 0.25, 0.5, 0.75, 1] },
    );
    container.querySelectorAll("canvas[data-page]").forEach((c) => observer.observe(c));
    return () => observer.disconnect();
  }, [pdf, renderPage, current, onPageChange]);

  if (error) return <div className="rounded-md border border-red-200 bg-red-50 p-4 text-sm text-red-800">{error}</div>;

  return (
    <div>
      <div className="no-print sticky top-14 z-10 mb-3 flex items-center justify-between rounded-md border border-border bg-white/95 px-3 py-1.5 text-sm shadow-xs backdrop-blur">
        <span className="tabular-nums text-muted">
          {pageCount ? (
            <>
              Page <span className="font-medium text-foreground">{current}</span> of {pageCount}
            </>
          ) : (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading…
            </span>
          )}
        </span>
        <div className="flex items-center gap-1">
          <Button type="button" variant="ghost" size="sm" onClick={() => setScale((s) => Math.max(0.5, +(s - 0.25).toFixed(2)))} aria-label="Zoom out">
            <ZoomOut className="h-4 w-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted">{Math.round(scale * 100)}%</span>
          <Button type="button" variant="ghost" size="sm" onClick={() => setScale((s) => Math.min(3, +(s + 0.25).toFixed(2)))} aria-label="Zoom in">
            <ZoomIn className="h-4 w-4" />
          </Button>
        </div>
      </div>
      <div ref={containerRef} className={cx("flex flex-col items-center gap-4", scale > 1 && "overflow-x-auto")}>
        {Array.from({ length: pageCount }, (_, i) => i + 1).map((p) => (
          <canvas
            key={p}
            data-page={p}
            className="bg-white shadow-md"
            style={{ width: `${pageWidth}px`, aspectRatio: `1 / ${aspect}` }}
          />
        ))}
      </div>
    </div>
  );
}
