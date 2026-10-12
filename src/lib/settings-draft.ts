export const settingsTabFields: Record<string, string[]> = {
  personal: [],
  integrations: ["telegramNotifications", "emailNotifications", "smtpHost", "smtpPort",
    "smtpUser", "smtpPass", "notificationEmail", "urgentNotifyTime", "warningNotifyTime"],
  statuses: ["urgentThreshold", "warningThreshold"],
};

/** Build a patch for one tab, comparing editable values with the saved snapshot. */
export function settingsTabPatch(tab: string, user: Record<string, unknown>, settings: Record<string, unknown>,
  savedUser: Record<string, unknown>, savedSettings: Record<string, unknown>) {
  const changed = (values: Record<string, unknown>, saved: Record<string, unknown>, keys: string[]) =>
    Object.fromEntries(keys.flatMap(key => {
      const value = key.endsWith("Threshold") ? (values[key] === "" ? NaN : Number(values[key])) : values[key];
      return Object.is(value, saved[key]) ? [] : [[key, value]];
    }));
  return {
    user: changed(user, savedUser, tab === "personal" ? ["name", "email"] : []),
    settings: changed(settings, savedSettings, settingsTabFields[tab] ?? []),
  };
}
