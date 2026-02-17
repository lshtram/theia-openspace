# Phase 1B1 Runtime Verification Checklist

**Date:** 2026-02-17  
**Phase:** 1B1 Architecture C → B1 Refactoring  
**Status:** 🟡 AWAITING MANUAL VERIFICATION

---

## Overview

The code implementation for Phase 1B1 is **complete** and all unit tests pass. However, runtime verification with Theia running is required to confirm the end-to-end flow works correctly.

---

## Prerequisites

1. Build completed: ✅ PASS (29.6s, zero errors)
2. Unit tests passed: ✅ 61/61 PASSING (163ms)
3. Theia not running: ⚠️ Must start Theia for verification

---

## Verification Steps

### Step 1: Start Theia and Capture Startup Logs

**Command:**
```bash
cd /Users/Shared/dev/theia-openspace
yarn start:browser
```

**Expected Logs to Look For:**
```
[Hub] OpenSpace Hub configured at /openspace
[Hub] Route registered: POST /openspace/manifest
[Hub] Route registered: POST /openspace/state
[Hub] Route registered: GET /openspace/instructions
[BridgeContribution] Starting OpenSpace bridge...
[BridgeContribution] Published manifest: N commands
[Hub] Manifest updated: N commands registered
```

**What to Verify:**
- ✅ Hub routes use `/openspace/` prefix (NOT `/openspace/commands` or `/openspace/events`)
- ✅ BridgeContribution publishes manifest successfully
- ✅ NO SSE connection logs from BridgeContribution (removed in 1B1.6)
- ✅ NO `/commands` or `/events` route registration logs (removed in 1B1.5)

**If Logs Show Errors:**
- Check console for stack traces
- Verify Hub port (default: 3000)
- Check if BridgeContribution's `hubBaseUrl` is correctly set to `window.location.origin`

---

### Step 2: Test Hub Endpoints (Verify Route Cleanup)

**Command:**
```bash
# Test NEW routes (should work)
curl -X POST http://localhost:3000/openspace/manifest \
  -H "Content-Type: application/json" \
  -d '{"commands":[{"id":"test","label":"Test"}]}' \
  -v

curl -X POST http://localhost:3000/openspace/state \
  -H "Content-Type: application/json" \
  -d '{"connected":true}' \
  -v

curl -X GET http://localhost:3000/openspace/instructions -v

# Test OLD routes (should return 404)
curl -X POST http://localhost:3000/openspace/commands \
  -H "Content-Type: application/json" \
  -d '{"command":"test"}' \
  -v

curl -X GET http://localhost:3000/openspace/events -v
```

**Expected Results:**
- ✅ `POST /openspace/manifest` → **200 OK**
- ✅ `POST /openspace/state` → **200 OK**
- ✅ `GET /openspace/instructions` → **200 OK**
- ✅ `POST /openspace/commands` → **404 Not Found** (route removed)
- ✅ `GET /openspace/events` → **404 Not Found** (route removed)

**If 404 on New Routes:**
- Check if Hub is running on port 3000
- Verify Hub constructor adds routes correctly
- Check `onStart()` method in `hub.ts`

---

### Step 3: Test ChatAgent Delegation (Verify SessionService Integration)

**Interactive Test:**
1. Open Theia in browser: `http://localhost:3000`
2. Open Theia's built-in chat panel (View → Chat)
3. Type: `@Openspace hello`
4. Press Enter

**Expected Behavior:**
- ✅ Message sent to opencode server (not echoed locally)
- ✅ Response streams back into Theia chat UI
- ✅ Response is NOT the old echo format: `"Echo: hello"`
- ✅ Response comes from real SessionService

**Console Logs to Check:**
```
[ChatAgent] Handling request: "hello"
[SessionService] Sending message to opencode server...
[SessionService] Streaming message delta: "..."
```

**If Echo Response Appears:**
- Check `chat-agent.ts` line 45-60
- Verify SessionService is properly injected
- Check if `this.sessionService.sendMessage()` is being called

**If No Response:**
- Check SessionService connection status
- Verify opencode server is running
- Check browser console for errors

---

### Step 4: Test RPC Callback Path (Verify Stream Interceptor)

**Setup:**
Add temporary debug logs to trace the full flow:

**File:** `extensions/openspace-core/src/browser/opencode-sync-service.ts`  
**Location:** Inside `onAgentCommand()` method (line ~85)

```typescript
onAgentCommand(command: AgentCommand): void {
    console.log('[DEBUG] SyncService.onAgentCommand() called:', JSON.stringify(command));
    this.commandQueue.push(command);
    // ... rest of method
}
```

**File:** `extensions/openspace-core/src/node/opencode-proxy.ts`  
**Location:** Inside `interceptStream()` method after extraction (line ~125)

```typescript
if (commands.length > 0) {
    console.log('[DEBUG] OpenCodeProxy.interceptStream() extracted commands:', commands.length);
    commands.forEach(cmd => {
        console.log('[DEBUG] Dispatching command:', JSON.stringify(cmd));
        this._client.onAgentCommand(cmd);
    });
}
```

**Test Execution:**
1. Rebuild: `yarn build`
2. Restart Theia: `yarn start:browser`
3. Open browser console (F12 → Console tab)
4. Trigger an agent command (simulate agent sending `%%OS{"id":"test","args":{}}%%`)

**Expected Console Logs:**
```
[DEBUG] OpenCodeProxy.interceptStream() extracted commands: 1
[DEBUG] Dispatching command: {"id":"test","args":{}}
[DEBUG] SyncService.onAgentCommand() called: {"id":"test","args":{}}
[SyncService] Added command to queue: test
[SyncService] Processing command: test
```

**What to Verify:**
- ✅ Commands extracted by OpenCodeProxy
- ✅ Commands dispatched via RPC callback
- ✅ SyncService receives commands
- ✅ CommandRegistry executes commands (check for command execution logs)

**If No Logs Appear:**
- Verify stream interceptor regex is correct: `/%%OS(\{[^}]*\})%%/g`
- Check if `_client` is properly initialized in OpenCodeProxy
- Verify RPC connection is established

**Cleanup:**
After verification, remove the debug logs from both files and rebuild.

---

### Step 5: Phase 1 Regression Test (Verify No Breaking Changes)

**Objective:** Ensure existing Phase 1 functionality still works

**Test Sequence:**
1. **Start Theia** → `yarn start:browser`
2. **Connect to opencode server** → Open Theia, wait for connection indicator
3. **Create session** → Open Chat Widget, create new session
4. **Send message** → Type "hello" and send
5. **Verify streaming** → Message should stream back in real-time
6. **Check custom ChatWidget** → Message should appear in custom chat UI (not just built-in)
7. **Test permission dialog** → Trigger a command that requires permission, verify dialog appears

**Expected Results:**
- ✅ All Phase 1 features work as before
- ✅ No new errors in console
- ✅ No breaking changes to existing UI/UX

**If Regression Detected:**
- Check if SessionService changes broke anything
- Verify OpenCodeClient RPC interface changes are backward-compatible
- Review BridgeContribution changes for unintended side effects

---

## Success Criteria

All of the following must be true:

- [x] Build passes with zero errors
- [x] Unit tests pass (61/61)
- [ ] Theia starts without errors
- [ ] Hub routes use `/openspace/` prefix
- [ ] Hub does NOT register `/commands` or `/events` routes
- [ ] BridgeContribution does NOT attempt SSE connection
- [ ] ChatAgent delegates to SessionService (not echo)
- [ ] Stream interceptor extracts commands from `%%OS{...}%%` blocks
- [ ] RPC callback path works: OpenCodeProxy → SyncService → CommandRegistry
- [ ] Phase 1 regression tests pass

---

## Known Issues / Edge Cases

### Issue 1: Stream Interceptor Chunk Boundaries
**Description:** Current regex-based interceptor does not handle cases where `%%OS{...}%%` blocks are split across multiple stream chunks.

**Example:**
```
Chunk 1: "Hello %%OS{\"id\":\"te"
Chunk 2: "st\",\"args\":{}}%% world"
```

**Impact:** Command would not be extracted.

**Mitigation:** Phase 3 will add stateful parser. For now, opencode server should emit complete command blocks in single chunks.

**Workaround:** If this occurs during testing, note it and defer to Phase 3.

---

### Issue 2: Hub URL Hardcoding
**Description:** Previously, BridgeContribution used `http://localhost:3001` hardcoded URL.

**Fix Applied:** Changed to `window.location.origin` in Task 1B1.6.

**Verification:** Check browser console logs for Hub URL. Should show `http://localhost:3000` (or whatever port Theia is running on).

**If Wrong:** Double-check `bridge-contribution.ts` line 47.

---

### Issue 3: Command Queue Depth Warning
**Description:** SyncService warns if queue depth exceeds 50 commands.

**Expected Behavior:** Under normal conditions, queue should be empty or have 1-2 commands.

**If Warning Appears:**
- Check if CommandRegistry is blocking
- Verify 50ms delay is not too slow
- Look for infinite loop in command dispatch

---

## Rollback Procedure

If runtime verification fails and issues cannot be resolved quickly:

1. **Revert to Phase 1 (Architecture C):**
   ```bash
   git log --oneline | head -10  # Find commit before Phase 1B1
   git checkout <commit-hash>
   yarn build
   ```

2. **Report Issues:**
   - Document specific failure modes
   - Capture console logs and stack traces
   - Note which verification step failed

3. **Re-plan:**
   - Identify root cause
   - Update implementation plan
   - Re-attempt Phase 1B1

---

## Next Steps After Verification

Once all verification steps pass:

1. **Remove Debug Logs:** Clean up any temporary console.log statements
2. **Update Documentation:** Mark Phase 1B1 as ✅ VERIFIED in all tracking docs
3. **Commit Changes:** Create clean commit with message: `feat: Phase 1B1 - Architecture C → B1 refactoring (verified)`
4. **Proceed to Phase 1B2:** Begin next phase (if planned) or declare Phase 1 complete

---

## Notes for Future Phases

### Phase 3 Improvements Needed
- Replace regex-based stream interceptor with stateful parser
- Handle chunk boundary cases
- Add more sophisticated command extraction (nested JSON, escape sequences)

### Phase 2 Considerations
- If Phase 2 adds more complex agent commands, test with realistic payloads
- Verify command queue performance under load
- Add metrics/telemetry for command latency

---

## Sign-Off

**Code Implementation:** ✅ COMPLETE  
**Build & Unit Tests:** ✅ PASS  
**Runtime Verification:** 🟡 AWAITING MANUAL TESTING

**Assigned To:** User (manual testing required)  
**Blocked By:** Theia must be running for interactive tests  
**Estimated Time:** 15-20 minutes
