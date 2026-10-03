/** Optional tactile feedback; visual confirmation remains the primary signal. */
export function interactionFeedback(kind: "scan" | "save") {
  if (typeof window === "undefined" || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate?.(kind === "scan" ? 15 : [12, 35, 12]);
  } catch {
    // Browser support and permissions must never interrupt a product action.
  }
}
