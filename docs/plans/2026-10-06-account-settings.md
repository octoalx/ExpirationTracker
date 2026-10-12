# Account settings — 2026-10-06

## Goal and acceptance criteria

Users can update their name and login email and change their password in Settings.
Email/password changes require the current password; new passwords require confirmation
and 8 characters minimum / 72 UTF-8 bytes maximum. Invalid input and duplicate emails
leave all data unchanged. Profile session information refreshes from storage.
Existing notification preferences remain available and separate from login email.

## Scope and approach

Extend the existing settings API and personal tab without schema changes. Allowlist
writable settings and validate profile credentials. Reload JWT profile fields from
storage on session update, never trust client-supplied identity or role.

## Risks and invariants

Scope all changes by verified session ID. Never return password hashes or log
credentials. Keep notification scheduling and timezone unchanged. Preserve unrelated
Excel import work and existing active context content.

## Verification

Offline API tests with fake integrations and disposable SQLite; authentication,
validation, conflicts, ownership, password hashes and atomic updates. Typecheck and
diff review. No live notification sends or production operations.

## Result and handoff

Implemented profile validation, current-password confirmation for email/password
changes, bcrypt password replacement, duplicate-email handling and transactional
settings updates with writable-field allowlisting. The personal tab includes new
password confirmation, autocomplete hints and separate notification-email guidance.
Session refresh reloads trusted profile data from SQLite.

Verification: 7 focused tests PASS; typecheck PASS; diff review and diff whitespace
check PASS. Full application suite: 61 PASS / 1 FAIL / 0 SKIP. The catalog API test
fails on an unmocked `../../../lib/inventory-import` dependency in the pre-existing
modified Excel import route; unrelated owner changes were preserved. No browser
runtime inspection, email ownership verification, session revocation on other
devices or production deployment was performed.
