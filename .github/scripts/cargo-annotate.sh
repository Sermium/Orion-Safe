#!/usr/bin/env bash
# Runs cargo and re-emits any compiler diagnostics as GitHub workflow
# annotations, so failures show up inline on the pull request instead of only
# inside the job log. Exits with cargo's status.
#
# Usage: cargo-annotate.sh <cargo args...>
set -uo pipefail

log="$(mktemp)"
cargo "$@" 2>&1 | tee "$log"
status=${PIPESTATUS[0]}

if [ "$status" -ne 0 ]; then
  # GitHub caps annotations per step, so take the first diagnostics only. Each
  # line becomes its own annotation; blank lines are dropped to save slots.
  awk '/^error/,0' "$log" \
    | head -n 30 \
    | while IFS= read -r line; do
        [ -z "${line//[[:space:]]/}" ] && continue
        printf '::error::%s\n' "$line"
      done
fi

exit "$status"
