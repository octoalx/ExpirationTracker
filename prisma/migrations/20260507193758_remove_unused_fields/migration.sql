/*
  Warnings:

  - You are about to drop the `VerificationToken` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the column `notifyBeforeExpiration` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `theme` on the `Settings` table. All the data in the column will be lost.
  - You are about to drop the column `emailVerified` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `image` on the `User` table. All the data in the column will be lost.

*/
-- DropIndex
DROP INDEX "VerificationToken_identifier_token_key";

-- DropIndex
DROP INDEX "VerificationToken_token_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "VerificationToken";
PRAGMA foreign_keys=on;

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
    CONSTRAINT "Settings_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Settings" ("emailNotifications", "id", "notificationEmail", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "telegramChatId", "telegramNotifications", "telegramToken", "urgentNotifyTime", "urgentThreshold", "userId", "warningNotifyTime", "warningThreshold") SELECT "emailNotifications", "id", "notificationEmail", "smtpHost", "smtpPass", "smtpPort", "smtpUser", "telegramChatId", "telegramNotifications", "telegramToken", "urgentNotifyTime", "urgentThreshold", "userId", "warningNotifyTime", "warningThreshold" FROM "Settings";
DROP TABLE "Settings";
ALTER TABLE "new_Settings" RENAME TO "Settings";
CREATE UNIQUE INDEX "Settings_userId_key" ON "Settings"("userId");
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT,
    "email" TEXT,
    "password" TEXT,
    "role" TEXT NOT NULL DEFAULT 'USER'
);
INSERT INTO "new_User" ("email", "id", "name", "password", "role") SELECT "email", "id", "name", "password", "role" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
