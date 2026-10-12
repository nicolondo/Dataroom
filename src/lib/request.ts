import { headers } from "next/headers";

/** Best-effort client IP + user agent for audit records. */
export async function getRequestMeta(): Promise<{ ip: string; userAgent: string }> {
  const h = await headers();
  const fwd = h.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : h.get("x-real-ip")) ?? "";
  return { ip: ip.trim(), userAgent: h.get("user-agent") ?? "" };
}

export function requestMetaFrom(req: Request): { ip: string; userAgent: string } {
  const fwd = req.headers.get("x-forwarded-for");
  const ip = (fwd ? fwd.split(",")[0] : req.headers.get("x-real-ip")) ?? "";
  return { ip: ip.trim(), userAgent: req.headers.get("user-agent") ?? "" };
}
