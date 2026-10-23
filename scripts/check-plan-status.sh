#!/usr/bin/env bash
# Do not use `set -e` with grep pipelines: an empty match is a normal outcome here.
#
# Enforces a status line on every record under docs/plans/:
#   Status: DONE | PARTIAL | ABANDONED | SUPERSEDED
# A proof-bearing status (DONE, PARTIAL, SUPERSEDED) must carry a non-empty
#   Evidence: <commit | PR | plan path>
# ABANDONED is the honest default when the history shows nothing: it needs no
# proof, because "no evidence found" is itself the finding.
#
# Exit 1 and print every offending file — never stop at the first one, so one
# run tells the whole story.

root="$(git rev-parse --show-toplevel 2>/dev/null || pwd)"
cd "$root" || exit 1

plans_dir="docs/plans"
[ -d "$plans_dir" ] || { echo "check-plan-status: $plans_dir not found"; exit 1; }

fail=0
checked=0

for f in "$plans_dir"/*.md; do
  case "$(basename "$f")" in TEMPLATE.md) continue ;; esac
  [ -e "$f" ] || continue
  checked=$((checked + 1))

  status="$(sed -n 's/^Status:[[:space:]]*//p' "$f" | head -1 | tr -d '\r' | sed 's/[[:space:]]*$//')"
  case "$status" in
    DONE|PARTIAL|ABANDONED|SUPERSEDED) ;;
    "")
      echo "MISSING STATUS  $f"
      fail=1; continue ;;
    *)
      echo "BAD STATUS      $f (got '$status')"
      fail=1; continue ;;
  esac

  if [ "$status" != "ABANDONED" ]; then
    evidence="$(sed -n 's/^Evidence:[[:space:]]*//p' "$f" | head -1 | tr -d '\r' | sed 's/[[:space:]]*$//')"
    if [ -z "$evidence" ]; then
      echo "NO EVIDENCE     $f ($status with an empty Evidence line)"
      fail=1
    fi
  fi
done

if [ "$fail" -ne 0 ]; then
  echo "check-plan-status: FAILED — add Status: (and Evidence: for DONE/PARTIAL/SUPERSEDED) to the files above."
  exit 1
fi

echo "check-plan-status: OK — $checked plans, all with a status."
