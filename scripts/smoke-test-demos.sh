#!/bin/bash
# Smoke test all demo + real-world finance pages for regressions

set -u
SESSION="bg-smoke-test"
BASE="http://localhost:8686"

DEMO_PAGES=(
  "finance" "project-tracker" "hr-directory" "inventory"
  "editors" "clipboard" "cell-types" "sort-filter" "search-export"
  "hierarchy" "frozen-pinned" "multi-header" "merge-cells"
  "core-only" "plugin-toggle" "performance" "selection-modes" "pro"
)

REALWORLD_PAGES=(
  "fsbt-program" "fsbt-cost" "fsbt-revenue" "fsbt-funding"
  "dm-timeline" "dm-forecast" "dm-actuals" "dm-summary"
)

PASS_COUNT=0
FAIL_COUNT=0
FAILED_NAMES=""

check_page() {
  local url="$1"
  local label="$2"

  agent-browser --session "$SESSION" errors --clear >/dev/null 2>&1 || true
  agent-browser --session "$SESSION" console --clear >/dev/null 2>&1 || true

  if ! agent-browser --session "$SESSION" open "$url" >/dev/null 2>&1; then
    echo "  [FAIL] $label — navigation failed"
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_NAMES="$FAILED_NAMES $label(nav)"
    return
  fi

  agent-browser --session "$SESSION" wait --load networkidle >/dev/null 2>&1 || true
  agent-browser --session "$SESSION" wait 400 >/dev/null 2>&1

  # Capture page-level JS errors
  local err_output
  err_output=$(agent-browser --session "$SESSION" errors 2>/dev/null)

  # Capture console errors (severity=error), ignore benign noise
  local console_output
  console_output=$(agent-browser --session "$SESSION" console 2>/dev/null | grep -E "^\[error\]" | grep -vE "favicon|DevTools" || true)

  if [[ -n "$err_output" ]] || [[ -n "$console_output" ]]; then
    echo "  [FAIL] $label"
    if [[ -n "$err_output" ]]; then
      echo "    page-errors:"
      echo "$err_output" | head -3 | sed 's/^/      /'
    fi
    if [[ -n "$console_output" ]]; then
      echo "    console-errors:"
      echo "$console_output" | head -3 | sed 's/^/      /'
    fi
    FAIL_COUNT=$((FAIL_COUNT + 1))
    FAILED_NAMES="$FAILED_NAMES $label"
    return
  fi

  echo "  [PASS] $label"
  PASS_COUNT=$((PASS_COUNT + 1))
}

echo "=== Testing ${#DEMO_PAGES[@]} core demo pages ==="
for page in "${DEMO_PAGES[@]}"; do
  check_page "$BASE/demo/$page" "demo/$page"
done

echo ""
echo "=== Testing ${#REALWORLD_PAGES[@]} real-world finance demo pages ==="
for page in "${REALWORLD_PAGES[@]}"; do
  check_page "$BASE/demo-realworld/$page" "demo-realworld/$page"
done

echo ""
echo "=== Results ==="
echo "Passed: $PASS_COUNT"
echo "Failed: $FAIL_COUNT"

agent-browser --session "$SESSION" close >/dev/null 2>&1 || true

if [[ $FAIL_COUNT -gt 0 ]]; then
  echo ""
  echo "Failed pages:$FAILED_NAMES"
  exit 1
fi
echo "All pages passed."
