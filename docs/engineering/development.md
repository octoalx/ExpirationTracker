# Local development and verification

## Task loop

1. Inspect the working tree and identify the user's acceptance criteria.
2. Inspect the relevant routes, services and UI before choosing an implementation.
3. For risky or broad changes, create a dated plan from `docs/plans/TEMPLATE.md`.
4. Add a behavioral regression test for changed business behavior. Prefer inputs
   and observable outputs over assertions about source text or internal calls.
5. Run focused checks, review the diff and inspect changed UI states when applicable.
6. Record the outcome and next step only when a durable handoff is useful.

## Commands

Requires Node.js 22 or newer (matching the Docker runtime). Tooling checks have no
third-party dependencies and work on Windows and Linux:

```text
npm run check:context
npm run test:harness
npm run verify
npm run typecheck
npm run verify:release
```

`verify` always checks instruction size, local Markdown links and harness behavior.
It runs the local TypeScript compiler if installed, otherwise reports SKIP. It
reports application tests as SKIP when `test:app` or dependencies are unavailable. It writes a small
status-only report to ignored `.verification/verification.json`; it does not save
command output, environment variables or credentials. Failed executed checks return
a nonzero exit code. The release profile treats missing prerequisites as FAIL.

No verification command installs dependencies, starts the application, reads `.env`,
starts containers, migrates a database or sends notifications. TypeScript checking
uses the installed compiler directly, without allowing `npx` to download tools.

## Baseline limitations

The repository already contained a package lock; an earlier inventory mistakenly
excluded it. Original dependency versions are preserved. `.npmrc` matches Docker's legacy
peer resolution. Use `npm ci --ignore-scripts`, then `npm rebuild better-sqlite3`
and generate the Prisma client with an isolated `DATABASE_URL`. Review lifecycle
scripts before enabling them. The Windows baseline uses Node 24.19.0; Docker and
tooling CI use Node 22. Docker/Linux application execution remains unverified.
Application tests currently cover instrumentation startup only, not business flows.
There is still no ESLint configuration. CI checks engineering tooling only.

`npm run dev` now starts Next.js directly; instrumentation owns job startup. Set
`DISABLE_BACKGROUND_JOBS=true` before any isolated build or inspection. The hook
then skips loading job services entirely. Normal startup keeps jobs enabled.
Use disposable development data and fake integration transports for business-flow
tests; disabling cron alone does not disable direct notification API calls.

PowerShell example for compilation without initializing storage:

```powershell
$env:DATABASE_URL = 'file:./.verification/baseline.db'
$env:DISABLE_BACKGROUND_JOBS = 'true'
$env:NEXTAUTH_URL = 'http://localhost:3000'
$env:NEXTAUTH_SECRET = [guid]::NewGuid().ToString()
$env:NEXT_TELEMETRY_DISABLED = '1'
npm run db:generate
npm run typecheck
npm run build
```

The URL is disposable and no schema creation is performed by these commands.

Next steps: establish reproducible dependencies, noninteractive linting, and offline
behavioral tests for auth/ownership, expiry boundaries, import validation, cron
deduplication and backup/restore. Then extend the gate with real application evidence.
