export const SETTINGS_CHANGED = "inventory-settings-changed";

/** Notify open inventory tabs without storing account or integration data. */
export function notifySettingsChanged() {
  window.dispatchEvent(new Event(SETTINGS_CHANGED));
  try { localStorage.setItem(SETTINGS_CHANGED, String(Date.now())); } catch { /* Storage may be disabled. */ }
}

/** Keep saved thresholds and the local calendar fresh while inventory is visible. */
export function watchInventorySettings(onUpdate: (settings: { urgentThreshold: number; warningThreshold: number }, now: Date) => void,
  onTick: (now: Date) => void) {
  let stopped = false;
  let revision = 0;
  let controller: AbortController | undefined;
  const refresh = async () => {
    if (document.hidden || stopped) return;
    const version = ++revision;
    controller?.abort();
    controller = new AbortController();
    onTick(new Date());
    try {
      const response = await fetch("/api/settings?scope=thresholds", { cache: "no-store", signal: controller.signal });
      if (!response.ok) return;
      const { settings } = await response.json();
      if (!stopped && version === revision && Number.isInteger(settings?.urgentThreshold) && Number.isInteger(settings?.warningThreshold)) {
        onUpdate({ urgentThreshold: settings.urgentThreshold, warningThreshold: settings.warningThreshold }, new Date());
      }
    } catch { /* Preserve the last saved thresholds on transient network failures. */ }
  };
  const storage = (event: StorageEvent) => { if (event.key === SETTINGS_CHANGED) void refresh(); };
  window.addEventListener("focus", refresh);
  window.addEventListener(SETTINGS_CHANGED, refresh);
  window.addEventListener("storage", storage);
  document.addEventListener("visibilitychange", refresh);
  const interval = window.setInterval(refresh, 30_000);
  void refresh();
  return () => {
    stopped = true; controller?.abort(); window.clearInterval(interval);
    window.removeEventListener("focus", refresh);
    window.removeEventListener(SETTINGS_CHANGED, refresh);
    window.removeEventListener("storage", storage);
    document.removeEventListener("visibilitychange", refresh);
  };
}
