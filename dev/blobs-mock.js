// Dev-only stand-in for @netlify/blobs.
const mem = globalThis.__blobs || (globalThis.__blobs = new Map());
export function getStore(name) {
  return {
    async get(k) { return mem.get(name + ':' + k) ?? null; },
    async setJSON(k, v) { mem.set(name + ':' + k, v); },
  };
}
