import { useEffect } from "react";

/** Below this height a viewport change is browser chrome (URL bar), not a keyboard. */
const MIN_KEYBOARD_HEIGHT = 120;

/** Name of the CSS variable consumed by the mobile dialog stylesheet. */
export const KEYBOARD_INSET_VAR = "--keyboard-inset";

/**
 * Returns the height in pixels of the on-screen keyboard covering the layout viewport.
 * Pinch-zoom also shrinks the visual viewport, so a zoomed page is never treated as a keyboard.
 */
export function computeKeyboardInset(layoutHeight: number, visualHeight: number, visualOffsetTop: number, scale = 1): number {
  if (scale > 1.01) return 0;
  const covered = Math.round(layoutHeight - visualHeight - visualOffsetTop);
  return covered >= MIN_KEYBOARD_HEIGHT ? covered : 0;
}

/**
 * Keeps the focused field of a full-screen mobile dialog above the on-screen keyboard.
 * Phone browsers overlay the keyboard instead of resizing a `100dvh` panel, so the
 * panel receives bottom padding equal to the keyboard height (`--keyboard-inset`),
 * which lets its last fields scroll into the visible area.
 */
export function useKeyboardInset(): void {
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const root = document.documentElement;
    const focusedField = () => {
      const active = document.activeElement;
      return active instanceof HTMLElement && active.closest(".product-dialog") && active.matches("input, select, textarea") ? active : null;
    };
    const revealFocused = () => {
      const field = focusedField();
      if (field) field.scrollIntoView({ block: "center", behavior: "auto" });
    };
    const update = () => {
      const inset = computeKeyboardInset(window.innerHeight, viewport.height, viewport.offsetTop, viewport.scale);
      root.style.setProperty(KEYBOARD_INSET_VAR, `${inset}px`);
      if (inset > 0) revealFocused();
    };
    // The keyboard animates in after focus; the viewport event may arrive before or without it.
    let timer: ReturnType<typeof setTimeout> | undefined;
    const onFocusIn = () => { clearTimeout(timer); timer = setTimeout(() => { update(); revealFocused(); }, 300); };
    update();
    viewport.addEventListener("resize", update);
    viewport.addEventListener("scroll", update);
    document.addEventListener("focusin", onFocusIn);
    return () => {
      clearTimeout(timer);
      viewport.removeEventListener("resize", update);
      viewport.removeEventListener("scroll", update);
      document.removeEventListener("focusin", onFocusIn);
      root.style.removeProperty(KEYBOARD_INSET_VAR);
    };
  }, []);
}
