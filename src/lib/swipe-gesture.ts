/**
 * Pure swipe resolution for the phone product list.
 * Decides whether a gesture opens/closes a row action or should be
 * treated as (or ignored because of) vertical scrolling.
 */

export type SwipeResult = "open" | "close" | "none" | "vertical";

export interface SwipeInput {
  deltaX: number;
  deltaY: number;
  /** Whether the row was already showing its action when the gesture began. */
  startOpen?: boolean;
  /** Horizontal distance required to open a closed row. */
  openThreshold?: number;
  /** Horizontal distance required to close an open row (swipe right). */
  closeThreshold?: number;
  /** Vertical distance after which a gesture is considered a scroll. */
  verticalThreshold?: number;
}

export const DEFAULT_OPEN_THRESHOLD = 48;
export const DEFAULT_CLOSE_THRESHOLD = 48;
export const DEFAULT_VERTICAL_THRESHOLD = 24;

/**
 * Resolves a swipe gesture from its total displacement.
 * A predominantly vertical gesture never opens the action.
 */
export function resolveSwipe({
  deltaX,
  deltaY,
  startOpen = false,
  openThreshold = DEFAULT_OPEN_THRESHOLD,
  closeThreshold = DEFAULT_CLOSE_THRESHOLD,
  verticalThreshold = DEFAULT_VERTICAL_THRESHOLD,
}: SwipeInput): SwipeResult {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  const predominantlyVertical = absY >= verticalThreshold && absY > absX;

  if (startOpen) {
    if (predominantlyVertical) return "vertical";
    if (deltaX >= closeThreshold) return "close";
    return "none";
  }

  if (predominantlyVertical) return "vertical";
  if (deltaX <= -openThreshold) return "open";
  return "none";
}

export interface StartDragInput {
  deltaX: number;
  deltaY: number;
  /** Horizontal distance required before a gesture becomes a drag. */
  dragThreshold?: number;
}

export const DEFAULT_DRAG_THRESHOLD = 8;

/**
 * Decides whether a pointer movement should start (and capture) a horizontal
 * drag. Requiring a horizontal majority keeps vertical list scrolling intact
 * and, crucially, avoids capturing the pointer for plain taps on inner buttons.
 */
export function shouldStartDrag({
  deltaX,
  deltaY,
  dragThreshold = DEFAULT_DRAG_THRESHOLD,
}: StartDragInput): boolean {
  const absX = Math.abs(deltaX);
  const absY = Math.abs(deltaY);
  return absX > dragThreshold && absX > absY;
}
