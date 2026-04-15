# Project Plan: Offline-First Expiration Tracker

This document outlines the steps to build the Expiration Tracker application.

## 1. Project Setup

- [ ] Initialize a new Next.js project.
- [ ] Install Prisma and configure it for SQLite.

## 2. Database Schema

- [x] Create `prisma/schema.prisma`.
- [x] Define `User` model with fields: `id`, `email`, `name`, `notifyDaysBefore`, `smtpHost`, `smtpPort`, `smtpUser`, `smtpPass`, `telegramChatId`.
- [x] Define `Product` model with fields: `id`, `name`, `barcode`, `productionDate`, `expirationDate`, `ownerId`.

## 3. Barcode Scanner Component

- [-] Install `html5-qrcode` library (skipped due to installation issues).
- [x] Create `src/components/BarcodeScanner.tsx`.
- [ ] Implement camera access and barcode scanning logic.
- [ ] The component should have a callback function to return the scanned code.

## 4. Notification System

- [x] Install `node-cron`, `nodemailer`, and `telegraf`.
- [x] Create a new service file `services/notifications.js`.
- [ ] Implement a cron job to run daily.
- [ ] The job will fetch users and their products.
- [ ] It will check for products expiring soon based on `user.notifyDaysBefore`.
- [ ] Send email notifications via `nodemailer`.
- [ ] Send Telegram messages via `telegraf`.

## 5. Dashboard UI

- [x] Create a new page `pages/dashboard.js`.
- [ ] Fetch and display a list of all products.
- [ ] Implement filters for "Expiring Soon", "Expired", and "All".
- [ ] Add a "Print Report" button.

## 6. Application Logic & Security

- [x] Create a script to check for the database on startup and run `prisma migrate deploy`.
- [ ] Ensure sensitive data (passwords, API keys) is stored securely in environment variables.
