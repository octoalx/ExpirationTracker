# Settings and pending import deployment — 2026-10-06

## Goal and acceptance criteria

Owner authorized committing current changes and deploying to the existing server.
Preserve previous mobile dialog/date fixes, users, products, catalog and integrations.
All release checks pass; exact committed source builds on Linux; isolated startup
and account/profile flows pass; production health and data fingerprints reconcile.

## Scope and approach

Review and commit pending simple Excel import, catalog picker UI and account settings
changes, tests and documentation explicitly. Repair the catalog API test's obsolete
import dependency mock and fabricated-date expectation for unknown expiry.
No push requested. Archive the commit into a new restricted release directory on
Alex@146.103.42.228:34657, /home/Alex/ExpirationTracker. Build without stopping
production. Never run deploy.sh or reset the server's unrelated modified checkout.

## Investigation

Running image is expirationtracker-release:4543a7f, ID b2bfdf2da8418ebe200f941e838c45b390a4afcea19066f7a1b96ce2d101e719.
Server checkout HEAD is ded6d71 and contains extensive unrelated modifications;
it is not the deployed version. Production CSS includes fixed dialog close position,
sticky dialog header, mobile overflow containment and keyboard scroll padding.
Retained 425e0e0 release CSS versus local CSS shows these rules preserved; only
record-action styles and added keyboard inset rules differ. A specific owner-visible
regression is not established; clarify the affected screen/action before attributing
it to browser cache or a deployment rollback.

Owner clarified that the affected cross is the filter reset below search, and the
date text shifts after picker confirmation. Production browser at 320/390 confirms
the reset is deliberately an icon-only blue X in committed dashboard code. Replace
it with a visible neutral text button and allow filter wrapping. Date inputs have
width containment but no explicit WebKit value alignment; add native date value
left alignment and stable line height in the shared add/edit form styles. Actual
iPhone system-picker behavior remains a device check, not a proven cached-build issue.

## Risks and recovery

Retain current image with rollback tag; take a restricted consistent online SQLite
snapshot and verify integrity and all table fingerprints. Rehearse with a disposable
sanitized copy, fake credentials, network disabled and background jobs disabled.
No schema changes are expected. Replace only app and reload nginx. If health or
critical checks fail, restore the retained image, never overwrite live database.
Keep Cloudflare Access, nginx/tunnel, timezone and notification scheduling intact.

## Verification and result

Fresh local release gate PASS: 62 application tests, 3 harness tests, context and
TypeScript; zero skips. Diff reviewed. Linux build, isolated rehearsal and
production checks pending.
