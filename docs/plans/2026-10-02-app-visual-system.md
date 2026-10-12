# App visual system refinement — 2026-10-02

## Goal and acceptance
Apply the owner's selected light graphite/blue direction across inventory, settings, authentication, statistics and administration. Brand and page headings use stronger Manrope weights. Approaching expiry uses a warm amber marker with a darker readable label. Product state remains distinct from expiry urgency. Mobile controls retain readable labels and adequate touch targets; desktop tables remain available.

## Implementation
Preserve existing owner changes and behavior. Introduce shared typography, panel and urgency tokens. Replace legacy green actions, decorative gradients and authentication parallax with restrained blue actions and white panels. Harmonize analytics chart colors and integration surfaces. Keep account, notification and expiry logic unchanged.

## Risks and verification
Long Russian labels and narrow screens can wrap; preserve scrolling and avoid fixed form widths. Verify TypeScript, application tests and diff whitespace. Attempt browser inspection; report unavailable runtime checks honestly. No deployment, real notification calls or production database changes.

## Results

Typecheck and 20 application tests pass. Six page routes return HTTP 200 (page compilation only, not authenticated API success). Mobile header screenshot shows stronger typography. Browser input timeout prevents complete navigation and visual checks. A previously observed stats API null-expiry error remains unresolved and limits authenticated analytics verification. No deployment performed.
