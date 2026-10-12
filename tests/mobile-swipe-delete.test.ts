import test from "node:test";
import assert from "node:assert/strict";
import { createPendingDeletes, type PendingDeleteCommitOptions } from "../src/lib/pending-delete";
import { resolveSwipe, shouldStartDrag } from "../src/lib/swipe-gesture";

/** Minimal controllable timer queue used to make deferred deletes deterministic. */
function createFakeTimers() {
  let sequence = 0;
  const callbacks = new Map<number, () => void>();
  const handles: number[] = [];
  return {
    setTimer: (callback: () => void) => {
      const handle = ++sequence;
      callbacks.set(handle, callback);
      handles.push(handle);
      return handle;
    },
    clearTimer: (handle: unknown) => { callbacks.delete(handle as number); },
    fireNext: () => {
      const handle = handles.shift();
      if (handle === undefined) return;
      const callback = callbacks.get(handle);
      callbacks.delete(handle);
      callback?.();
    },
    fire: (handle: number) => {
      const callback = callbacks.get(handle);
      callbacks.delete(handle);
      callback?.();
    },
    size: () => callbacks.size,
  };
}

test("pending delete: undo before the timer cancels the commit and restores the item", () => {
  const timers = createFakeTimers();
  const committed: string[] = [];
  const restored: string[] = [];
  const pending = createPendingDeletes({
    delayMs: 6000,
    commit: (id) => { committed.push(id); },
    onRestore: (id) => { restored.push(id); },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  pending.schedule("a");
  assert.equal(pending.has("a"), true);
  assert.equal(timers.size(), 1);

  assert.equal(pending.undo("a"), true);
  assert.equal(pending.has("a"), false);
  assert.equal(timers.size(), 0);
  assert.deepEqual(committed, []);
  assert.deepEqual(restored, ["a"]);
  assert.equal(pending.undo("a"), false);
});

test("pending delete: firing the timer commits once without keepalive", () => {
  const timers = createFakeTimers();
  const commits: Array<{ id: string; keepalive: boolean }> = [];
  const pending = createPendingDeletes({
    delayMs: 6000,
    commit: (id, options: PendingDeleteCommitOptions) => { commits.push({ id, keepalive: options.keepalive }); },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  pending.schedule("a");
  timers.fireNext();
  assert.deepEqual(commits, [{ id: "a", keepalive: false }]);
  assert.equal(pending.size(), 0);
});

test("pending delete: several items keep independent timers", () => {
  const timers = createFakeTimers();
  const committed: string[] = [];
  const pending = createPendingDeletes({
    delayMs: 6000,
    commit: (id) => { committed.push(id); },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  pending.schedule("a");
  pending.schedule("b");
  assert.equal(pending.size(), 2);

  timers.fireNext();
  assert.deepEqual(committed, ["a"]);
  assert.equal(pending.size(), 1);

  assert.equal(pending.undo("b"), true);
  assert.deepEqual(committed, ["a"]);
  assert.equal(timers.size(), 0);
});

test("pending delete: flush sends every pending item immediately with keepalive", () => {
  const timers = createFakeTimers();
  const commits: Array<{ id: string; keepalive: boolean }> = [];
  const pending = createPendingDeletes({
    delayMs: 6000,
    commit: (id, options: PendingDeleteCommitOptions) => { commits.push({ id, keepalive: options.keepalive }); },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  pending.schedule("a");
  pending.schedule("b");
  pending.flush();

  assert.deepEqual(commits, [
    { id: "a", keepalive: true },
    { id: "b", keepalive: true },
  ]);
  assert.equal(pending.size(), 0);
  assert.equal(timers.size(), 0);
});

test("pending delete: a failed commit restores the item", async () => {
  const timers = createFakeTimers();
  const restored: string[] = [];
  const pending = createPendingDeletes({
    delayMs: 6000,
    commit: () => Promise.reject(new Error("network")),
    onRestore: (id) => { restored.push(id); },
    setTimer: timers.setTimer,
    clearTimer: timers.clearTimer,
  });

  pending.schedule("a");
  timers.fireNext();
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.deepEqual(restored, ["a"]);
});

test("swipe gesture: opens on a left swipe past the threshold only", () => {
  assert.equal(resolveSwipe({ deltaX: -60, deltaY: 4 }), "open");
  assert.equal(resolveSwipe({ deltaX: -20, deltaY: 4 }), "none");
  assert.equal(resolveSwipe({ deltaX: 60, deltaY: 4 }), "none");
});

test("swipe gesture: an open row closes with a right swipe", () => {
  assert.equal(resolveSwipe({ deltaX: 60, deltaY: 2, startOpen: true }), "close");
  assert.equal(resolveSwipe({ deltaX: 10, deltaY: 2, startOpen: true }), "none");
  assert.equal(resolveSwipe({ deltaX: -60, deltaY: 2, startOpen: true }), "none");
});

test("swipe gesture: predominantly vertical movement never opens the action", () => {
  assert.equal(resolveSwipe({ deltaX: -10, deltaY: 80 }), "vertical");
  assert.equal(resolveSwipe({ deltaX: -40, deltaY: 90 }), "vertical");
  assert.equal(resolveSwipe({ deltaX: -5, deltaY: 80, startOpen: true }), "vertical");
  assert.equal(resolveSwipe({ deltaX: -3, deltaY: -70 }), "vertical");
});

test("swipe gesture: custom thresholds are respected", () => {
  assert.equal(resolveSwipe({ deltaX: -30, deltaY: 0, openThreshold: 20 }), "open");
  assert.equal(resolveSwipe({ deltaX: -30, deltaY: 0, openThreshold: 40 }), "none");
  assert.equal(resolveSwipe({ deltaX: 30, deltaY: 0, startOpen: true, closeThreshold: 20 }), "close");
  assert.equal(resolveSwipe({ deltaX: 5, deltaY: 10, verticalThreshold: 5 }), "vertical");
});

test("swipe gesture: shouldStartDrag requires a horizontal majority past the threshold", () => {
  assert.equal(shouldStartDrag({ deltaX: 12, deltaY: 3 }), true);
  assert.equal(shouldStartDrag({ deltaX: -12, deltaY: 3 }), true);
  assert.equal(shouldStartDrag({ deltaX: 8, deltaY: 0 }), false);
  assert.equal(shouldStartDrag({ deltaX: -8, deltaY: 0 }), false);
  assert.equal(shouldStartDrag({ deltaX: 5, deltaY: 20 }), false);
  assert.equal(shouldStartDrag({ deltaX: 12, deltaY: 14 }), false);
  assert.equal(shouldStartDrag({ deltaX: 12, deltaY: 3, dragThreshold: 20 }), false);
  assert.equal(shouldStartDrag({ deltaX: -25, deltaY: 3, dragThreshold: 20 }), true);
});
