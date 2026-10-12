/**
 * pdf.js relies on the ES2026 "upsert" Map methods. Browsers that have not
 * shipped them yet get these minimal, spec-compatible shims.
 */
export function installMapPolyfills(): void {
  for (const C of [Map, WeakMap] as const) {
    const proto = C.prototype as unknown as Record<string, unknown>;
    if (typeof proto.getOrInsert !== "function") {
      Object.defineProperty(proto, "getOrInsert", {
        configurable: true,
        writable: true,
        value: function (this: Map<unknown, unknown>, key: unknown, value: unknown) {
          if (this.has(key)) return this.get(key);
          this.set(key, value);
          return value;
        },
      });
    }
    if (typeof proto.getOrInsertComputed !== "function") {
      Object.defineProperty(proto, "getOrInsertComputed", {
        configurable: true,
        writable: true,
        value: function (this: Map<unknown, unknown>, key: unknown, compute: (k: unknown) => unknown) {
          if (this.has(key)) return this.get(key);
          const value = compute(key);
          this.set(key, value);
          return value;
        },
      });
    }
  }
}
