#!/usr/bin/env bash
# Runs cargo and re-emits its diagnostics as GitHub workflow annotations, so
# failures are visible inline on the pull request rather than only inside the job
# log (which needs repository admin rights to download). Exits with cargo's status.
#
# Usage: cargo-annotate.sh <cargo args...>
set -uo pipefail

log="$(mktemp)"
cargo "$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}

if [ "$status" -ne 0 ]; then
  echo "---- annotating failure (exit $status) ----"

  # Workflow command data must be percent-encoded for %, CR and LF.
  encode() { printf '%s' "$1" | sed -e 's/%/%25/g' -e 's/\r/%0D/g'; }

  # Grab the first diagnostics plus their context. Fall back to the tail of the
  # log if nothing matches, so a failure never produces an empty annotation.
  lines="$(grep -nE '^(error|failures:|test result: FAILED|thread .* panicked)' "$log" | head -n 5 || true)"
  if [ -z "$lines" ]; then
    body="$(tail -n 25 "$log")"
  else
    body="$(grep -E -A 8 '^(error|failures:|test result: FAILED|thread .* panicked)' "$log" | head -n 40)"
  fi

  # One annotation per line; GitHub caps these per step, so keep it short.
  printf '%s\n' "$body" | head -n 20 | while IFS= read -r line; do
    [ -z "${line//[[:space:]]/}" ] && continue
    printf '::error::%s\n' "$(encode "$line")"
  done
fi

exit "$status"
