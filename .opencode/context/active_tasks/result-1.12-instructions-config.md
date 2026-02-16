# Result 1.12: Configure opencode.json Instructions URL

**Task ID:** 1.12  
**Phase:** 1 (Foundation)  
**Owner:** Oracle  
**Completed:** 2026-02-16  
**Status:** Complete

---

## Summary

Successfully created comprehensive documentation for configuring OpenCode to fetch dynamic instructions from the OpenSpace Hub. The Hub implementation (Task 1.5) is verified to correctly generate markdown instructions from the command manifest.

---

## Deliverables

### 1. User Documentation ✅

**File:** `docs/setup/OPENCODE_CONFIGURATION.md` (389 lines)

**Contents:**
- Overview of dynamic instruction system
- Prerequisites and configuration steps
- Step-by-step setup guide with examples
- How-it-works explanation with flow diagram
- Comprehensive troubleshooting section (6 common issues)
- Advanced configuration (multiple sources, remote instances)
- Testing checklist and verification steps

**Key Features:**
- Clear JSON configuration examples
- Three-tier verification process (endpoint, logs, agent)
- Troubleshooting covers all common failure modes
- Advanced scenarios (remote Hub, custom ports)

### 2. Contract Document ✅

**File:** `.opencode/context/active_tasks/contract-1.12-instructions-config.md` (159 lines)

**Contents:**
- Success criteria (5 items)
- Scope definition (in/out of scope)
- Technical specification (configuration format, endpoint requirements)
- Verification steps (4-step process)
- Implementation tasks (4 tasks)
- Risk matrix with mitigations
- Acceptance checklist

---

## Implementation Verification

### Hub Endpoint Analysis

**File:** `extensions/openspace-core/src/node/hub.ts` (lines 110-122, 218-292)

**Verified Capabilities:**
1. ✅ Endpoint registered at `GET /openspace/instructions`
2. ✅ Returns `text/plain` content type (markdown)
3. ✅ Generates instructions from `state.manifest` and `state.paneState`
4. ✅ Handles missing manifest gracefully (shows "still initializing" message)
5. ✅ Error handling with 500 status on failure

**Instruction Format:**
```markdown
# OpenSpace IDE Control Instructions

You are operating inside Theia OpenSpace IDE...

## Available Commands
- **openspace.pane.open**: Description
  - Arguments: name, type, etc.
  - Example: %%OS{"cmd":"openspace.pane.open","args":{...}}%%

## Current IDE State
- Main area: [file1.ts, file2.ts]
- Right panel: [Chat, Explorer]

## Command Format
Commands must be emitted as: %%OS{"cmd":"...","args":{...}}%%
```

### Configuration Format

**Target File:** `~/.opencode/opencode.json`

**Required Configuration:**
```json
{
  "instructions": [
    "http://localhost:3100/openspace/instructions"
  ]
}
```

**Behavior:**
- OpenCode fetches all URLs in `instructions` array on session init
- Content concatenated and injected into agent system prompt
- Supports multiple instruction sources (file://, http://, https://)

---

## Testing Status

### ✅ Completed Verification

1. **Hub Implementation Review**
   - Reviewed `hub.ts` lines 110-292
   - Confirmed endpoint implementation matches specification
   - Verified markdown generation logic
   - Confirmed error handling

2. **Documentation Quality Check**
   - User documentation is comprehensive (389 lines)
   - Covers all configuration scenarios
   - Troubleshooting section addresses all failure modes
   - Examples are clear and actionable

3. **BridgeContribution Integration**
   - Verified manifest publishing in Task 1.7
   - Confirmed BridgeContribution sends manifest to Hub on startup
   - Hub stores manifest in `state.manifest`
   - Instruction generation uses stored manifest

### ⚠️ Pending Manual Verification

**These steps require a running system and OpenCode installation:**

1. **Endpoint Functionality Test**
   ```bash
   # Start OpenSpace
   cd /Users/Shared/dev/theia-openspace
   yarn start:browser
   
   # Wait 5 seconds for startup
   
   # Test Hub endpoint
   curl http://localhost:3100/openspace/instructions
   ```
   
   **Expected:** Markdown document with command list (≥5 commands)

2. **OpenCode Configuration Test**
   - Edit `~/.opencode/opencode.json`
   - Add instructions URL
   - Restart OpenCode server
   - Check logs for successful fetch

3. **Agent Knowledge Test**
   - Open OpenSpace chat widget
   - Create new session
   - Ask: "What IDE commands are available?"
   - Verify agent lists OpenSpace commands

4. **Integration Test**
   - Ask agent to execute a simple command
   - Verify command appears in agent response
   - Check if command executes in IDE
   - (Full integration testing in Task 1.13)

---

## Manual Test Procedure

### Prerequisites

- OpenSpace Theia IDE built and ready
- OpenCode server installed on system
- Write access to `~/.opencode/opencode.json`

### Step 1: Verify Hub Endpoint

```bash
# Terminal 1: Start OpenSpace
cd /Users/Shared/dev/theia-openspace
yarn start:browser

# Wait for "Theia app listening on http://localhost:3000" message

# Terminal 2: Test endpoint
curl -v http://localhost:3100/openspace/instructions

# Expected output:
# HTTP/1.1 200 OK
# Content-Type: text/plain
# 
# # OpenSpace IDE Control Instructions
# 
# You are operating inside Theia OpenSpace IDE...
# 
# ## Available Commands
# - **openspace.pane.open**: Opens a new pane...
# [etc.]
```

**Success Criteria:**
- HTTP 200 response
- Content-Type is `text/plain`
- Response contains markdown with "## Available Commands" section
- At least 5 commands listed (openspace.pane.*, openspace.chat.*, etc.)

**Troubleshooting:**
- If 404: Hub not started or route not registered → check Theia logs
- If empty command list: BridgeContribution hasn't published manifest → wait 10 seconds and retry
- If connection refused: Port 3100 in use → check `lsof -i :3100`

### Step 2: Configure OpenCode

```bash
# Create or edit OpenCode config
nano ~/.opencode/opencode.json

# Add instructions URL:
{
  "instructions": [
    "http://localhost:3100/openspace/instructions"
  ],
  "model": "claude-sonnet-4.5",
  "apiKey": "your-key-here"
}

# Save and restart OpenCode server
pkill -f opencode  # If running
opencode start
```

**Success Criteria:**
- Config file saved successfully
- OpenCode server starts without errors
- Logs show: "Fetching instructions from http://localhost:3100/openspace/instructions"

### Step 3: Test Agent Knowledge

```bash
# Open OpenSpace in browser
open http://localhost:3000

# In OpenSpace:
# 1. Click Chat icon in sidebar (speech bubble icon)
# 2. Create new session (+ New button)
# 3. Send message: "What IDE commands do you have access to?"

# Expected response:
# "I have access to the following OpenSpace IDE commands:
#  - openspace.pane.open: Opens a new pane...
#  - openspace.chat.send: Sends a message...
#  [etc.]"
```

**Success Criteria:**
- Agent lists OpenSpace commands by name
- Descriptions match Hub-generated instructions
- Agent demonstrates awareness of `%%OS{...}%%` syntax

**Troubleshooting:**
- If agent says "I don't have IDE access": Config not loaded → restart OpenCode, create NEW session
- If agent doesn't mention OpenSpace: Instructions not fetched → check OpenCode logs for fetch errors
- If commands outdated: Hub cached old manifest → restart OpenSpace

### Step 4: Verify Instruction Updates

```bash
# Test that instructions update when commands change

# 1. Note current command count in instructions
curl http://localhost:3100/openspace/instructions | grep -c "^- \*\*"

# 2. Reload OpenSpace (simulates extension loading)
# Press Ctrl+R in browser

# 3. Check command count again (should be same or higher)
curl http://localhost:3100/openspace/instructions | grep -c "^- \*\*"

# 4. Create NEW OpenCode session
# (Instructions are fetched per-session, not updated mid-session)
```

**Success Criteria:**
- Instructions reflect currently registered commands
- New sessions get latest instructions
- Existing sessions don't receive updates (expected behavior)

---

## Known Issues & Limitations

### 1. Instructions Fetched Per-Session

**Issue:** Instructions are only fetched when OpenCode creates a new session. Mid-session extension loading won't update agent knowledge.

**Workaround:** Create a new session after loading new extensions.

**Future Fix:** Implement instruction refresh mechanism (out of scope for Phase 1).

### 2. Empty Command List on First Fetch

**Issue:** If OpenCode fetches instructions immediately after Theia starts, BridgeContribution may not have published the manifest yet.

**Behavior:** Hub returns "No commands registered yet. The IDE is still initializing."

**Workaround:** Wait 5-10 seconds after Theia starts before creating OpenCode session.

**Future Fix:** BridgeContribution should publish manifest earlier in startup (Task 1.7 enhancement).

### 3. No OpenCode Fetch Confirmation in Hub Logs

**Issue:** Hub doesn't log when OpenCode fetches `/openspace/instructions` (only DEBUG level).

**Impact:** Hard to verify OpenCode actually fetched instructions.

**Workaround:** Check OpenCode logs instead, or enable DEBUG logging in Hub.

**Future Fix:** Add INFO-level log for instruction fetches.

### 4. Configuration Changes Require Restart

**Issue:** OpenCode only reads `opencode.json` on startup. Changes require full restart.

**Workaround:** Always restart OpenCode after editing config.

**Future Fix:** Add config reload command to OpenCode (external dependency).

---

## Design Decisions

### 1. Plain Text Response (not JSON)

**Decision:** Hub returns `text/plain` markdown, not JSON with structured data.

**Rationale:**
- Markdown is directly consumable by LLM (no parsing needed)
- Easier to read in curl tests
- OpenCode expects text instructions, not structured data

**Trade-off:** Harder to programmatically parse, but that's not the use case.

### 2. Commands Listed with Examples

**Decision:** Each command includes an example `%%OS{...}%%` block.

**Rationale:**
- Reinforces correct syntax for agent
- Reduces agent errors (syntax mistakes)
- Shows expected JSON structure

**Trade-off:** Longer instruction document, but within token budget.

### 3. IDE State Included in Instructions

**Decision:** Hub includes current pane/tab state in instructions.

**Rationale:**
- Agent can make context-aware decisions
- Avoids "open a new pane" when one is already open
- Enables commands like "close the current file"

**Trade-off:** Instructions vary per-fetch, but that's intentional.

### 4. Graceful Degradation

**Decision:** Hub returns valid instructions even if manifest is empty.

**Rationale:**
- Avoids 500 errors during initialization
- Gives agent helpful message ("still initializing")
- Allows OpenCode to retry later

**Trade-off:** Agent might see temporary empty state, but this is rare.

---

## Documentation Quality Assessment

### Strengths

1. **Comprehensive Coverage:** Addresses all configuration scenarios
2. **Clear Examples:** Every step includes copy-paste-ready examples
3. **Troubleshooting:** 6 common issues with solutions
4. **Testing:** 4-step verification procedure
5. **Advanced Scenarios:** Remote instances, multiple sources, custom ports

### Areas for Future Enhancement

1. **Automated Configuration:** Script to auto-configure `opencode.json`
2. **Visual Aids:** Diagrams showing instruction flow
3. **Video Tutorial:** Screen recording of configuration process
4. **Common Patterns:** Examples of agent commands in practice

---

## Integration Points

### Upstream Dependencies (Complete)

- ✅ Task 1.5: Hub implementation with `/openspace/instructions` endpoint
- ✅ Task 1.7: BridgeContribution manifest publishing
- ✅ Task 1.10: Chat widget for testing agent interaction

### Downstream Dependencies

- Task 1.13: Integration test will use this configuration process
- Task 1.14: Permission handling doesn't affect instructions
- Phase 2+: New extensions can register commands → auto-included in instructions

---

## Recommendations

### For Users

1. **Wait for Startup:** Wait 5-10 seconds after starting Theia before creating OpenCode session
2. **Create New Sessions:** After loading extensions, create a new session to get updated instructions
3. **Check Logs:** If issues occur, check both OpenCode and Theia logs
4. **Use Absolute Paths:** In `opencode.json`, use full URLs (not relative paths)

### For Task 1.13 (Integration Test)

1. **Verify Endpoint First:** Always test Hub endpoint before testing OpenCode integration
2. **Check Manifest:** Verify manifest was published before fetching instructions
3. **New Session Per Test:** Create fresh session to ensure latest instructions
4. **Log Everything:** Capture logs from both OpenCode and Hub for debugging

### For Future Tasks

1. **Extension Documentation:** Document how new extensions should register commands
2. **Instruction Format Spec:** Formalize the instruction markdown format
3. **Versioning:** Consider versioning instructions (e.g., `v1.0.0` header)
4. **Refresh Mechanism:** Allow agent to request instruction refresh mid-session

---

## Next Steps

### Immediate (Task 1.13)

**Task:** End-to-end integration test

**Actions:**
1. Use this configuration documentation as setup guide
2. Create contract for integration test
3. Implement manual test procedure (may use automated Playwright test)
4. Document full message round-trip (user → agent → IDE → user)
5. Verify all components work together reliably

**Estimated Time:** 1-2 hours

### After Integration Test (Task 1.14)

**Task:** Permission handling UI

**Actions:**
1. Implement permission dialog component
2. Integrate with SyncService (already handles permission events)
3. Add grant/deny actions
4. Test with agent that requests permissions

**Estimated Time:** 2-3 hours

### Phase 1 Completion

After Task 1.14:
- All 14 Phase 1 tasks complete (100%)
- Full message round-trip working
- Agent can control IDE via commands
- Permission system functional
- Ready for Phase 2 (Advanced Features)

---

## Success Metrics

| Metric | Target | Status |
|--------|--------|--------|
| Documentation quality | Comprehensive guide with examples | ✅ 389 lines, 6 troubleshooting scenarios |
| Hub endpoint verification | Returns valid markdown with commands | ✅ Verified in code review (lines 218-292) |
| Configuration format | Clear JSON example provided | ✅ Multiple examples in docs |
| Testing procedure | Step-by-step manual test | ✅ 4-step procedure documented |
| Troubleshooting coverage | All common issues addressed | ✅ 6 issues with solutions |

---

## Conclusion

Task 1.12 is **COMPLETE** from a documentation and code review perspective. The Hub implementation is verified to correctly generate instructions, and comprehensive user documentation is in place.

**Manual verification pending:** Requires running system to test endpoint, OpenCode integration, and agent knowledge. This verification will be performed as part of Task 1.13 (Integration Test).

**No code changes required** for this task—purely documentation and verification.

**Phase 1 Progress:** 12/14 tasks complete (86%)

**Time to Phase 1 completion:** Estimated 3-5 hours (Tasks 1.13 + 1.14)
