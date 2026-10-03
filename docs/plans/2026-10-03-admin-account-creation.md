# Admin account creation — 2026-10-03

## Goal and acceptance criteria

- Administrators can create an account from Admin > Users with name, email, password and USER/ADMIN role; USER is the default.
- Successful creation refreshes the list and clears the password. Validation and duplicate email errors remain visible without losing the form.
- Anonymous callers and USER sessions cannot create accounts. Passwords are hashed and never returned in API responses.
- Existing users and inventory remain unchanged; no schema migration or live notifications are needed.

## Scope and approach

Extend the existing admin users endpoint with POST. Add a collapsible inline creation form to UsersTab, preserving existing management actions and responsive styling.

## Risks and invariants

Use verified NextAuth roles, validate untrusted bodies and role values, and handle unique email races. Match the existing minimum registration password length (8), reject bcrypt passwords exceeding 72 UTF-8 bytes. Keep credential services server-side. No deployment is authorized.

## Verification

Exercise the endpoint against disposable migrated SQLite storage: permissions, invalid input, both roles, duplicate emails, safe response fields, password verification and preservation of existing records. Run typecheck, context/harness checks after test-script updates, diff review and UI detector. Browser verification is separate from static rendering.

## Result and handoff

Implemented POST /api/admin/users and the inline form with default USER role, disabled pending state, retained validation errors and credential cleanup on success/close. Existing management actions remain available. Registered the new regression test in test:app.

Verification: focused admin tests 2 PASS, 0 SKIP; typecheck PASS; context check PASS; harness 3 PASS, 0 SKIP; diff review/check PASS; UI detector reported no findings. Actual credentials-provider login is exercised on disposable storage. Browser interaction and responsive visual verification were not performed. No production deployment, commit or push.
