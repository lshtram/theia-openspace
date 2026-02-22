#!/bin/bash

# =============================================================================
# OpenSpace Server Management Script
# =============================================================================
# Usage:
#   ./scripts/servers.sh start     - Start all servers
#   ./scripts/servers.sh stop     - Stop all servers  
#   ./scripts/servers.sh status   - Check server status
#   ./scripts/servers.sh restart  - Restart all servers
# =============================================================================

set -e

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Server configuration
THEIA_PORT=3000
OPENCODE_PORT=7890

# Get the directory where this script is located
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"

echo_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

echo_success() {
    echo -e "${GREEN}[OK]${NC} $1"
}

echo_warning() {
    echo -e "${YELLOW}[WARN]${NC} $1"
}

echo_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

# Check if a port is in use
check_port() {
    local port=$1
    if lsof -i:$port > /dev/null 2>&1; then
        return 0  # Port is in use
    else
        return 1  # Port is free
    fi
}

# Get PID using a port
get_pid_by_port() {
    local port=$1
    lsof -ti:$port 2>/dev/null || echo ""
}

# Kill process by PID — sends SIGTERM first and waits up to 10 seconds for a
# graceful exit before escalating to SIGKILL as a last resort.
kill_process() {
    local pid=$1
    if [ -n "$pid" ]; then
        echo_status "Sending SIGTERM to process $pid (graceful stop)..."
        kill $pid 2>/dev/null || true
        # Wait up to 10 seconds for graceful shutdown
        local i=0
        while [ $i -lt 10 ]; do
            sleep 1
            i=$((i + 1))
            if ! kill -0 $pid 2>/dev/null; then
                echo_success "Process $pid exited gracefully"
                return
            fi
        done
        # Escalate to SIGKILL only if process is still running after grace period
        if kill -0 $pid 2>/dev/null; then
            echo_warning "Process $pid did not exit within 10s — sending SIGKILL"
            kill -9 $pid 2>/dev/null || true
        fi
    fi
}

# Stop all servers
stop_servers() {
    echo_status "Stopping all servers..."
    
    # Stop Theia (port 3000)
    if check_port $THEIA_PORT; then
        local theia_pid=$(get_pid_by_port $THEIA_PORT)
        if [ -n "$theia_pid" ]; then
            kill_process $theia_pid
            echo_success "Theia (port $THEIA_PORT) stopped"
        fi
    else
        echo_status "Theia (port $THEIA_PORT) not running"
    fi
    
    # Stop OpenCode server (port 7890)
    if check_port $OPENCODE_PORT; then
        local opencode_pid=$(get_pid_by_port $OPENCODE_PORT)
        if [ -n "$opencode_pid" ]; then
            kill_process $opencode_pid
            echo_success "OpenCode server (port $OPENCODE_PORT) stopped"
        fi
    else
        echo_status "OpenCode server (port $OPENCODE_PORT) not running"
    fi
    
    echo_success "All servers stopped"
}

# Start all servers
start_servers() {
    echo_status "Starting all servers..."
    
    # Check if Theia is already running
    if check_port $THEIA_PORT; then
        echo_warning "Theia is already running on port $THEIA_PORT"
    else
        echo_status "Starting Theia on port $THEIA_PORT..."
        cd "$PROJECT_DIR"
        yarn start:browser "$PROJECT_DIR" > /tmp/theia.log 2>&1 &
        THEIA_PID=$!
        echo_status "Theia started (PID: $THEIA_PID)"
        
        # Wait for Theia to be ready
        echo_status "Waiting for Theia to be ready..."
        local count=0
        while [ $count -lt 30 ]; do
            if curl -s http://localhost:$THEIA_PORT > /dev/null 2>&1; then
                break
            fi
            sleep 1
            count=$((count + 1))
        done
        
        if [ $count -lt 30 ]; then
            echo_success "Theia is ready"
        else
            echo_error "Theia failed to start within 30 seconds"
        fi
    fi
    
    # Check if OpenCode server is already running
    if check_port $OPENCODE_PORT; then
        echo_warning "OpenCode server is already running on port $OPENCODE_PORT"
    else
        echo_status "Note: OpenCode server should be started separately"
        echo_status "If you need to start OpenCode server, run: opencode dev"
    fi
    
    echo_success "All servers started"
    echo ""
    echo "========================================"
    echo -e "${GREEN}Servers are running:${NC}"
    echo "  - Theia IDE:  http://localhost:$THEIA_PORT"
    echo "  - OpenCode:   http://localhost:$OPENCODE_PORT (if running)"
    echo "========================================"
}

# Check server status
status() {
    echo "Server Status:"
    echo "=============="
    
    # Check Theia
    if check_port $THEIA_PORT; then
        local theia_pid=$(get_pid_by_port $THEIA_PORT)
        echo -e "${GREEN}●${NC} Theia - RUNNING (PID: $theia_pid, Port: $THEIA_PORT)"
    else
        echo -e "${RED}●${NC} Theia - NOT RUNNING (Port: $THEIA_PORT)"
    fi
    
    # Check OpenCode
    if check_port $OPENCODE_PORT; then
        local opencode_pid=$(get_pid_by_port $OPENCODE_PORT)
        echo -e "${GREEN}●${NC} OpenCode Server - RUNNING (PID: $opencode_pid, Port: $OPENCODE_PORT)"
    else
        echo -e "${YELLOW}●${NC} OpenCode Server - NOT RUNNING (Port: $OPENCODE_PORT)"
    fi
    
    echo ""
    echo "To access Theia: http://localhost:$THEIA_PORT"
}

# Main script
case "${1:-}" in
    start)
        start_servers
        ;;
    stop)
        stop_servers
        ;;
    status)
        status
        ;;
    restart)
        stop_servers
        sleep 2
        start_servers
        ;;
    *)
        echo "Usage: $0 {start|stop|status|restart}"
        echo ""
        echo "Commands:"
        echo "  start   - Start all servers"
        echo "  stop    - Stop all servers"
        echo "  status  - Show server status"
        echo "  restart - Restart all servers"
        exit 1
        ;;
esac
