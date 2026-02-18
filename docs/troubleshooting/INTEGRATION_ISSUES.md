# OpenSpace Integration Issues - Troubleshooting Guide

**Version:** 1.0  
**Created:** 2026-02-16  
**Purpose:** Common integration issues and their solutions

---

## Table of Contents

1. [Startup Issues](#startup-issues)
2. [Configuration Problems](#configuration-problems)
3. [Connection Errors](#connection-errors)
4. [Message Flow Issues](#message-flow-issues)
5. [Diagnostic Commands](#diagnostic-commands)
6. [When to Restart Components](#when-to-restart-components)
7. [Known Limitations](#known-limitations)

---

## Startup Issues

### Issue: Port Already in Use

**Symptoms:**
```
Error: listen EADDRINUSE: address already in use :::3000
```

**Diagnosis:**
```bash
lsof -i :3000
```

**Solutions:**

1. **Kill the process using the port:**
   ```bash
   kill $(lsof -t -i:3000)
   ```

2. **Wait a few seconds and try again:**
   ```bash
   sleep 5 && yarn start:browser
   ```

3. **Use a different port (if needed):**
   ```bash
   yarn start:browser --port 3001
   ```
   Note: If using different port, update OpenCode instructions URL.

---

### Issue: Module Not Found Errors

**Symptoms:**
```
Error: Cannot find module '@theia/core/lib/...'
Error: Cannot find module '../backend/...'
```

**Diagnosis:**
Check if `node_modules` is complete:
```bash
ls -la node_modules/@theia/core/
```

**Solutions:**

1. **Reinstall dependencies:**
   ```bash
   yarn install
   ```

2. **Clean install (if persistent):**
   ```bash
   rm -rf node_modules yarn.lock
   yarn install
   ```

3. **Rebuild after dependency changes:**
   ```bash
   yarn build
   ```

---

### Issue: Build Artifacts Missing

**Symptoms:**
```
Error: Cannot find module '../lib/backend/main'
```
or
```
Cannot GET /
```

**Diagnosis:**
```bash
ls -la browser-app/lib/
```

**Solution:**
```bash
yarn build
```

**Expected:** Directory `browser-app/lib/` should exist with subdirectories `backend/`, `frontend/`, `build/`.

---

### Issue: Extension Not Loading

**Symptoms:**
- Hub endpoint returns 404
- Chat widget not visible
- Commands not registered

**Diagnosis:**
Check backend logs for extension loading:
```bash
grep -i "OpenSpaceCore\|Hub\|Bridge" /tmp/openspace-startup.log
```

**Expected Output:**
```
[OpenSpaceCore] Backend module loaded
[Hub] OpenSpace Hub configured
[BridgeContribution] Starting...
```

**Solutions:**

1. **Rebuild the application:**
   ```bash
   yarn build
   ```

2. **Check extension is in package.json:**
   ```bash
   cat browser-app/package.json | grep openspace-core
   ```

3. **Verify extension compiles:**
   ```bash
   cd extensions/openspace-core
   yarn build
   ```

---

## Configuration Problems

### Issue: OpenCode Not Installed

**Symptoms:**
```bash
$ opencode --version
command not found: opencode
```

**Solution:**

1. **Install OpenCode** (follow official installation guide)

2. **Verify installation:**
   ```bash
   which opencode
   opencode --version
   ```

3. **Configure OpenCode:**
   ```bash
   opencode init
   ```

---

### Issue: Instructions URL Not Configured

**Symptoms:**
- OpenCode doesn't know about OpenSpace commands
- Agent doesn't list IDE commands when asked

**Diagnosis:**
```bash
cat ~/.opencode/opencode.json
```

**Expected:**
```json
{
  "instructions": ["http://localhost:3000/openspace/instructions"]
}
```

**Solution:**

1. **Add instructions URL manually:**
   ```bash
   cat > ~/.opencode/opencode.json << 'EOF'
   {
     "instructions": ["http://localhost:3000/openspace/instructions"]
   }
   EOF
   ```

2. **Or edit existing config:**
   ```bash
   vim ~/.opencode/opencode.json
   ```
   Add the instructions array.

3. **Restart OpenCode:**
   ```bash
   opencode restart
   ```

---

### Issue: Wrong Port in Configuration

**Symptoms:**
- OpenCode cannot fetch instructions
- Connection refused errors

**Diagnosis:**
```bash
# Check OpenCode config
cat ~/.opencode/opencode.json | grep instructions

# Verify OpenSpace is running on correct port
lsof -i :3000
```

**Solution:**
Update instructions URL to match actual port:
```bash
# If OpenSpace runs on 3000 (default)
"instructions": ["http://localhost:3000/openspace/instructions"]

# If you changed the port
"instructions": ["http://localhost:<your-port>/openspace/instructions"]
```

---

## Connection Errors

### Issue: Hub Endpoint Returns 404

**Symptoms:**
```bash
$ curl http://localhost:3000/openspace/instructions
Cannot GET /openspace/instructions
```

**Diagnosis:**

1. **Check if Hub is loaded:**
   ```bash
   grep "Hub.*configured" /tmp/openspace-startup.log
   ```

2. **Check backend is running:**
   ```bash
   lsof -i :3000 | grep node
   ```

**Solutions:**

1. **Rebuild (Hub may not be in build):**
   ```bash
   yarn build
   yarn start:browser
   ```

2. **Check Hub implementation exists:**
   ```bash
   ls extensions/openspace-core/src/node/hub.ts
   ```

3. **Verify Hub is bound in backend module:**
   ```bash
   grep -i "OpenSpaceHub" extensions/openspace-core/src/node/openspace-core-backend-module.ts
   ```

---

### Issue: Manifest Not Publishing

**Symptoms:**
Hub endpoint returns:
```markdown
## Available Commands
(No commands registered yet. The IDE is still initializing.)
```

**Diagnosis:**

1. **Check BridgeContribution started:**
   ```bash
   grep "BridgeContribution" /tmp/openspace-startup.log
   ```

2. **Check for errors during manifest publish:**
   ```bash
   grep -i "manifest\|error" /tmp/openspace-startup.log
   ```

**Solutions:**

1. **Wait longer** (30-60 seconds after startup):
   ```bash
   sleep 30
   curl http://localhost:3000/openspace/instructions
   ```

2. **Refresh browser** to trigger frontend reload:
   - Open http://localhost:3000
   - Press Cmd+Shift+R (hard refresh)

3. **Check frontend console** for errors:
   - Open browser DevTools (F12)
   - Look for errors related to BridgeContribution

4. **Restart OpenSpace:**
   ```bash
   # Kill processes
   pkill -f "theia start"
   
   # Start fresh
   yarn start:browser
   ```

---

### Issue: SSE Connection Fails

**Symptoms:**
- Messages send but no response streams
- Console shows "SSE connection closed"
- No events received in browser

**Diagnosis:**

1. **Check backend SSE endpoint:**
   ```bash
   curl http://localhost:3000/events
   ```
   Should hang (waiting for events) - this is correct.

2. **Check OpenCode can reach backend:**
   ```bash
   # From OpenCode logs
   grep "SSE\|event" ~/.opencode/logs/opencode.log
   ```

**Solutions:**

1. **Check firewall settings:**
   - Ensure localhost connections allowed
   - Disable firewall temporarily to test

2. **Verify SSE client setup in frontend:**
   ```bash
   grep -i "EventSource\|SSE" extensions/openspace-core/src/browser/bridge-contribution.ts
   ```

3. **Check for proxy interference:**
   - SSE requires direct connection
   - No HTTP proxies should intercept

---

## Message Flow Issues

### Issue: Messages Send But No Response

**Symptoms:**
- User message appears in chat
- No agent response
- No errors in console

**Diagnosis:**

1. **Check OpenCode is running:**
   ```bash
   ps aux | grep opencode
   lsof -i :3333
   ```

2. **Check backend logs:**
   ```bash
   grep -i "opencode\|message\|error" /tmp/openspace-startup.log
   ```

3. **Check network requests:**
   - Open browser DevTools → Network tab
   - Send message
   - Look for POST to `/services/opencode/...`

**Solutions:**

1. **Verify OpenCode is running:**
   ```bash
   opencode start
   ```

2. **Check OpenCode logs for errors:**
   ```bash
   tail -f ~/.opencode/logs/opencode.log
   ```

3. **Test OpenCode directly:**
   ```bash
   curl -X POST http://localhost:3333/v1/messages \
     -H "Content-Type: application/json" \
     -d '{"message":"Hello"}'
   ```

4. **Check API key configuration** (if OpenCode requires it)

---

### Issue: Response Doesn't Stream

**Symptoms:**
- Response appears all at once (not character-by-character)
- No streaming indicator shown

**Diagnosis:**

1. **Check browser console for SSE events:**
   - Open DevTools → Console
   - Look for "message.partial" logs

2. **Check SyncService is receiving events:**
   ```bash
   grep -i "sync\|partial" /tmp/openspace-startup.log
   ```

**Solutions:**

1. **Verify SSE connection established:**
   - Check browser DevTools → Network tab
   - Look for `/events` connection (type: eventsource)

2. **Check event handling in SyncService:**
   ```bash
   grep "handleMessagePartial" extensions/openspace-core/src/browser/sync-service.ts
   ```

3. **Restart both OpenSpace and OpenCode:**
   ```bash
   pkill -f "theia start"
   opencode restart
   yarn start:browser
   ```

---

### Issue: Context Not Maintained Between Messages

**Symptoms:**
- Agent forgets previous messages
- Each message treated as new conversation

**Diagnosis:**

1. **Check session state:**
   - Browser DevTools → Console
   - Type: `window.sessionService` (if exposed for debugging)

2. **Check conversation history being sent:**
   - Browser DevTools → Network tab
   - Inspect POST to OpenCode
   - Verify "messages" array contains history

**Solutions:**

1. **Verify SessionService maintains history:**
   ```bash
   grep -A 5 "sendMessage" extensions/openspace-core/src/browser/session-service.ts
   ```

2. **Check for session switching issues:**
   - Ensure active session hasn't changed
   - Check session dropdown shows correct session

3. **Clear browser cache and reload:**
   ```bash
   # In browser
   Cmd+Shift+Delete → Clear cache → Reload
   ```

---

## Diagnostic Commands

### Quick Health Check

```bash
# 1. Check OpenSpace is running
lsof -i :3000 | grep LISTEN

# 2. Check Hub endpoint
curl -s http://localhost:3000/openspace/instructions | head -20

# 3. Check OpenCode is running
lsof -i :3333 | grep LISTEN

# 4. Check recent logs
tail -50 /tmp/openspace-startup.log

# 5. Check for errors
grep -i error /tmp/openspace-startup.log | tail -10
```

### Full System Status

```bash
#!/bin/bash
echo "=== OpenSpace Status ==="
echo "Theia: $(lsof -i :3000 | grep LISTEN > /dev/null && echo '✓ Running' || echo '✗ Not running')"
echo "OpenCode: $(lsof -i :3333 | grep LISTEN > /dev/null && echo '✓ Running' || echo '✗ Not running')"
echo ""
echo "=== Hub Endpoint ==="
curl -s http://localhost:3000/openspace/instructions | head -5
echo ""
echo "=== Recent Errors ==="
grep -i error /tmp/openspace-startup.log | tail -5
```

### Capture Full Diagnostic Info

```bash
#!/bin/bash
# Save comprehensive diagnostic info
DIAG_FILE="/tmp/openspace-diagnostic-$(date +%Y%m%d-%H%M%S).txt"

{
  echo "=== OpenSpace Diagnostic Report ==="
  echo "Generated: $(date)"
  echo ""
  
  echo "=== Process Status ==="
  ps aux | grep -E "(theia|opencode|node)" | grep -v grep
  echo ""
  
  echo "=== Port Usage ==="
  lsof -i :3000
  lsof -i :3333
  echo ""
  
  echo "=== Hub Endpoint ==="
  curl -s http://localhost:3000/openspace/instructions
  echo ""
  
  echo "=== OpenCode Config ==="
  cat ~/.opencode/opencode.json 2>/dev/null || echo "Config not found"
  echo ""
  
  echo "=== Recent Logs (last 100 lines) ==="
  tail -100 /tmp/openspace-startup.log
  echo ""
  
  echo "=== Errors in Logs ==="
  grep -i error /tmp/openspace-startup.log
  
} > "$DIAG_FILE"

echo "Diagnostic info saved to: $DIAG_FILE"
```

---

## When to Restart Components

### Restart OpenSpace When:

- ✅ Configuration files changed
- ✅ New extension added
- ✅ Code changes in backend
- ✅ Hub endpoint not responding
- ✅ Manifest not publishing after 60 seconds
- ✅ Memory leaks suspected (high memory usage)

**How to Restart:**
```bash
# Kill all processes
pkill -f "theia start"

# Wait for cleanup
sleep 3

# Start fresh
yarn start:browser
```

---

### Restart OpenCode When:

- ✅ Instructions URL changed in config
- ✅ OpenCode not responding to requests
- ✅ SSE connection issues
- ✅ Agent doesn't know about new commands

**How to Restart:**
```bash
opencode restart
```

Or manually:
```bash
opencode stop
sleep 2
opencode start
```

---

### Rebuild When:

- ✅ Source code changed in extensions
- ✅ New dependencies added
- ✅ Module not found errors
- ✅ Extension not loading
- ✅ After pulling latest code from git

**How to Rebuild:**
```bash
yarn build
```

Full clean rebuild:
```bash
yarn clean
yarn install
yarn build
```

---

### Refresh Browser When:

- ✅ Manifest not updating in UI
- ✅ Chat widget not appearing
- ✅ UI showing stale data
- ✅ JavaScript errors in console

**How to Refresh:**
- Regular: Cmd+R (Mac) or Ctrl+R (Win/Linux)
- Hard refresh: Cmd+Shift+R (Mac) or Ctrl+Shift+R (Win/Linux)
- Clear cache: Cmd+Shift+Delete, select cache, reload

---

## Known Limitations

### 1. Browser Automation Timeouts

**Issue:** Playwright snapshots may timeout if page loads slowly.

**Workaround:** Use manual browser testing instead of automation.

**Not a bug:** This is a test infrastructure limitation.

---

### 2. Manifest Publish Timing

**Issue:** Commands may not appear in Hub endpoint immediately after startup.

**Workaround:** Wait 30-60 seconds or refresh browser.

**Potential improvement:** Add retry logic to BridgeContribution.

---

### 3. TypeScript Compilation Warnings

**Issue:** Build shows warnings about Monaco editor dependencies.

**Impact:** None - warnings can be ignored.

**Status:** Upstream issue in @theia/monaco-editor-core.

---

### 4. SSE Connection Limits

**Issue:** Some browsers limit concurrent SSE connections.

**Workaround:** Close other tabs with OpenSpace if connection fails.

**Browsers affected:** Chrome (6 connections per domain), Firefox (unlimited).

---

### 5. OpenCode Installation

**Issue:** OpenCode is not included with OpenSpace.

**Workaround:** Install separately from https://opencode.dev

**Status:** External dependency - not part of OpenSpace.

---

## Getting Help

If you've tried all troubleshooting steps and still have issues:

1. **Collect diagnostic info:**
   ```bash
   # Run diagnostic script (see above)
   ./scripts/diagnose.sh
   ```

2. **Check existing issues:**
   - Search project issue tracker
   - Look for similar problems

3. **Create detailed bug report:**
   - Include diagnostic output
   - Steps to reproduce
   - Expected vs actual behavior
   - Environment details (OS, Node version, etc.)

4. **Ask for help:**
   - Project Discord/Slack
   - GitHub Discussions
   - Team channels

---

## Appendix: Log Patterns to Watch For

### Good Patterns (Everything Working)

```
[Hub] OpenSpace Hub configured
[BridgeContribution] Starting...
[BridgeContribution] Published manifest with X commands
Theia app listening on http://127.0.0.1:3000
```

### Warning Patterns (May Indicate Issues)

```
TypeError: this.target[method] is not a function
Connection refused (ECONNREFUSED)
No commands registered yet
```

### Error Patterns (Definite Problems)

```
Error: Cannot find module
Error: listen EADDRINUSE
Error: Failed to fetch instructions
TypeError: Cannot read property 'X' of undefined
```

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-16  
**Maintainer:** Builder (builder_7a3f)  
**Next Review:** After Phase 1 completion
