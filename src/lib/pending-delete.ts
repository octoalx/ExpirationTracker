/**
 * Framework-agnostic scheduler for deferred destructive actions.
 * The UI removes an item immediately; `commit` fires after `delayMs`
 * unless `undo` cancels it first. Timers are injected so tests can
 * control time without relying on the real clock.
 */

export interface PendingDeleteCommitOptions {
  /** True when sending because the page is being hidden/closed. */
  keepalive: boolean;
}

export interface PendingDeletesOptions {
  delayMs: number;
  commit: (id: string, options: PendingDeleteCommitOptions) => void | Promise<void>;
  /** Called whenever an item must be brought back (undo or failed commit). */
  onRestore?: (id: string) => void;
  setTimer?: (callback: () => void, delayMs: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface PendingDeletes {
  /** Schedules a commit for `id`. Scheduling an already pending id restarts its timer. */
  schedule: (id: string) => void;
  /** Cancels a pending commit and restores the item. Returns false if it was not pending. */
  undo: (id: string) => boolean;
  /** Sends every pending commit immediately (used when the page is hidden). */
  flush: () => void;
  /** Number of currently pending commits. */
  size: () => number;
  /** Whether `id` has a scheduled commit. */
  has: (id: string) => boolean;
}

const defaultSetTimer = (callback: () => void, delayMs: number): unknown =>
  setTimeout(callback, delayMs);
const defaultClearTimer = (handle: unknown): void =>
  clearTimeout(handle as ReturnType<typeof setTimeout>);

/**
 * Creates an independent pending-delete queue. Each item owns its own timer,
 * so deleting several products in a row never interferes.
 */
export function createPendingDeletes({
  delayMs,
  commit,
  onRestore,
  setTimer = defaultSetTimer,
  clearTimer = defaultClearTimer,
}: PendingDeletesOptions): PendingDeletes {
  const timers = new Map<string, unknown>();

  const runCommit = (id: string, keepalive: boolean): void => {
    try {
      const result = commit(id, { keepalive });
      if (result && typeof (result as Promise<void>).then === "function") {
        (result as Promise<void>).catch(() => onRestore?.(id));
      }
    } catch {
      onRestore?.(id);
    }
  };

  const schedule = (id: string): void => {
    const existing = timers.get(id);
    if (existing !== undefined) clearTimer(existing);
    const handle = setTimer(() => {
      timers.delete(id);
      runCommit(id, false);
    }, delayMs);
    timers.set(id, handle);
  };

  const undo = (id: string): boolean => {
    if (!timers.has(id)) return false;
    clearTimer(timers.get(id));
    timers.delete(id);
    onRestore?.(id);
    return true;
  };

  const flush = (): void => {
    for (const [id, handle] of timers) {
      clearTimer(handle);
      timers.delete(id);
      runCommit(id, true);
    }
  };

  return { schedule, undo, flush, size: () => timers.size, has: (id) => timers.has(id) };
}
