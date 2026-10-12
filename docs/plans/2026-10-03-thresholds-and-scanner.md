# Inventory thresholds and scanner — 2026-10-03

## Goal and acceptance criteria
- Inventory reads the nested settings response and uses saved urgent/warning
  thresholds consistently for desktop, mobile, filters and counts.
- Saving settings refreshes other open inventory tabs immediately. Focus/visibility
  refreshes and periodic reads pick up changes from other devices within 30 seconds.
- Calendar-day transitions refresh mounted inventory without reloading products.
- Camera permission/startup overlaps decoder loading; continuous focus is requested
  only when supported. Closing/unmounting always releases camera resources.

## Risks and scope
Do not change cron timezone/frequency. Browser dates retain existing local calendar
semantics. Poll only a minimal authenticated threshold endpoint while visible;
never put integration credentials in storage/events. Camera hardware, permission
prompts and lighting affect recognition and cannot be measured in offline tests.
Preserve all earlier uncommitted mobile editing work.

## Verification
Test threshold boundaries/settings refresh with fake time/events and transports;
test settings API ownership and payload shape on disposable SQLite; test camera
startup/cancellation with fake streams. Run application suite, typecheck, context
and harness checks, then review diff. No live integrations or app startup.

## Results
- Confirmed root cause: dashboard consumed the settings envelope instead of its
  nested `settings` object, so default 3/7 thresholds were always used.
- Visible inventory refreshes on save events, storage events, focus, visibility
  and a 30-second interval. Reference time invalidates table column memoization.
- Urgent is red and warning orange, with explicit labels in desktop/mobile views.
  Summary counters now match the active-only urgency filters.
- Camera permission and decoder download overlap; preview is shown before the
  decoder is ready. Request 1280x720 rear camera, optional continuous autofocus,
  150ms scan retry and a preview without cropping. Parent updates do not restart
  the camera; late streams/controls are released after cancellation.
- Application suite: 37 passed, zero skipped. Typecheck, context check, harness
  (3 passed) and diff check passed. Tests include real disposable SQLite settings
  persistence, rendered mobile/desktop status labels and fake camera lifecycles.
- No live-device timing measurement, browser interaction or production deployment.
