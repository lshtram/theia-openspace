# OpenSpace Integration Test Procedure

**Version:** 1.0  
**Created:** 2026-02-16  
**Purpose:** Manual integration testing of full message round-trip functionality

---

## Overview

This document provides step-by-step instructions for manually testing the OpenSpace IDE integration with OpenCode agents. The test verifies that users can send messages through the chat widget, agents can receive and process them, and responses stream back correctly.

---

## Prerequisites

### Required Software
- [ ] Node.js and Yarn installed
- [ ] OpenSpace IDE built (`yarn build` completed)
- [ ] OpenCode server installed on system
- [ ] Browser (Chrome, Firefox, or Safari)

### Required Configuration
- [ ] OpenCode configured with instructions URL (see Task 1.12)
- [ ] `~/.opencode/opencode.json` exists and contains:
  ```json
  {
    "instructions": ["http://localhost:3100/openspace/instructions"]
  }
  ```

### Port Availability
Check that these ports are free:
- [ ] Port 3000 (Theia frontend)
- [ ] Port 3100 (Hub server)
- [ ] Port 3333 (OpenCode server)

**Check ports:**
```bash
lsof -i :3000
lsof -i :3100
lsof -i :3333
```

If ports are in use, stop the processes or adjust configuration.

---

## Test Environment Setup

### 1. Verify OpenSpace Build

```bash
cd /Users/Shared/dev/theia-openspace
ls -la applications/browser/lib/
```

**Expected:** Directory exists and contains built artifacts.

### 2. Verify OpenCode Configuration

```bash
cat ~/.opencode/opencode.json
```

**Expected:** File contains instructions URL pointing to `http://localhost:3100/openspace/instructions`

### 3. Start OpenCode Server (if not running)

```bash
opencode start
```

**Expected:** Server starts and logs show "Listening on port 3333" or similar.

---

## Test Scenarios

---

## ✅ Scenario 1: System Startup Verification

**Objective:** Verify all components start correctly and connect.

### Steps

1. **Start OpenSpace IDE**
   ```bash
   cd /Users/Shared/dev/theia-openspace
   yarn start:browser
   ```

2. **Wait for startup** (30-60 seconds)

3. **Check console output for these key messages:**
   - [ ] "Theia app listening on http://localhost:3000"
   - [ ] "[Hub] OpenSpace Hub configured"
   - [ ] "[Hub] Manifest updated: X commands registered"

4. **Verify no critical errors** in console output

5. **Open browser** and navigate to http://localhost:3000

6. **Check browser console** (F12 → Console tab) for errors

### Expected Results

- ✅ All services start without errors
- ✅ Manifest contains ≥5 commands
- ✅ Hub endpoint accessible
- ✅ Browser can access http://localhost:3000
- ✅ Theia IDE interface loads

### Pass Criteria

- [ ] Console shows successful startup of all services
- [ ] No critical errors in terminal or browser console
- [ ] IDE interface visible in browser

### Evidence to Collect

- Screenshot of terminal showing startup messages
- Screenshot of browser showing IDE interface
- Copy of console output showing manifest registration

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Port 3000 in use | Kill process: `kill $(lsof -t -i:3000)` |
| Port 3100 in use | Kill process: `kill $(lsof -t -i:3100)` |
| Build artifacts missing | Run `yarn build` |
| Module not found errors | Run `yarn install` |

---

## ✅ Scenario 2: Hub Instructions Endpoint

**Objective:** Verify Hub generates correct system prompt.

### Steps

1. **Wait 10 seconds** after Theia startup (allow extension loading)

2. **Test endpoint with curl:**
   ```bash
   curl http://localhost:3100/openspace/instructions
   ```

3. **Review response** and check for required sections

4. **Count commands** listed in response

### Expected Results

Response should contain:

```markdown
# OpenSpace IDE Control Instructions

You are operating inside Theia OpenSpace IDE...

## Available Commands
- **openspace.pane.open**: Opens a new pane...
- **openspace.chat.send**: Sends a message...
- **openspace.session.create**: Creates a new session...
[additional commands...]

## Current IDE State
(State information or "No state available yet")

## Command Format
Commands must be emitted as: %%OS{"cmd":"command.id","args":{...}}%%
```

### Pass Criteria

- [ ] HTTP 200 response received
- [ ] Content-Type: text/plain
- [ ] Response contains "## Available Commands"
- [ ] At least 5 commands listed
- [ ] Each command has description and example
- [ ] Command format section present

### Evidence to Collect

- Copy of curl output (full response)
- Count of commands listed
- Example of one command entry

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Connection refused | Verify Theia is running, check port 3100 |
| Empty response | Check Hub logs, restart Theia |
| No commands listed | Wait longer (extensions may still be loading) |
| 404 error | Check Hub routing configuration |

---

## ✅ Scenario 3: Chat Widget Functionality

**Objective:** Verify chat widget renders and allows interaction.

### Steps

1. **Open OpenSpace** in browser: http://localhost:3000

2. **Locate Chat icon** in left sidebar
   - Look for speech bubble icon or "Chat" label

3. **Click Chat icon** to open widget

4. **Verify widget displays correctly**
   - Widget panel opens on left side
   - UI elements are visible and styled

5. **Click "+ New"** button to create session

6. **Verify session appears** in dropdown
   - Dropdown shows "Session [timestamp]"
   - Active indicator (●) visible

7. **Check text input**
   - Input field is visible
   - Input field is enabled (can type)
   - Send button is visible

### Expected Results

- ✅ Chat icon visible in sidebar (speech bubble icon)
- ✅ Widget opens when clicked
- ✅ Session dropdown shows "Session [timestamp]"
- ✅ Text input field visible and enabled
- ✅ Send button visible
- ✅ No console errors

### Pass Criteria

- [ ] Chat widget renders without errors
- [ ] Session creation works
- [ ] UI is interactive (can type in input)
- [ ] No errors in browser console

### Evidence to Collect

- Screenshot of chat widget open
- Screenshot of session dropdown
- Screenshot of text input ready for typing

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Chat icon not visible | Check browser console for errors, reload page |
| Widget doesn't open | Check for JavaScript errors, verify widget registered |
| "+ New" button missing | Check widget implementation, verify button rendered |
| Can't type in input | Check input element, verify not disabled |

---

## ✅ Scenario 4: OpenCode Configuration

**Objective:** Verify OpenCode is configured and running.

### Steps

1. **Check OpenCode config:**
   ```bash
   cat ~/.opencode/opencode.json
   ```

2. **Verify instructions URL present**
   - Look for `"instructions": ["http://localhost:3100/openspace/instructions"]`

3. **Check OpenCode server status:**
   ```bash
   ps aux | grep opencode
   ```

4. **Check OpenCode logs** (location varies by installation)
   - Look for "Fetching instructions from..."
   - Look for "Successfully loaded X KB of instructions"

5. **Verify OpenCode is listening:**
   ```bash
   lsof -i :3333
   ```

### Expected Results

- ✅ Config file contains instructions URL
- ✅ OpenCode logs show: "Fetching instructions from http://localhost:3100/openspace/instructions"
- ✅ OpenCode logs show: "Successfully loaded X KB of instructions"
- ✅ No connection errors in logs
- ✅ OpenCode process running and listening on port 3333

### Pass Criteria

- [ ] OpenCode configured correctly
- [ ] Instructions fetched successfully
- [ ] OpenCode server running
- [ ] No errors in OpenCode logs

### Evidence to Collect

- Copy of `opencode.json` file
- Screenshot of OpenCode logs showing instruction fetch
- Output of port check command

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Config file missing | Run OpenCode setup: `opencode init` |
| Instructions URL missing | Manually add to config (see Task 1.12) |
| OpenCode not running | Start server: `opencode start` |
| Port 3333 in use | Stop conflicting process |
| Connection errors | Verify Hub is running, check firewall |
| Instruction fetch fails | Check Hub endpoint with curl first |

---

## ✅ Scenario 5: Message Send and Receive

**Objective:** Verify full message round-trip works.

### Steps

1. **In OpenSpace chat widget**, type test message:
   ```
   Hello, can you hear me?
   ```

2. **Press Enter** or click **Send** button

3. **Observe immediately:**
   - [ ] Message appears in chat history
   - [ ] Message shows "user" role or your avatar

4. **Wait for agent response** (up to 10 seconds)

5. **Watch for streaming indicator:**
   - [ ] Blinking cursor appears
   - [ ] "Thinking..." message visible
   - [ ] Loading animation present

6. **Observe response streaming:**
   - [ ] Text appears character-by-character OR in chunks
   - [ ] Response builds incrementally (not blank then complete)

7. **Wait for completion:**
   - [ ] Streaming indicator disappears
   - [ ] Final message shows "assistant" role

8. **Check browser console** (F12 → Console):
   - [ ] Look for SSE events: "message.created"
   - [ ] Look for: "message.partial"
   - [ ] Look for: "message.completed"

### Expected Results

- ✅ User message appears immediately in chat (optimistic update)
- ✅ Streaming indicator appears (blinking cursor or "Thinking...")
- ✅ Agent response streams in incrementally
- ✅ Response completes without errors
- ✅ Final message shows "assistant" role
- ✅ Console shows SSE events: "message.created", "message.partial", "message.completed"

### Pass Criteria

- [ ] Message sent successfully (no errors)
- [ ] Agent responds within 10 seconds
- [ ] Streaming works (not blank then complete)
- [ ] Response is coherent and relevant
- [ ] No errors in browser console

### Evidence to Collect

- Screenshot of message sent
- Screenshot of streaming in progress
- Screenshot of completed response
- Copy of browser console logs showing SSE events

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Message doesn't send | Check browser console for errors, verify SessionService |
| No response | Check OpenCode is running, verify backend connection |
| Response blank | Check SSE connection, verify SyncService |
| No streaming | Check event handling, verify message.partial events |
| Error in console | Check stack trace, verify RPC connection |
| Timeout | Check OpenCode API key, verify internet connection |

---

## ✅ Scenario 6: Agent Knowledge of IDE Commands

**Objective:** Verify agent has access to OpenSpace instructions.

### Steps

1. **Create new session** (click "+ New")
   - Ensures fresh instruction fetch

2. **Send message:**
   ```
   What IDE commands do you have access to? List them.
   ```

3. **Wait for response**

4. **Review agent response:**
   - [ ] Mentions OpenSpace IDE commands
   - [ ] Lists command names (e.g., "openspace.pane.open")
   - [ ] Provides brief descriptions
   - [ ] May mention `%%OS{...}%%` syntax

5. **Count commands listed** by agent

6. **Compare to Hub manifest** (from Scenario 2)

### Expected Results

Agent response includes:
- ✅ Mention of OpenSpace IDE commands
- ✅ List of command names (e.g., "openspace.pane.open", "openspace.chat.send")
- ✅ Brief descriptions of what commands do
- ✅ May mention `%%OS{...}%%` syntax

### Pass Criteria

- [ ] Agent lists ≥3 OpenSpace commands by name
- [ ] Commands match those in Hub manifest
- [ ] Agent demonstrates awareness of IDE control capability
- [ ] Response is coherent and accurate

### Evidence to Collect

- Screenshot of agent response
- List of commands mentioned by agent
- Comparison with Hub manifest

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent unaware of commands | Check OpenCode fetched instructions, verify config |
| Agent lists wrong commands | Check Hub endpoint response, verify manifest |
| Generic response | Create new session, check instruction fetch logs |
| No command details | Agent may need more specific prompt |

---

## ✅ Scenario 7: Multiple Messages in Conversation

**Objective:** Verify conversation context is maintained.

### Steps

1. **Send first message:**
   ```
   My name is Alice.
   ```

2. **Wait for response**
   - [ ] Agent acknowledges (e.g., "Hello Alice", "Nice to meet you")

3. **Send follow-up message:**
   ```
   What is my name?
   ```

4. **Wait for response**
   - [ ] Agent responds with "Alice" or equivalent

5. **Check chat history:**
   - [ ] Both user messages visible
   - [ ] Both agent responses visible
   - [ ] Messages in chronological order

### Expected Results

- ✅ Agent acknowledges first message
- ✅ Agent responds to second message with "Alice" or equivalent
- ✅ Both messages appear in chat history
- ✅ Conversation flow is natural
- ✅ Context maintained between messages

### Pass Criteria

- [ ] Agent maintains conversation context
- [ ] Both messages appear in UI
- [ ] No context loss between messages
- [ ] Agent correctly recalls information from earlier in conversation

### Evidence to Collect

- Screenshot of full conversation
- Agent's response to "What is my name?"

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Agent forgets context | Check conversation history sent to API, verify SessionService |
| Messages missing | Check UI rendering, verify message state management |
| Context mixed up | Check session isolation, verify active session |

---

## ✅ Scenario 8: Session Switching

**Objective:** Verify session management works.

### Steps

1. **Create Session A** (should already have one from previous tests)

2. **Send message in Session A:**
   ```
   This is session A
   ```

3. **Wait for response**

4. **Create Session B** (click "+ New" button)
   - [ ] New session appears in dropdown
   - [ ] Session B becomes active (● indicator)

5. **Send message in Session B:**
   ```
   This is session B
   ```

6. **Wait for response**

7. **Switch back to Session A:**
   - [ ] Click dropdown
   - [ ] Select Session A
   - [ ] Session A becomes active (● indicator)

8. **Verify Session A messages:**
   - [ ] "This is session A" message visible
   - [ ] Agent response visible
   - [ ] Session B messages NOT visible

9. **Switch to Session B:**
   - [ ] Click dropdown
   - [ ] Select Session B

10. **Verify Session B messages:**
    - [ ] "This is session B" message visible
    - [ ] Agent response visible
    - [ ] Session A messages NOT visible

### Expected Results

- ✅ Each session maintains its own message history
- ✅ Switching sessions updates message list
- ✅ No message leakage between sessions
- ✅ Active session indicator (●) shows correct session
- ✅ Messages persist when switching back

### Pass Criteria

- [ ] Session isolation works (messages don't mix)
- [ ] Session switching updates UI correctly
- [ ] No errors when switching
- [ ] Message history persists per session

### Evidence to Collect

- Screenshot of Session A with its messages
- Screenshot of Session B with its messages
- Screenshot of dropdown showing multiple sessions

### Troubleshooting

| Issue | Solution |
|-------|----------|
| Session B shows Session A messages | Check session filtering, verify active session ID |
| Messages disappear | Check message persistence, verify session state |
| Can't create new session | Check SessionService.createSession, verify UI handler |
| Dropdown doesn't update | Check session list rendering, verify state binding |

---

## Integration Point Verification

After completing all scenarios, verify these component connections:

### 1. Frontend → Backend RPC
- [ ] SessionService calls OpenCodeService methods via RPC proxy
- [ ] Evidence: Send message succeeds, no RPC errors

### 2. Backend → OpenCode REST API
- [ ] OpenCodeProxy forwards requests to OpenCode server
- [ ] Evidence: Backend logs show HTTP requests to localhost:3333

### 3. OpenCode → Backend SSE
- [ ] OpenCode server sends events to backend SSE endpoint
- [ ] Evidence: Backend logs show SSE connection from OpenCode

### 4. Backend → Frontend RPC Callbacks
- [ ] OpenCodeSyncService receives events via OpenCodeClient callbacks
- [ ] Evidence: Frontend console shows "message.created", "message.partial", "message.completed"

### 5. BridgeContribution → Hub
- [ ] Manifest published on startup
- [ ] Evidence: Hub logs show manifest update with command count

### 6. OpenCode → Hub
- [ ] OpenCode fetches instructions from Hub
- [ ] Evidence: OpenCode logs show successful fetch, Hub logs show GET request

### 7. SyncService → SessionService
- [ ] Events update SessionService state
- [ ] Evidence: Messages appear in chat widget

---

## Test Completion Checklist

- [ ] All 8 scenarios executed
- [ ] Evidence collected for each scenario
- [ ] Pass/Fail status recorded for each scenario
- [ ] All 7 integration points verified
- [ ] Issues documented (if any found)
- [ ] Test report completed
- [ ] Troubleshooting guide updated with any new issues

---

## Next Steps

1. **If all tests pass:** Document results in test report, proceed to Task 1.14
2. **If issues found:** Document in test report, create bug reports, notify Oracle
3. **Update documentation:** Add any new troubleshooting steps discovered

---

## Appendix: Quick Reference

### Start OpenSpace
```bash
cd /Users/Shared/dev/theia-openspace
yarn start:browser
```

### Test Hub Endpoint
```bash
curl http://localhost:3100/openspace/instructions
```

### Check Port Usage
```bash
lsof -i :3000  # Theia
lsof -i :3100  # Hub
lsof -i :3333  # OpenCode
```

### View OpenCode Config
```bash
cat ~/.opencode/opencode.json
```

### Check OpenCode Status
```bash
ps aux | grep opencode
lsof -i :3333
```

### Browser Console
- Open: F12 or Cmd+Option+I (Mac)
- Console tab: View JavaScript errors and logs
- Network tab: View API requests

---

**Document Version:** 1.0  
**Last Updated:** 2026-02-16  
**Next Review:** After Task 1.14 completion
