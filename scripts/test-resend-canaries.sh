#!/bin/bash
# Consolidated real-Resend-send tests (owner-approved email budget, 2026-11-21).
#
# Run ONCE tomorrow after the daily quota reset (08:00 local / UTC midnight),
# in a quiet window — no other chat's suite may be running on port 3100:
#
#   npm run build && bash scripts/test-resend-canaries.sh
#
# ~6 real send attempts total:
#   1  rl-ok EN canary (desktop)           — rate-limit spec
#   1  m4 CN journey canary (desktop)      — m4-booking spec
#   1  trip-cancelled delivery assertion   — m5-trips-lifecycle spec
#   3  customer-setup name-stash attempts  — customer-setup spec (tolerates
#      quota failure, but attempts real sends when quota is available)
#
# Everything else in the suite sends zero emails (token-insert sign-ins).
cd "$(dirname "$0")/.." || exit 1

echo "== Killing any stale server on 3100 (quiet-window assumption) =="
lsof -ti:3100 | xargs kill 2>/dev/null
sleep 1

fail=0
run() {
  echo ""
  echo "== $1 =="
  shift
  if npx playwright test "$@" --no-deps 2>&1 | tail -3; then :; else fail=1; fi
}

run "EN real-send canary (rl-ok, desktop)" tests/rate-limit.spec.mjs --project=chromium-desktop --grep "fresh address"
run "CN real-send canary (m4 CN journey, desktop)" tests/m4-booking.spec.mjs --project=chromium-desktop --grep "Chinese"
run "Trip-cancelled delivery (lifecycle)" tests/m5-trips-lifecycle.spec.mjs
run "Customer-setup name stash (3 send attempts)" tests/customer-setup.spec.mjs

echo ""
if [ "$fail" -eq 0 ]; then
  echo "ALL RESEND BATCHES PASSED"
else
  echo "SOME BATCHES FAILED — check output above (quota reset is 08:00 local; if still blocked, re-run later)."
fi
exit "$fail"