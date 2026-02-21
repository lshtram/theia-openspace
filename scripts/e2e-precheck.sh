#!/usr/bin/env bash
# =============================================================================
# E2E Pre-check: Ensure both servers are running before Playwright tests.
#
# Usage (standalone):
#   ./scripts/e2e-precheck.sh           # start missing servers + wait
#   ./scripts/e2e-precheck.sh --status  # status check only, no start
#
# Both servers must be ready before this script exits 0.
# If either cannot start within the timeout, the script exits 1 and
# Playwright is NOT launched.
# =============================================================================

set -euo pipefail

# ── Ports ─────────────────────────────────────────────────────────────────────
THEIA_PORT="${THEIA_PORT:-3000}"
OPENCODE_PORT="${OPENCODE_PORT:-7890}"
THEIA_URL="http://localhost:${THEIA_PORT}"
OPENCODE_URL="http://localhost:${OPENCODE_PORT}"

# ── Timeouts ──────────────────────────────────────────────────────────────────
READY_TIMEOUT=120   # seconds to wait for each server
POLL_INTERVAL=2     # seconds between readiness polls

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[E2E Setup]${NC} $*"; }
info() { echo -e "${BLUE}[E2E Setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[E2E Setup]${NC} $*"; }
err()  { echo -e "${RED}[E2E Setup]${NC} $*" >&2; }

# ── Helpers ───────────────────────────────────────────────────────────────────

# Returns 0 if the URL responds with any HTTP status (server is alive)
server_ready() {
    local url="$1"
    curl -sf --max-time 3 --output /dev/null "$url" 2>/dev/null
}

# Wait until URL is ready or timeout
wait_ready() {
    local url="$1" label="$2"
    local elapsed=0
    while ! server_ready "$url"; do
        if (( elapsed >= READY_TIMEOUT )); then
            err "${label} did not become ready within ${READY_TIMEOUT}s — aborting."
            return 1
        fi
        info "Waiting for ${label}... (${elapsed}s / ${READY_TIMEOUT}s)"
        sleep "$POLL_INTERVAL"
        elapsed=$(( elapsed + POLL_INTERVAL ))
    done
    ok "${label} is ready at ${url}"
}

# Resolve opencode binary: OPENCODE_BIN env → Homebrew → PATH
resolve_opencode() {
    if [[ -n "${OPENCODE_BIN:-}" && -x "${OPENCODE_BIN}" ]]; then
        echo "$OPENCODE_BIN"; return
    fi
    for candidate in \
        /opt/homebrew/bin/opencode \
        /usr/local/bin/opencode \
        "${HOME}/.opencode/bin/opencode" \
        /Users/opencode/.opencode/bin/opencode
    do
        if [[ -x "$candidate" ]]; then echo "$candidate"; return; fi
    done
    # Last resort: PATH
    if command -v opencode &>/dev/null; then command -v opencode; return; fi
    err "Cannot find opencode binary. Set OPENCODE_BIN or install opencode."
    return 1
}

# ── Status-only mode ──────────────────────────────────────────────────────────
if [[ "${1:-}" == "--status" ]]; then
    echo "Server Status"
    echo "============="
    if server_ready "$THEIA_URL";    then ok "Theia    — RUNNING  (${THEIA_URL})";
    else warn "Theia    — NOT RUNNING  (${THEIA_URL})"; fi
    if server_ready "$OPENCODE_URL"; then ok "OpenCode — RUNNING  (${OPENCODE_URL})";
    else warn "OpenCode — NOT RUNNING  (${OPENCODE_URL})"; fi
    exit 0
fi

# ── OpenCode ──────────────────────────────────────────────────────────────────
if server_ready "$OPENCODE_URL"; then
    ok "OpenCode already running at ${OPENCODE_URL}"
else
    OPENCODE_BIN="$(resolve_opencode)"
    info "Starting OpenCode server (${OPENCODE_BIN} serve --port ${OPENCODE_PORT})..."
    "$OPENCODE_BIN" serve --port "$OPENCODE_PORT" \
        > /tmp/opencode-e2e.log 2>&1 &
    OPENCODE_PID=$!
    info "OpenCode PID: ${OPENCODE_PID}  (logs: /tmp/opencode-e2e.log)"
    wait_ready "$OPENCODE_URL" "OpenCode"
fi

# ── Theia ─────────────────────────────────────────────────────────────────────
if server_ready "$THEIA_URL"; then
    ok "Theia already running at ${THEIA_URL}"
else
    info "Starting Theia (yarn start:browser)..."
    THEIA_CONFIG_DIR="$(mktemp -d /tmp/theia-e2e.XXXXXX)" \
    yarn --cwd "$PROJECT_DIR" start:browser \
        > /tmp/theia-e2e.log 2>&1 &
    THEIA_PID=$!
    info "Theia PID: ${THEIA_PID}  (logs: /tmp/theia-e2e.log)"
    wait_ready "$THEIA_URL" "Theia"
fi

# ── Done ──────────────────────────────────────────────────────────────────────
ok "=== Both servers ready ==="
ok "  Theia:    ${THEIA_URL}"
ok "  OpenCode: ${OPENCODE_URL}"
