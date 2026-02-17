# Theia OpenSpace - Manual Testing Guide

**Last Updated:** 2026-02-16  
**Project Phase:** Phase 1 (93% Complete - 13/14 tasks)  
**Branch:** `feature/phase-1-foundation`

---

## Quick Start

### 1. Build the Application

```bash
cd /Users/Shared/dev/theia-openspace

# Install dependencies (if not done)
yarn install

# Build extensions and browser app
yarn build
```

**Expected:** Build completes successfully (warnings about Monaco editor are normal).

### 2. Start the Application

```bash
yarn start:browser
```

**Expected Output:**
```
root INFO [BackendApplication] Theia app listening on http://localhost:3000
[Hub] OpenSpace Hub configured
```

### 3. Access the Application

Open your browser and navigate to: **http://localhost:3000**

---

## What's Implemented (Phase 1 - 93% Complete)

### ✅ Core Infrastructure
- [x] Theia IDE (v1.68.2) with custom branding
- [x] Monorepo structure with 6 extensions
- [x] Custom feature filtering (Debug, SCM, Notebook removed)
- [x] CI/CD pipeline

### ✅ Backend Services
- [x] OpenCode REST API proxy (23 methods)
- [x] Hub server with 5 endpoints
- [x] SSE (Server-Sent Events) streaming
- [x] RPC protocol definitions
- [x] Backend dependency injection

### ✅ Frontend Services
- [x] Session management service
- [x] Chat widget with React
- [x] Bridge contribution (command discovery)
- [x] Sync service (streaming support)
- [x] Frontend dependency injection

### ⏳ In Progress
- [ ] Task 1.13: Integration testing (5/8 scenarios complete)
- [ ] Task 1.14: Permission UI dialog

---

## Testing Scenarios

## Scenario 1: Basic IDE Functionality ✅

### 1.1 Window Branding
- [ ] Browser tab title shows "Theia Openspace"
- [ ] Custom CSS styling is applied

### 1.2 Feature Filtering
Verify these features are **NOT visible**:
- [ ] No Debug panel in sidebar
- [ ] No SCM (Source Control) panel
- [ ] No Notebook editor options

### 1.3 Core Features Work
- [ ] File Explorer opens (View → Explorer or left sidebar)
- [ ] Terminal works (View → Terminal → New Terminal)
- [ ] Editor opens files (click any file in explorer)
- [ ] Search panel works (left sidebar search icon)
- [ ] Monaco editor with syntax highlighting

### 1.4 Extension Loading
Open DevTools Console (F12) and check:
- [ ] No extension load errors
- [ ] See `[Hub] OpenSpace Hub configured` message

**Status:** ✅ Should work without OpenCode server

---

## Scenario 2: AI Chat Panel ✅

### 2.1 Open Chat
- [ ] Chat panel visible in sidebar (chat icon)
- [ ] Can also open via View → Chat

### 2.2 Echo Agent Test
1. Type: `Hello OpenSpace`
2. Press Enter or click Send
3. **Expected:** Agent responds with `Echo: Hello OpenSpace`

### 2.3 Message History
- [ ] Previous messages remain visible
- [ ] Scrollable message list

**Status:** ✅ Works without OpenCode server (echo agent only)

---

## Scenario 3: Hub Server Endpoints ✅

### 3.1 Instructions Endpoint

```bash
curl http://localhost:3000/openspace/instructions
```

**Expected Response:**
```json
{
  "systemPrompt": "You are OpenSpace, an AI-powered IDE assistant...",
  "availableCommands": [],
  "manifest": null,
  "paneState": null
}
```

### 3.2 Manifest Endpoint

```bash
curl -X POST http://localhost:3000/manifest \
  -H "Content-Type: application/json" \
  -d '{"commands": [], "timestamp": "2026-02-16T00:00:00Z"}'
```

**Expected Response:**
```json
{"status": "ok"}
```

### 3.3 State Endpoint

```bash
curl -X POST http://localhost:3000/state \
  -H "Content-Type: application/json" \
  -d '{"panes": [], "activeEditor": null}'
```

**Expected Response:**
```json
{"status": "ok"}
```

### 3.4 SSE Events Endpoint

Open in browser or use curl:
```bash
curl -N http://localhost:3000/events
```

**Expected:** Connection stays open, periodic ping events

### 3.5 Commands Endpoint

```bash
curl -X POST http://localhost:3000/commands \
  -H "Content-Type: application/json" \
  -d '{"command": "test", "args": {}}'
```

**Expected Response:**
```json
{"status": "ok"}
```

**Status:** ✅ All endpoints work without OpenCode server

---

## Scenario 4: SSE Connection ✅

### 4.1 Browser DevTools Test
1. Open browser DevTools (F12)
2. Go to Network tab
3. Filter by "events" or "EventStream"
4. Refresh the page

**Expected:**
- [ ] See GET request to `/events`
- [ ] Connection type: `text/event-stream`
- [ ] Connection stays open (Status: Pending)
- [ ] Periodic ping events every 30 seconds

### 4.2 Console Messages
Check browser console for:
- [ ] `[BridgeContribution] SSE connected`
- [ ] No SSE connection errors

**Status:** ✅ Works without OpenCode server

---

## Scenario 5: Session Management UI ⚠️

**Note:** Requires OpenCode server running at `http://localhost:8080`

### 5.1 Without OpenCode Server
- [ ] Chat widget visible
- [ ] Session dropdown may be empty or show "No sessions"
- [ ] Console shows connection errors (expected)

### 5.2 With OpenCode Server

#### Setup
1. Start OpenCode server: `opencode server start` (or equivalent)
2. Verify server is running: `curl http://localhost:8080/health`
3. Refresh Theia OpenSpace

#### Test Session Creation
1. Look for session dropdown in chat widget (top-right)
2. Click "Create New Session" (or similar)
3. Enter project path (e.g., `/Users/Shared/dev/test-project`)
4. **Expected:** New session appears in dropdown

#### Test Session Switching
1. Create 2+ sessions
2. Select different session from dropdown
3. **Expected:** Active session indicator updates

#### Test Session Deletion
1. Select a session
2. Click delete button (or right-click → Delete)
3. Confirm deletion
4. **Expected:** Session removed from list

**Status:** ⚠️ Requires OpenCode server

---

## Scenario 6: Message Streaming ⚠️

**Note:** Requires OpenCode server running

### 6.1 Send Message to AI
1. Ensure OpenCode server is connected
2. Type a message: `Explain TypeScript interfaces`
3. Press Enter

**Expected:**
- [ ] Message appears in chat immediately
- [ ] AI response streams in real-time
- [ ] Markdown formatting rendered
- [ ] Code blocks with syntax highlighting

### 6.2 Streaming States
Watch for these states:
- [ ] `Creating...` (optimistic message creation)
- [ ] `Streaming...` (partial responses)
- [ ] Final formatted response

**Status:** ⚠️ Requires OpenCode server

---

## Scenario 7: Command Discovery ⚠️

**Note:** Requires OpenCode server running

### 7.1 Manifest Synchronization
1. Connect to OpenCode server
2. Open browser console
3. Look for: `[BridgeContribution] Publishing command manifest`

**Expected:**
- [ ] Manifest sent to Hub every 5 seconds
- [ ] Hub `/openspace/instructions` includes commands

### 7.2 Available Commands
```bash
curl http://localhost:3000/openspace/instructions | jq .availableCommands
```

**Expected:** List of Theia commands discovered by BridgeContribution

**Status:** ⚠️ Requires OpenCode server

---

## Scenario 8: Integration Test (Full Round-Trip) ⚠️

**Note:** Requires OpenCode server with proper configuration

This is the comprehensive end-to-end test covering all components.

**Status:** ⏳ 5/8 scenarios completed (3 blocked by OpenCode availability)

See `docs/tests/integration/TEST-PHASE-1-INTEGRATION.md` for detailed procedure.

---

## Known Issues & Limitations

### Expected Issues (Not Bugs)

1. **No OpenCode Server:**
   - Console shows connection errors
   - Session management unavailable
   - AI responses limited to echo agent

2. **Pre-existing Warnings:**
   - TypeScript warnings in Theia's `node_modules`
   - Monaco editor critical dependency warnings
   - These are from Theia itself, not our code

3. **Missing Features:**
   - Permission UI dialog (Task 1.14 - not yet implemented)
   - Advanced chat features (Phase 2)
   - Presentation mode (Phase 4)
   - Whiteboard (Phase 4)

### Actual Bugs

If you encounter issues not listed above, please report:
1. Exact steps to reproduce
2. Browser console errors
3. Server console output
4. Screenshots if UI-related

---

## Browser Compatibility

**Tested Browsers:**
- ✅ Chrome/Edge (Recommended)
- ✅ Firefox
- ⚠️ Safari (may have WebSocket issues)

**Recommended:** Chrome or Edge for best compatibility

---

## Performance Expectations

### Build Time
- **First build:** ~30-60 seconds
- **Incremental builds:** ~10-20 seconds

### Startup Time
- **Server start:** ~2-3 seconds
- **Browser load:** ~3-5 seconds
- **Total time to usable:** ~5-8 seconds

### Runtime
- **Memory usage:** ~150-200 MB (browser)
- **CPU usage:** Low (~1-5% idle, ~10-20% active)

---

## Troubleshooting

### Build Fails

**Issue:** TypeScript errors in build
```bash
# Clean and rebuild
yarn clean
yarn install
yarn build
```

**Issue:** `eventsource-parser` errors
- Already fixed in latest code
- Pull latest changes from branch

### Server Won't Start

**Issue:** Port 3000 already in use
```bash
# Find and kill process using port 3000
lsof -i :3000
kill -9 <PID>
```

**Issue:** Missing dependencies
```bash
# Reinstall dependencies
rm -rf node_modules yarn.lock
yarn install
```

### Browser Issues

**Issue:** Blank screen
1. Check browser console for errors
2. Clear cache and hard reload (Cmd+Shift+R)
3. Try different browser

**Issue:** Extensions not loading
1. Check server console for errors
2. Verify all extensions built: `ls extensions/*/lib`
3. Rebuild: `yarn build:extensions`

### OpenCode Connection Issues

**Issue:** Cannot connect to OpenCode server
1. Verify server is running: `curl http://localhost:8080/health`
2. Check server URL in code (default: `http://localhost:8080`)
3. Check CORS settings on OpenCode server

**Issue:** SSE connection drops
- Expected behavior: Auto-reconnects with exponential backoff
- Check for firewall/proxy issues

---

## Advanced Testing

### Testing with Mock OpenCode Server

You can create a simple mock server for testing:

```javascript
// mock-opencode-server.js
const express = require('express');
const app = express();

app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.get('/projects', (req, res) => res.json({ projects: [] }));
app.get('/sessions', (req, res) => res.json({ sessions: [] }));
app.post('/sessions', (req, res) => res.json({ id: 'test-session' }));

app.listen(8080, () => console.log('Mock OpenCode server on :8080'));
```

Run: `node mock-opencode-server.js`

### Automated Testing

```bash
# Unit tests (when available)
yarn test:unit

# E2E tests (when available)
yarn test:e2e

# Coverage report
yarn test:coverage
```

---

## Next Steps

After completing manual testing:

1. **Report Results:** Document any issues found
2. **Task 1.13:** Complete integration test scenarios
3. **Task 1.14:** Test permission UI dialog (when implemented)
4. **Phase 2:** Advanced chat features
5. **Phase 3:** Agent IDE control
6. **Phase 4:** Modality surfaces (presentation, whiteboard)

---

## Quick Reference

### URLs
- **Browser App:** http://localhost:3000
- **Hub Instructions:** http://localhost:3000/openspace/instructions
- **Hub Manifest:** http://localhost:3000/manifest (POST)
- **Hub State:** http://localhost:3000/state (POST)
- **Hub SSE:** http://localhost:3000/events (GET)
- **Hub Commands:** http://localhost:3000/commands (POST)

### Commands
```bash
# Build
yarn build

# Start
yarn start:browser

# Clean
yarn clean

# Watch mode
yarn watch

# Tests
yarn test
```

### Key Files
- **Extensions:** `/extensions/openspace-*/`
- **Browser App:** `/browser-app/`
- **Documentation:** `/docs/`
- **Tests:** `/tests/`

---

## Support

For issues or questions:
1. Check this guide first
2. Review project documentation in `/docs/`
3. Check active context: `.opencode/context/01_memory/active_context.md`
4. Review implementation details in TECHSPEC and WORKPLAN

---

**Happy Testing! 🚀**
