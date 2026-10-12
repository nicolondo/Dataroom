// Copies the pdf.js worker that matches the installed pdfjs-dist version into
// /public so the in-browser viewer can load it from a same-origin URL.
import { copyFileSync, mkdirSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

const require = createRequire(import.meta.url);
const pkgDir = path.dirname(require.resolve("pdfjs-dist/package.json"));
const src = path.join(pkgDir, "build", "pdf.worker.min.mjs");
const dest = path.join(process.cwd(), "public", "pdf.worker.min.mjs");
if (!existsSync(src)) {
  console.error("pdfjs-dist worker not found at", src);
  process.exit(1);
}
mkdirSync(path.dirname(dest), { recursive: true });
copyFileSync(src, dest);
console.log("Copied pdf.js worker to public/pdf.worker.min.mjs");
