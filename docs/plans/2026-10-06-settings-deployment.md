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

## Completed deployment evidence

- Application commits: `d4909d56e564784f869c62a1106e0d3819cf599d`
  (pending account/import/catalog UI work) and `f24d84fea4e328ca26b342e8753d4a97279b7f7d`
  (filter reset and native date alignment). No Git push performed.
- Exact final source archive SHA-256:
  `44337171655f7923a81aa08611bdfff802621d6db2fe9aa709dde619caa4041b`.
  Candidate `expirationtracker-release:f24d84f`; deployed image ID
  `sha256:04c549828ac17aa0d1be2510cd321bfab89a64e5751e2a0854b86bca510a7f3d`.
  Image revision label identifies the full application commit.
- Fresh release gate after the mobile changes PASS: 62 app tests, 3 harness tests,
  context and TypeScript. Linux Docker/Next production build PASS.
- Restored/sanitized representative SQLite snapshot, normal startup and every-table
  fingerprint comparison PASS. Network disabled, jobs disabled, fake credentials,
  integrations cleared. HTTP profile/email/password replacement, old-login denial,
  new login, trusted session update, ownership, pages and nine assets PASS.
- Final restricted backup: `backups/pre-f24d84f-final-20261006.db`, taken after
  stopping only app. App-only replacement, nginx config/reload, sign-in 200,
  anonymous products/catalog/settings/thresholds 401 PASS. Public HTTPS retains
  Cloudflare Access redirect 302. App health is healthy.
- Every production data table except expected startup SystemLog entries has matching
  fingerprints before/after. User 4, Product 437, CatalogEntry 106, Settings 4,
  SharedCatalogEntry 444297; SQLite integrity OK. Integration preferences unchanged.
- Production browser PASS: new profile/password controls present; mobile reset reads
  "Сбросить" with no SVG icon; add/edit date fields keep x/width/height and left
  alignment after input and blur at 390/320px. Edit focus can scroll the panel;
  no records or production profile were saved during browser inspection.
- The blue reset cross was introduced by `4543a7f` on October 5; its PR changed
  more than primary colors. Earlier dialog close/position/overflow fixes remain in
  source and compiled production CSS. This is evidence of a later UI change,
  not a verified stale-cache or deployment rollback. Actual iPhone system date
  picker behavior remains unverified; owner should confirm the WebKit alignment fix.
- Rollback retained as `expirationtracker-rollback:pre-f24d84f-20261006`.
  Server modified checkout, nginx/tunnel and live storage preserved. Evidence under
  `/home/Alex/.codex-releases/expirationtracker-f24d84f` (uncommitted logs/snapshots).
