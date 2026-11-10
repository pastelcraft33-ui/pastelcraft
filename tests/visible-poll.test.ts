import assert from "node:assert/strict";
import test from "node:test";

import { startVisiblePoll } from "@/lib/browser/visible-poll";

function harness() {
  let time = 0;
  let id = 0;
  const timers = new Map<number, () => void>();
  const win = Object.assign(new EventTarget(), {
    navigator: { onLine: true },
    setTimeout: (fn: () => void) => { timers.set(++id, fn); return id; },
    setInterval: (fn: () => void) => { timers.set(++id, fn); return id; },
    clearTimeout: (key: number) => { timers.delete(key); },
    clearInterval: (key: number) => { timers.delete(key); },
  });
  const doc = Object.assign(new EventTarget(), { visibilityState: "visible" });
  return {
    win, doc, timers,
    environment: {
      window: win as unknown as Window & typeof globalThis,
      document: doc as unknown as Document,
      now: () => time,
    },
    tick: async (ms = 30_000) => {
      time += ms;
      [...timers.values()].forEach(fn => fn());
      await Promise.resolve();
    },
  };
}

test("polls visible tabs, stops hidden/offline requests, resumes on return", async () => {
  const h = harness();
  let calls = 0;
  const stop = startVisiblePoll(() => { calls++; }, { intervalMs: 30_000 }, h.environment);
  await h.tick();
  assert.equal(calls, 1);
  h.doc.visibilityState = "hidden";
  await h.tick();
  assert.equal(calls, 1);
  h.doc.visibilityState = "visible";
  h.win.navigator.onLine = false;
  await h.tick();
  assert.equal(calls, 1);
  h.win.navigator.onLine = true;
  h.win.dispatchEvent(new Event("online"));
  await Promise.resolve();
  assert.equal(calls, 2);
  stop();
  await h.tick();
  h.win.dispatchEvent(new Event("focus"));
  assert.equal(calls, 2);
  assert.equal(h.timers.size, 0);
});

test("focus and visibility events produce only one request", async () => {
  const h = harness();
  let calls = 0;
  const stop = startVisiblePoll(() => { calls++; }, { intervalMs: 30_000, initial: false }, h.environment);
  h.win.dispatchEvent(new Event("focus"));
  await Promise.resolve();
  h.doc.dispatchEvent(new Event("visibilitychange"));
  assert.equal(calls, 1);
  stop();
});

test("realtime/mutation events bypass the focus cooldown", async () => {
  const h = harness();
  let calls = 0;
  const stop = startVisiblePoll(() => { calls++; }, {
    intervalMs: 60_000, events: ["workspace-content-created"],
  }, h.environment);
  await h.tick();
  h.win.dispatchEvent(new Event("workspace-content-created"));
  await Promise.resolve();
  assert.equal(calls, 2);
  stop();
});
test("slow requests never overlap and a mutation during a request gets a trailing refresh", async () => {
  const h = harness();
  let calls = 0;
  let finish: () => void = () => {};
  const stop = startVisiblePoll(() => {
    calls++;
    return new Promise<void>(resolve => { finish = resolve; });
  }, { intervalMs: 30_000, events: ["changed"] }, h.environment);
  await h.tick();
  await h.tick();
  assert.equal(calls, 1);
  h.win.dispatchEvent(new Event("changed"));
  h.win.dispatchEvent(new Event("changed"));
  assert.equal(calls, 1);
  finish();
  await Promise.resolve();
  assert.equal(calls, 2);
  stop();
  finish();
  await Promise.resolve();
  assert.equal(calls, 2);
});

test("a failed request does not stop subsequent polling", async () => {
  const h = harness();
  let calls = 0;
  const stop = startVisiblePoll(async () => {
    calls++;
    throw new Error("offline");
  }, { intervalMs: 30_000 }, h.environment);
  await h.tick();
  await h.tick();
  assert.equal(calls, 2);
  stop();
});

test("quick hidden-tab return refreshes even during the focus cooldown", async () => {
  const h = harness();
  let calls = 0;
  const stop = startVisiblePoll(() => { calls++; }, { intervalMs: 30_000 }, h.environment);
  await h.tick();
  h.doc.visibilityState = "hidden";
  h.doc.dispatchEvent(new Event("visibilitychange"));
  h.doc.visibilityState = "visible";
  h.doc.dispatchEvent(new Event("visibilitychange"));
  await Promise.resolve();
  h.win.dispatchEvent(new Event("focus"));
  assert.equal(calls, 2);
  stop();
});
