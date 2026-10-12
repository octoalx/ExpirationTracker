import test from "node:test";
import assert from "node:assert/strict";
import { settingsTabPatch } from "../src/lib/settings-draft";

test("tab saves isolate changes and preserve unsaved drafts in other tabs", () => {
  const savedUser = { name: "Owner", email: "legacy-address" };
  const savedSettings = { urgentThreshold: 3, warningThreshold: 7, emailNotifications: false,
    notificationEmail: "unfinished", smtpPass: "" };
  const user = { ...savedUser, name: "Changed" };
  const settings = { ...savedSettings, urgentThreshold: "4", notificationEmail: "draft", smtpPass: "new-secret" };
  const statusPatch = settingsTabPatch("statuses", user, settings, savedUser, savedSettings);
  assert.deepEqual(statusPatch, { user: {}, settings: { urgentThreshold: 4 } });
  const afterStatusSave = { ...savedSettings, ...statusPatch.settings };
  assert.deepEqual(settingsTabPatch("statuses", user, settings, savedUser, afterStatusSave), { user: {}, settings: {} });
  assert.deepEqual(settingsTabPatch("personal", user, settings, savedUser, afterStatusSave),
    { user: { name: "Changed" }, settings: {} });
  assert.deepEqual(settingsTabPatch("integrations", user, settings, savedUser, afterStatusSave),
    { user: {}, settings: { smtpPass: "new-secret", notificationEmail: "draft" } });
  assert.ok(Number.isNaN(settingsTabPatch("statuses", user, { ...settings, urgentThreshold: "" }, savedUser, afterStatusSave).settings.urgentThreshold));
});
