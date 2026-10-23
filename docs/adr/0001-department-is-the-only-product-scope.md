# ADR-0001: a department is the only product scope

Status: Accepted
Date: 2026-10-21
Applies to: `src/lib/server/inventory.ts`, `src/pages/api/products/*`, `prisma/schema.prisma`

## Context

The service served one store with a per-user personal table as a fallback: a
product could be owned by a user with `storeId = null`. Two access models lived in
parallel, and the personal branch decided visibility in several routes.

## Decision

Every product belongs to a department (`Product.storeId` is mandatory since
migration `20261022000000_product_store_required`). `inventoryScope()` requires a
`StoreMembership` and refuses everything else with 403. `storeMembership()` is the
non-throwing lookup for background jobs and for screens that must render "no
department". There is no personal product scope anywhere in the product.

## Consequences

- Registration founds a department and its manager in one transaction, so no
  account without a department is created.
- Removing a membership removes access, not data: rows stay with the department.
- A restored legacy snapshot without departments drops those rows from the restored
  copy and reports the count instead of writing rows the schema rejects.
- Any new route must scope by membership; a route that reads a product by id alone
  is a defect.

## Evidence

`docs/plans/2026-10-21-department-access-model.md`,
`docs/plans/2026-10-21-brief-department-purge.md`,
`tests/department-access.test.cjs`, `tests/store-inspection.test.ts`.
