# Active context

Updated: 2026-10-01

## Current milestone

Adapt PureRecipe's lean AI-assisted engineering workflow to ExpirationTracker.
The shared contract is `AGENTS.md`; details are under `docs/engineering/`.

## Known baseline gaps

- Existing tracked package lock is preserved; new `.npmrc` matches Docker resolution.
- No configured ESLint; application coverage currently tests only startup isolation.
- Startup instrumentation runs cron; notification and backup checks need isolation.
- Development startup is portable; DISABLE_BACKGROUND_JOBS=true skips cron imports.

## Next useful task

Windows TypeScript and production build pass. Startup isolation and tooling tests
pass. Add offline auth/ownership and product lifecycle regression tests next.
Runtime server inspection was blocked by tool policy; Docker/Linux app execution
and real business flows remain unverified.
