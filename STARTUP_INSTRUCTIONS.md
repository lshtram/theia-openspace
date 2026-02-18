# Quick Start Instructions

## ✅ Build Complete - Ready to Test!

### What Was Fixed

**Issue 1: eventsource-parser API mismatch**
- Fixed import to use `ParsedEvent` and `ParseEvent` 
- Updated parser creation to use callback-style API
- Build now succeeds ✅

**Issue 2: RPC protocol error**
- Removed invalid `onDidCloseConnection()` call
- JsonRpcConnectionHandler simplified
- No more "this.target[method] is not a function" error ✅

---

## Start the Application

```bash
cd /Users/Shared/dev/theia-openspace
yarn start:browser
```

**Expected Console Output:**
```
[OpenSpaceCore] Backend module loaded - OpenCodeService exposed at /services/opencode
[Hub] OpenSpace Hub configured
Theia app listening on http://127.0.0.1:3000
```

---

## Access the Application

Open your browser: **http://localhost:3000**

The application should load in 3-5 seconds.

---

## Quick Smoke Test (2 minutes)

### 1. Verify IDE Loads
- [ ] Theia IDE loads (no infinite spinner)
- [ ] Window title shows "Theia Openspace"
- [ ] File explorer visible on left
- [ ] No fatal errors in browser console (F12)

### 2. Test Chat Panel
- [ ] Chat panel visible in sidebar (chat icon)
- [ ] Type "Hello" and press Enter
- [ ] Echo agent responds: "Echo: Hello"

### 3. Test Terminal
- [ ] View → Terminal → New Terminal
- [ ] Terminal opens at bottom
- [ ] Can type commands

### 4. Verify Filtered Features
These should **NOT** be visible:
- [ ] No Debug panel
- [ ] No SCM (Source Control) panel
- [ ] No Notebook options

---

## Test Hub Endpoints

Open a new terminal (keep the server running) and test:

```bash
# Test instructions endpoint
curl http://localhost:3000/openspace/instructions

# Test manifest endpoint
curl -X POST http://localhost:3000/manifest \
  -H "Content-Type: application/json" \
  -d '{"commands": [], "timestamp": "2026-02-16T00:00:00Z"}'

# Test SSE endpoint (will keep connection open - Ctrl+C to exit)
curl -N http://localhost:3000/events
```

---

## Expected Behavior

### What Works WITHOUT OpenCode Server ✅

1. **Full Theia IDE**
   - File explorer, editor, terminal
   - Monaco editor with syntax highlighting
   - Search functionality
   - Preferences/settings

2. **Chat Panel**
   - Echo agent responds to messages
   - Message history visible
   - UI renders correctly

3. **Hub Endpoints**
   - All 5 endpoints respond
   - SSE connection stays open
   - No connection errors

4. **Custom Features**
   - Branding applied
   - Filtered features removed
   - All 6 extensions loaded

### What Requires OpenCode Server ⚠️

1. **Session Management**
   - Create/switch/delete sessions
   - Session list in dropdown

2. **Real AI Responses**
   - Actual AI agent (not echo)
   - Command execution
   - Streaming responses

3. **IDE State Sync**
   - Command manifest discovery
   - Pane state tracking
   - Permission dialogs

---

## Browser Console Messages (Normal)

You will see these messages - they are **expected and normal**:

```
[OpenSpaceFilter] Filtering out contribution: DebugPrefixConfiguration
[OpenSpaceFilter] Filtering out contribution: ScmContribution
[BridgeContribution] Starting...
[OpenCodeProxy] SSE connection failed: ECONNREFUSED (OpenCode not running - expected)
```

---

## Troubleshooting

### Issue: Infinite Loading Spinner

**Cause:** RPC protocol error (should be fixed now)

**Solution:**
1. Stop server (Ctrl+C)
2. Clear browser cache (Cmd+Shift+R)
3. Restart: `yarn start:browser`

### Issue: Port 3000 Already in Use

```bash
# Find process using port 3000
lsof -i :3000

# Kill the process
kill -9 <PID>
```

### Issue: Build Errors

```bash
# Clean rebuild
yarn clean
yarn install
yarn build
```

### Issue: Blank Screen

1. Check browser console (F12) for errors
2. Try different browser (Chrome recommended)
3. Check server console for backend errors

---

## Performance Expectations

- **Startup time:** 2-3 seconds
- **Browser load:** 3-5 seconds
- **Memory usage:** ~150-200 MB
- **CPU usage:** ~1-5% idle

---

## Next Steps

1. **Complete Scenario 1-5** from `MANUAL_TESTING_GUIDE.md`
2. **Set up OpenCode server** for full testing (Scenarios 6-8)
3. **Report any issues** you encounter

---

## Need Help?

1. Check `MANUAL_TESTING_GUIDE.md` for detailed scenarios
2. Review browser console (F12) for errors
3. Check server console for backend issues
4. Verify Node version: `node --version` (should be ≥18)

---

## Success Criteria ✅

The application is working correctly if:
- ✅ No infinite loading spinner
- ✅ Theia IDE loads with file explorer
- ✅ Chat panel responds to messages
- ✅ Terminal opens and works
- ✅ No Debug/SCM panels visible
- ✅ No RPC errors in console

---

**You're ready to test! 🚀**

Start the server: `yarn start:browser`  
Open browser: http://localhost:3000
