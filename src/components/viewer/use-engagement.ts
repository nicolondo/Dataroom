"use client";

import { useEffect, useRef } from "react";

const TICK_MS = 1000;
const FLUSH_EVERY_S = 5;
const IDLE_AFTER_MS = 60_000;

/**
 * Measures *active* reading time: the tab must be visible, the window focused,
 * and the reader must have moved/scrolled/typed in the last minute. Seconds are
 * attributed to the page currently in view and flushed to the server every few
 * seconds; the final flush uses sendBeacon so it survives tab close.
 */
export function useEngagementTracker({ documentId, enabled, getPage }: { documentId: string; enabled: boolean; getPage: () => number }) {
  const sessionIdRef = useRef<string | null>(null);
  const bucketsRef = useRef<Map<number, number>>(new Map());
  const pendingRef = useRef(0);
  const lastActivityRef = useRef(0);
  const maxPageRef = useRef(1);
  const endedRef = useRef(false);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    endedRef.current = false;
    lastActivityRef.current = Date.now();

    const markActive = () => {
      lastActivityRef.current = Date.now();
    };
    const activityEvents = ["mousemove", "mousedown", "keydown", "scroll", "wheel", "touchstart", "pointermove"] as const;
    activityEvents.forEach((ev) => window.addEventListener(ev, markActive, { passive: true }));

    const flush = (final: boolean) => {
      const sessionId = sessionIdRef.current;
      if (!sessionId) return;
      const pages: Record<string, number> = {};
      bucketsRef.current.forEach((s, p) => {
        if (s > 0) pages[String(p)] = s;
      });
      bucketsRef.current.clear();
      pendingRef.current = 0;
      const hasData = Object.keys(pages).length > 0;
      if (!hasData && !final) return;
      if (final && endedRef.current) return;
      if (final) endedRef.current = true;
      const body = JSON.stringify({ op: final ? "end" : "heartbeat", sessionId, pages, maxPage: maxPageRef.current });
      if (final && typeof navigator.sendBeacon === "function") {
        navigator.sendBeacon("/api/view", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/view", { method: "POST", headers: { "Content-Type": "application/json" }, body, keepalive: true, credentials: "same-origin" });
      }
    };

    void fetch("/api/view", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ op: "start", documentId }), credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { sessionId?: string } | null) => {
        if (!cancelled && data?.sessionId) sessionIdRef.current = data.sessionId;
      })
      .catch(() => {});

    const timer = window.setInterval(() => {
      const visible = document.visibilityState === "visible";
      const focused = document.hasFocus();
      const active = Date.now() - lastActivityRef.current < IDLE_AFTER_MS;
      if (!visible || !focused || !active) return;
      const page = Math.max(1, getPage());
      maxPageRef.current = Math.max(maxPageRef.current, page);
      bucketsRef.current.set(page, (bucketsRef.current.get(page) ?? 0) + 1);
      pendingRef.current += 1;
      if (pendingRef.current >= FLUSH_EVERY_S) flush(false);
    }, TICK_MS);

    const onVisibility = () => {
      if (document.visibilityState === "hidden") flush(false);
    };
    const onPageHide = () => flush(true);
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("pagehide", onPageHide);

    return () => {
      cancelled = true;
      window.clearInterval(timer);
      activityEvents.forEach((ev) => window.removeEventListener(ev, markActive));
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("pagehide", onPageHide);
      flush(true);
    };
  }, [documentId, enabled, getPage]);
}
