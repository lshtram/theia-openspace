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
THEIA_ROOT_URL="${THEIA_URL}/"
HUB_INSTRUCTIONS_URL="${THEIA_URL}/openspace/instructions"
HUB_MCP_URL="${THEIA_URL}/mcp"
OPENCODE_PROJECT_URL="${OPENCODE_URL}/project"

# ── Timeouts ──────────────────────────────────────────────────────────────────
READY_TIMEOUT=120   # seconds to wait for each server
POLL_INTERVAL=2     # seconds between readiness polls
STARTUP_GRACE_SECONDS="${E2E_PRECHECK_STARTUP_GRACE_SECONDS:-8}"

# ── Paths ─────────────────────────────────────────────────────────────────────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
THEIA_BACKEND_MAIN="$PROJECT_DIR/browser-app/src-gen/backend/main.js"
CORE_EXT_LIB_DIR="$PROJECT_DIR/extensions/openspace-core/lib"
CHAT_EXT_LIB_DIR="$PROJECT_DIR/extensions/openspace-chat/lib"
OPENCODE_LOG_FILE="${OPENCODE_LOG_FILE:-$(mktemp /tmp/opencode-e2e.XXXXXX)}"
THEIA_LOG_FILE="${THEIA_LOG_FILE:-$(mktemp /tmp/theia-e2e.XXXXXX)}"
THEIA_BUILD_LOG_FILE="${THEIA_BUILD_LOG_FILE:-$(mktemp /tmp/theia-e2e-build.XXXXXX)}"

# ── Colors ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; BLUE='\033[0;34m'; NC='\033[0m'
ok()   { echo -e "${GREEN}[E2E Setup]${NC} $*"; }
info() { echo -e "${BLUE}[E2E Setup]${NC} $*"; }
warn() { echo -e "${YELLOW}[E2E Setup]${NC} $*"; }
err()  { echo -e "${RED}[E2E Setup]${NC} $*" >&2; }

# ── Helpers ───────────────────────────────────────────────────────────────────

# Returns 0 if URL is reachable over HTTP (any status)
service_reachable() {
    local url="$1"
    local http_code
    http_code="$(curl -sS --max-time 3 --output /dev/null --write-out "%{http_code}" "$url" 2>/dev/null || true)"
    [[ "$http_code" != "000" ]]
}

PROBE_THEIA_ROOT_DETAIL="not checked"
PROBE_HUB_MCP_DETAIL="not checked"
PROBE_HUB_INSTRUCTIONS_DETAIL="not checked"
PROBE_OPENCODE_API_DETAIL="not checked"

http_code_and_type() {
    local method="$1" url="$2" payload="${3:-}"
    if [[ -n "$payload" ]]; then
        curl -sS --max-time 5 -X "$method" \
            -H "content-type: application/json" \
            -d "$payload" \
            -o /dev/null -w "%{http_code}|%{content_type}" "$url"
    else
        curl -sS --max-time 5 -X "$method" \
            -o /dev/null -w "%{http_code}|%{content_type}" "$url"
    fi
}

extract_mcp_json_payload() {
    local body="$1"
    local line=""
    local event_data=""
    local trimmed=""

    while IFS= read -r line || [[ -n "$line" ]]; do
        line="${line%$'\r'}"

        if [[ -z "$line" ]]; then
            if [[ -n "$event_data" ]]; then
                trimmed="${event_data#${event_data%%[![:space:]]*}}"
                if [[ "$trimmed" == \{* || "$trimmed" == \[* ]]; then
                    printf '%s\n' "$event_data"
                    return 0
                fi
            fi
            event_data=""
            continue
        fi

        case "$line" in
            data:*)
                line="${line#data:}"
                line="${line# }"
                if [[ -n "$event_data" ]]; then
                    event_data+=$'\n'
                fi
                event_data+="$line"
                ;;
            \{*)
                printf '%s\n' "$line"
                return 0
                ;;
        esac
    done <<< "$body"

    if [[ -n "$event_data" ]]; then
        trimmed="${event_data#${event_data%%[![:space:]]*}}"
        if [[ "$trimmed" == \{* || "$trimmed" == \[* ]]; then
            printf '%s\n' "$event_data"
            return 0
        fi
    fi

    return 1
}

validate_jsonrpc_response() {
    local payload="$1" expected_id="$2"
    JSONRPC_PAYLOAD="$payload" JSONRPC_EXPECTED_ID="$expected_id" node -e '
const payload = process.env.JSONRPC_PAYLOAD || "";
const expectedId = process.env.JSONRPC_EXPECTED_ID || "";
let parsed;
try {
  parsed = JSON.parse(payload);
} catch {
  process.exit(1);
}
if (!parsed || typeof parsed !== "object") process.exit(1);
if (parsed.jsonrpc !== "2.0") process.exit(1);
if (String(parsed.id) !== expectedId) process.exit(1);
const hasResult = Object.prototype.hasOwnProperty.call(parsed, "result");
const hasError = Object.prototype.hasOwnProperty.call(parsed, "error");
if (!hasResult && !hasError) process.exit(1);
process.exit(0);
'
}

probe_theia_root() {
    local result status_code content_type
    if ! result="$(http_code_and_type GET "$THEIA_ROOT_URL")"; then
        PROBE_THEIA_ROOT_DETAIL="request failed"
        return 1
    fi

    status_code="${result%%|*}"
    content_type="${result#*|}"
    PROBE_THEIA_ROOT_DETAIL="status=${status_code}, content-type=${content_type:-unknown}"

    case "$content_type" in
        text/html*) [[ "$status_code" == "200" ]] ;;
        *) return 1 ;;
    esac
}

probe_hub_mcp() {
    local payload result status_code content_type
    local body_file body body_single_line body_excerpt mcp_payload
    local probe_id="e2e-precheck"

    payload="$(printf '{\"jsonrpc\":\"2.0\",\"id\":\"%s\",\"method\":\"__e2e_precheck_probe__\",\"params\":{}}' "$probe_id")"
    body_file="$(mktemp /tmp/e2e-precheck-mcp.XXXXXX)"

    if ! result="$(curl -sS --max-time 5 --max-filesize 131072 \
        -X POST \
        -H "content-type: application/json" \
        -H "accept: application/json, text/event-stream" \
        -d "$payload" \
        -o "$body_file" \
        -w "%{http_code}|%{content_type}" \
        "$HUB_MCP_URL")"; then
        PROBE_HUB_MCP_DETAIL="request failed"
        rm -f "$body_file"
        return 1
    fi

    body="$(<"$body_file")"
    rm -f "$body_file"

    status_code="${result%%|*}"
    content_type="${result#*|}"
    body_single_line="${body//$'\n'/ }"
    body_excerpt="${body_single_line:0:140}"
    PROBE_HUB_MCP_DETAIL="status=${status_code}, content-type=${content_type:-unknown}, body=${body_excerpt}"

    [[ "$status_code" == "200" ]] || return 1
    case "$content_type" in
        text/event-stream*|application/json*) ;;
        *) return 1 ;;
    esac

    if ! mcp_payload="$(extract_mcp_json_payload "$body")"; then
        return 1
    fi

    validate_jsonrpc_response "$mcp_payload" "$probe_id"
}

probe_hub_instructions() {
    local result status_code content_type
    if ! result="$(http_code_and_type GET "$HUB_INSTRUCTIONS_URL")"; then
        PROBE_HUB_INSTRUCTIONS_DETAIL="request failed"
        return 1
    fi

    status_code="${result%%|*}"
    content_type="${result#*|}"
    PROBE_HUB_INSTRUCTIONS_DETAIL="status=${status_code}, content-type=${content_type:-unknown}"

    [[ "$status_code" == "200" ]] || return 1
    case "$content_type" in
        text/html*) return 1 ;;
        text/plain*|text/*) ;;
        *) return 1 ;;
    esac
}

probe_opencode_api() {
    local result status_code content_type
    if ! result="$(http_code_and_type GET "$OPENCODE_PROJECT_URL")"; then
        PROBE_OPENCODE_API_DETAIL="request failed"
        return 1
    fi

    status_code="${result%%|*}"
    content_type="${result#*|}"
    PROBE_OPENCODE_API_DETAIL="status=${status_code}, content-type=${content_type:-unknown}"

    case "$content_type" in
        application/json*) [[ "$status_code" == "200" ]] ;;
        *) return 1 ;;
    esac
}

probe_theia_stack() {
    probe_theia_root && probe_hub_instructions && probe_hub_mcp
}

probe_all_services() {
    probe_theia_stack && probe_opencode_api
}

print_probe_status() {
    local label="$1" detail_var="$2"
    local detail="${!detail_var}"
    if [[ "$3" == "0" ]]; then
        ok "${label} — HEALTHY (${detail})"
    else
        warn "${label} — UNHEALTHY (${detail})"
    fi
}

status_probe() {
    local label="$1" probe_fn="$2" detail_var="$3"
    local probe_exit=0
    if "$probe_fn"; then
        probe_exit=0
    else
        probe_exit=$?
    fi
    print_probe_status "$label" "$detail_var" "$probe_exit"
    return "$probe_exit"
}

# Wait until URL is ready or timeout
wait_ready() {
    local check_fn="$1" label="$2"
    local elapsed=0
    while ! "$check_fn"; do
        if (( elapsed >= READY_TIMEOUT )); then
            err "${label} did not become ready within ${READY_TIMEOUT}s — aborting."
            return 1
        fi
        info "Waiting for ${label}... (${elapsed}s / ${READY_TIMEOUT}s)"
        sleep "$POLL_INTERVAL"
        elapsed=$(( elapsed + POLL_INTERVAL ))
    done
    ok "${label} passed strict readiness checks"
}

wait_startup_grace_for_probe() {
    local check_fn="$1" label="$2"
    local elapsed=0

    if "$check_fn"; then
        return 0
    fi

    warn "${label} strict probe failed while port is reachable; waiting ${STARTUP_GRACE_SECONDS}s startup grace before recovery"
    while (( elapsed < STARTUP_GRACE_SECONDS )); do
        sleep 1
        elapsed=$(( elapsed + 1 ))
        if "$check_fn"; then
            ok "${label} strict probe became healthy during startup grace (${elapsed}s)"
            return 0
        fi
    done

    return 1
}

pid_matches_service_identity() {
    local pid="$1" service_name="$2"
    local cmdline=""
    cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"

    case "$service_name" in
        Theia)
            [[ "$cmdline" == *"${PROJECT_DIR}/browser-app/src-gen/backend/main.js"* || \
               "$cmdline" == *"--cwd ${PROJECT_DIR}/browser-app start"* || \
               "$cmdline" == *"--cwd ${PROJECT_DIR} start:browser"* || \
               "$cmdline" == *"${PROJECT_DIR}/browser-app"*"src-gen/backend/main.js"* ]]
            ;;
        OpenCode)
            [[ "$cmdline" == *"opencode"* ]]
            ;;
        *)
            return 1
            ;;
    esac
}

kill_listener_on_port() {
    local port="$1" service_name="$2"
    local pids=""
    local pid=""
    local cmdline=""
    local had_unexpected=0

    pids="$(lsof -nP -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -z "$pids" ]]; then
        warn "No LISTEN process found on port ${port} for ${service_name}."
        return 0
    fi

    if [[ "${E2E_PRECHECK_FORCE_KILL:-0}" != "1" ]]; then
        for pid in $pids; do
            if ! pid_matches_service_identity "$pid" "$service_name"; then
                cmdline="$(ps -p "$pid" -o command= 2>/dev/null || true)"
                err "Refusing to kill unexpected ${service_name} listener PID ${pid} on port ${port}."
                err "  cmd: ${cmdline:-unavailable}"
                had_unexpected=1
            fi
        done
        if (( had_unexpected == 1 )); then
            err "Set E2E_PRECHECK_FORCE_KILL=1 to override this safety guard."
            return 1
        fi
    else
        warn "E2E_PRECHECK_FORCE_KILL=1 set; skipping process-identity guard for ${service_name} on port ${port}."
    fi

    warn "Stopping stale ${service_name} listener(s) on port ${port}: ${pids}"
    kill $pids 2>/dev/null || true
    sleep 1

    pids="$(lsof -nP -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
        warn "Port ${port} still occupied after SIGTERM. Sending SIGKILL to: ${pids}"
        kill -9 $pids 2>/dev/null || true
        sleep 1
    fi

    pids="$(lsof -nP -tiTCP:"${port}" -sTCP:LISTEN 2>/dev/null || true)"
    if [[ -n "$pids" ]]; then
        err "Failed to clear ${service_name} listener on port ${port}. Remaining PID(s): ${pids}"
        return 1
    fi

    ok "Cleared ${service_name} listener on port ${port}"
}

build_theia_artifacts() {
    local reason="$1"
    info "Building Theia artifacts (${reason})..."
    yarn --cwd "$PROJECT_DIR" build:extensions > "$THEIA_BUILD_LOG_FILE" 2>&1 || {
        err "Failed to build extensions; see ${THEIA_BUILD_LOG_FILE}"
        return 1
    }
    yarn --cwd "$PROJECT_DIR" build:browser >> "$THEIA_BUILD_LOG_FILE" 2>&1 || {
        err "Failed to build browser app; see ${THEIA_BUILD_LOG_FILE}"
        return 1
    }
    ok "Theia build artifacts generated"
}

ensure_theia_artifacts() {
    if [[ ! -f "$THEIA_BACKEND_MAIN" || ! -d "$CORE_EXT_LIB_DIR" || ! -d "$CHAT_EXT_LIB_DIR" ]]; then
        build_theia_artifacts "missing artifacts"
    fi
}

start_opencode() {
    local opencode_bin
    opencode_bin="$(resolve_opencode)"
    info "Starting OpenCode server (${opencode_bin} serve --port ${OPENCODE_PORT})..."
    "$opencode_bin" serve --port "$OPENCODE_PORT" > "$OPENCODE_LOG_FILE" 2>&1 &
    OPENCODE_PID=$!
    info "OpenCode PID: ${OPENCODE_PID}  (logs: ${OPENCODE_LOG_FILE})"
}

start_theia() {
    info "Starting Theia (yarn start:browser)..."
    THEIA_CONFIG_DIR="$(mktemp -d /tmp/theia-e2e.XXXXXX)" \
    yarn --cwd "$PROJECT_DIR" start:browser > "$THEIA_LOG_FILE" 2>&1 &
    THEIA_PID=$!
    info "Theia PID: ${THEIA_PID}  (logs: ${THEIA_LOG_FILE})"
}

report_theia_probe_details() {
    err "Theia strict readiness diagnostics:"
    err "  - Theia root: ${PROBE_THEIA_ROOT_DETAIL}"
    err "  - Hub instructions: ${PROBE_HUB_INSTRUCTIONS_DETAIL}"
    err "  - Hub MCP mount: ${PROBE_HUB_MCP_DETAIL}"
    err "  - Theia logs: ${THEIA_LOG_FILE}"
    err "  - Build logs: ${THEIA_BUILD_LOG_FILE}"
}

recover_theia_stack() {
    warn "Theia port ${THEIA_PORT} is reachable but strict probes failed."
    report_theia_probe_details
    warn "Attempting deterministic self-heal: stop listener -> rebuild artifacts -> restart -> strict re-probe"

    kill_listener_on_port "$THEIA_PORT" "Theia" || return 1
    build_theia_artifacts "strict probe recovery" || return 1
    start_theia
    if ! wait_ready "probe_theia_stack" "Theia strict probes after recovery"; then
        report_theia_probe_details
        return 1
    fi

    ok "Theia self-heal completed; strict probes now pass"
}

recover_opencode_stack() {
    warn "OpenCode port ${OPENCODE_PORT} is reachable but API strict probe failed (${PROBE_OPENCODE_API_DETAIL})."
    warn "Attempting OpenCode self-heal: stop stale listener -> restart -> strict re-probe"
    warn "OpenCode logs: ${OPENCODE_LOG_FILE}"

    kill_listener_on_port "$OPENCODE_PORT" "OpenCode" || return 1
    start_opencode
    if ! wait_ready "probe_opencode_api" "OpenCode API (/project) after recovery"; then
        err "OpenCode strict probe still failing after recovery (${PROBE_OPENCODE_API_DETAIL})."
        err "Inspect logs: ${OPENCODE_LOG_FILE}"
        return 1
    fi

    ok "OpenCode self-heal completed; API probe now passes"
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
    local_status=0
    echo "Readiness Probe Status"
    echo "======================"
    status_probe "Theia root (GET /)" "probe_theia_root" "PROBE_THEIA_ROOT_DETAIL" || local_status=1
    status_probe "Hub instructions (GET /openspace/instructions)" "probe_hub_instructions" "PROBE_HUB_INSTRUCTIONS_DETAIL" || local_status=1
    status_probe "Hub MCP mount (POST /mcp)" "probe_hub_mcp" "PROBE_HUB_MCP_DETAIL" || local_status=1
    status_probe "OpenCode API (GET /project)" "probe_opencode_api" "PROBE_OPENCODE_API_DETAIL" || local_status=1
    exit "$local_status"
fi

if ! status_probe "OpenCode API (GET /project)" "probe_opencode_api" "PROBE_OPENCODE_API_DETAIL" >/dev/null 2>&1; then
    if service_reachable "$OPENCODE_URL"; then
        if ! wait_startup_grace_for_probe "probe_opencode_api" "OpenCode API (/project)"; then
            recover_opencode_stack || {
                err "OpenCode recovery failed; cannot continue."
                exit 1
            }
        fi
    fi
fi

if ! status_probe "Theia root (GET /)" "probe_theia_root" "PROBE_THEIA_ROOT_DETAIL" >/dev/null 2>&1 || \
   ! status_probe "Hub instructions (GET /openspace/instructions)" "probe_hub_instructions" "PROBE_HUB_INSTRUCTIONS_DETAIL" >/dev/null 2>&1 || \
   ! status_probe "Hub MCP mount (POST /mcp)" "probe_hub_mcp" "PROBE_HUB_MCP_DETAIL" >/dev/null 2>&1; then
    if service_reachable "$THEIA_URL"; then
        if ! wait_startup_grace_for_probe "probe_theia_stack" "Theia strict probes"; then
            recover_theia_stack || {
                err "Theia recovery failed; cannot continue."
                exit 1
            }
        fi
    fi
fi

if probe_opencode_api; then
    ok "OpenCode already running with healthy API at ${OPENCODE_URL}"
else
    start_opencode
    wait_ready "probe_opencode_api" "OpenCode API (/project)"
fi

# ── Theia ─────────────────────────────────────────────────────────────────────
ensure_theia_artifacts

if probe_theia_stack; then
    ok "Theia already running with healthy hub routes at ${THEIA_URL}"
else
    start_theia
    wait_ready "probe_theia_stack" "Theia strict probes"
fi

if ! probe_all_services; then
    err "Strict readiness probes failed after startup. Running diagnostics..."
    status_probe "Theia root (GET /)" "probe_theia_root" "PROBE_THEIA_ROOT_DETAIL" || true
    status_probe "Hub instructions (GET /openspace/instructions)" "probe_hub_instructions" "PROBE_HUB_INSTRUCTIONS_DETAIL" || true
    status_probe "Hub MCP mount (POST /mcp)" "probe_hub_mcp" "PROBE_HUB_MCP_DETAIL" || true
    status_probe "OpenCode API (GET /project)" "probe_opencode_api" "PROBE_OPENCODE_API_DETAIL" || true

    if service_reachable "$THEIA_URL"; then
        if ! wait_startup_grace_for_probe "probe_theia_stack" "Theia strict probes"; then
            recover_theia_stack || true
        fi
    fi
    if service_reachable "$OPENCODE_URL"; then
        if ! wait_startup_grace_for_probe "probe_opencode_api" "OpenCode API (/project)"; then
            recover_opencode_stack || true
        fi
    fi

    if ! probe_all_services; then
        err "Strict readiness probes still failing after recovery attempts."
        report_theia_probe_details
        err "OpenCode diagnostics: ${PROBE_OPENCODE_API_DETAIL}"
        err "OpenCode logs: ${OPENCODE_LOG_FILE}"
        exit 1
    fi
fi

# ── Done ──────────────────────────────────────────────────────────────────────
ok "=== Strict readiness probes passed ==="
ok "  Theia:    ${THEIA_URL}"
ok "  OpenCode: ${OPENCODE_URL}"
exit 0
