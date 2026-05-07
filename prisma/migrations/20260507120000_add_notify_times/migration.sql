-- AlterTable
ALTER TABLE "Settings" ADD COLUMN "urgentNotifyTime" TEXT NOT NULL DEFAULT '10:00';
ALTER TABLE "Settings" ADD COLUMN "warningNotifyTime" TEXT NOT NULL DEFAULT '10:00';
