import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { BASE_PATH } from "./base-path";

/**
 * redirect() for Server Actions that also works when the form was posted
 * before hydration (no JavaScript). In that case Next answers with a plain
 * 303 whose Location lacks the basePath, so we add it ourselves; for
 * JavaScript-driven actions the client router adds it and we must not.
 */
export async function redirectTo(path: string): Promise<never> {
  const accept = (await headers()).get("accept") ?? "";
  const jsAction = accept.includes("text/x-component");
  redirect(jsAction || !BASE_PATH ? path : `${BASE_PATH}${path}`);
}
