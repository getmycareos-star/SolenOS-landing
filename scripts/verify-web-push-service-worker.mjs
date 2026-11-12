import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";

const source = readFileSync(new URL("../public/sw.js", import.meta.url), "utf8");
const listeners = new Map();
const shown = [];
const opened = [];
const self = {
  location: { origin: "https://solenosai.netlify.app" },
  registration: { showNotification: async (title, options) => shown.push({ title, options }) },
  clients: { matchAll: async () => [], openWindow: async (url) => opened.push(url) },
  addEventListener: (name, callback) => listeners.set(name, callback),
};
vm.runInNewContext(source, { self, URL, Promise });

assert.equal(typeof listeners.get("push"), "function");
assert.equal(typeof listeners.get("notificationclick"), "function");

let pushWork;
listeners.get("push")({
  data: { json: () => ({
    title: "Private care title",
    body: "Private care details",
    url: "https://attacker.invalid/phishing",
    notification_id: "safe-id",
  }) },
  waitUntil: (promise) => { pushWork = promise; },
});
await pushWork;
assert.equal(shown[0].title, "SolenOS");
assert.equal(shown[0].options.body, "You have a care update. Open SolenOS to review it.");
assert.equal(shown[0].options.data.path, "/workspace");
assert.equal(shown[0].options.tag, "solenos-safe-id");
assert.ok(!JSON.stringify(shown[0]).includes("Private care details"));

let clickWork;
let closed = false;
listeners.get("notificationclick")({
  notification: {
    data: { path: "https://attacker.invalid/phishing" },
    close: () => { closed = true; },
  },
  waitUntil: (promise) => { clickWork = promise; },
});
await clickWork;
assert.equal(closed, true);
assert.deepEqual(opened, ["https://solenosai.netlify.app/workspace"]);

console.log("Web Push service worker privacy and navigation checks passed.");
