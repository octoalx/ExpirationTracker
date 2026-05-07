-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Settings" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "telegramToken" TEXT,
    "telegramChatId" TEXT,
    "telegramNotifications" BOOLEAN NOT NULL DEFAULT false,
    "notificationEmail" TEXT,
    "emailNotifications" BOOLEAN NOT NULL DEFAULT false,
    "smtpHost" TEXT,
    "smtpPort" INTEGER DEFAULT 587,
    "smtpUser" TEXT,
    "smtpPass" TEXT,
    "urgentThreshold" INTEGER NOT NULL DEFAULT 3,
    "warningThreshold" INTEGER NOT NULL DEFAULT 7,
    "urgentNotifyTime" TEXT NOT NULL DEFAULT '10:00',
    "warningNotifyTime" TEXT NOT NULL DEFAULT '10:00',
    "backupTime" TEXT NOT NULL DEFAULT '03:00',
    "backupEnabled" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("emailNotifications", "id", "notificationEmail", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "telegramChatId", "telegramNotifications", "telegramToken", "urgentNotifyTime", "urgentThreshold", "userId", "warningNotifyTime", "warningThreshold") SELECT "emailNotifications", "id", "notificationEmail", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "telegramChatId", "telegramNotifications", "telegramToken", "urgentNotifyTime", "urgentThreshold", "userId", "warningNotifyTime", "warningThreshold" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
