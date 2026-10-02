# AI-assisted engineering

This workflow adapts the lean development principles of
[PureRecipe](https://github.com/octoalx/purerecipe): a compact shared contract,
task-specific context, autonomous routine decisions, proportional verification,
durable task handoffs and explicit production boundaries.

`AGENTS.md` is the single repository contract for any AI client. Do not duplicate
it in client-specific rules or copy PureRecipe's Python/FastAPI, Telegram initData,
payment, provider credentials, model settings or production target configuration.
Repository instructions guide agents; they do not enforce OS permissions.

Read additional context only when relevant:

| Need | Context |
| --- | --- |
| Start or verify local work | [Development](development.md) |
| Prepare a production release | [Release](release.md) |
| Resume unfinished work | [Active context](../../memory-bank/activeContext.md) |
| Plan a significant change | [Plan template](../plans/TEMPLATE.md) |

## Adaptation decisions

- Use the current Next.js Pages Router and Prisma/SQLite architecture.
- Replace Telegram Mini App authentication rules with NextAuth session ownership
  and admin role checks. Telegram here is a notification transport.
- Keep offline tests separate from instrumentation, cron and real integrations.
- Use Node's built-in test runner for the verification tooling, without adding
  another runtime or imposing model/provider settings on the owner's AI client.
- Avoid copying the large evaluation harness and manual publication ceremonies.
  Ordinary local changes and commits remain lightweight.
- Keep roadmap, measured evidence and limitations explicit. A tooling test is not
  evidence that authentication, notifications, migrations or the UI work.

Source snapshot: PureRecipe revision recorded in the dated adaptation plan.
