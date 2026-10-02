# Release preparation

Local task completion and release are separate outcomes. Deploy only when the
owner explicitly requests it; never infer permission from passing checks.

Before release:

1. Identify the reviewed revision and confirm the target environment with the owner.
2. Require a committed package lock and reproducible dependency installation.
3. Run `npm run verify:release`; all required checks must pass. `test:app` currently
   covers startup isolation only. Extend it to auth, ownership, product lifecycle,
   notifications and recovery before treating the application as release-ready.
4. Review auth/ownership and admin boundaries, any migrations and scheduling changes.
5. Build and exercise the actual app in an isolated environment with disposable
   SQLite storage and fake email/Telegram delivery. Record commands and results.
6. Validate migrations on a copy of representative data; verify backup restoration
   in isolation. Agree a recovery procedure before touching production.
7. Review Docker/nginx changes and the deployment script. `deploy.sh` pulls main,
   stops containers and changes storage permissions; it is not a read-only check.
8. Deploy only within the requested scope, then inspect health and critical flows.

The verification report is evidence of executed checks, not authorization and not
a complete release certification. Build, runtime, integration and recovery evidence
are manual requirements until automated isolation is implemented. No production
hostname, SSH account or credentials have been inferred from PureRecipe.
