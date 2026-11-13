import { useEffect, useState } from "react";

/** Tailwind's `md` breakpoint — the point where the desktop layout replaces the phone one. */
export const DESKTOP_QUERY = "(min-width: 768px)";

/**
 * Reports whether the viewport is at least as wide as Tailwind's `md` breakpoint.
 * Starts as `false` so the server and the first client render agree on the phone-first
 * markup; components that hide a desktop-only gap with `md:hidden` never flash it.
 */
export function useIsDesktop(query: string = DESKTOP_QUERY): boolean {
  const [isDesktop, setIsDesktop] = useState(false);
  useEffect(() => {
    const media = window.matchMedia(query);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener("change", sync);
    return () => media.removeEventListener("change", sync);
  }, [query]);
  return isDesktop;
}
