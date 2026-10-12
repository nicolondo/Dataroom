// Module-worker entry for pdf.js: installs the Map "upsert" shims that pdf.js
// expects before loading the real worker (copied here by scripts/copy-pdf-worker.mjs).
for (const C of [Map, WeakMap]) {
  if (typeof C.prototype.getOrInsert !== "function") {
    C.prototype.getOrInsert = function (key, value) {
      if (this.has(key)) return this.get(key);
      this.set(key, value);
      return value;
    };
  }
  if (typeof C.prototype.getOrInsertComputed !== "function") {
    C.prototype.getOrInsertComputed = function (key, compute) {
      if (this.has(key)) return this.get(key);
      const value = compute(key);
      this.set(key, value);
      return value;
    };
  }
}
await import("./pdf.worker.min.mjs");
