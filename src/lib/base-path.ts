/**
 * Prefix for URLs that are not handled by next/link or next/navigation
 * (fetch calls, plain anchors, worker scripts). Mirrors `basePath` in
 * next.config.ts; empty when the app is served from the domain root.
 */
export const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function withBase(path: string): string {
  return `${BASE_PATH}${path}`;
}
