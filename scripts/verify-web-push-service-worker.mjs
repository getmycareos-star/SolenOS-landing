import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
assert.doesNotMatch(source, /addEventListener\(["']push["']/);
assert.doesNotMatch(source, /addEventListener\(["']notificationclick["']/);
assert.doesNotMatch(source, /showNotification|pushManager|Notification\.requestPermission/);

const listeners = new Map();
const deletedCaches = [];
let unregistered = false;
let skippedWaiting = false;
const self = {
  skipWaiting: async () => { skippedWaiting = true; },
  registration: {
    unregister: async () => { unregistered = true; return true; },
  },
  addEventListener: (name, callback) => listeners.set(name, callback),
};
const caches = {
  keys: async () => ["solenos-legacy-push-cache"],
  delete: async (name) => { deletedCaches.push(name); return true; },
};
vm.runInNewContext(source, { self, caches, Promise });

assert.equal(typeof listeners.get("install"), "function");
assert.equal(typeof listeners.get("activate"), "function");
assert.equal(listeners.has("push"), false);
assert.equal(listeners.has("notificationclick"), false);

let installWork;
listeners.get("install")({ waitUntil: (promise) => { installWork = promise; } });
await installWork;
assert.equal(skippedWaiting, true);

let activateWork;
listeners.get("activate")({ waitUntil: (promise) => { activateWork = promise; } });
await activateWork;
assert.equal(unregistered, true);
assert.deepEqual(deletedCaches, ["solenos-legacy-push-cache"]);

console.log("Legacy browser-push worker unregisters itself; no push or browser-notification events are handled.");
