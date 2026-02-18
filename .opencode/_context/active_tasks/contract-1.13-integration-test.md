# Contract 1.13: Integration Test - Full Message Round-Trip

**Task ID:** 1.13  
**Phase:** 1 (Foundation)  
**Owner:** Oracle  
**Created:** 2026-02-16  
**Status:** Active

---

## Objective

Verify end-to-end functionality of the OpenSpace system through comprehensive integration testing of the full message round-trip: user sends message → OpenCode agent processes → agent emits commands → Hub relays → IDE executes → user sees result.

---

## Success Criteria

1. ✅ OpenSpace IDE starts successfully with all extensions loaded
2. ✅ Hub starts on port 3100 and serves instructions endpoint
3. ✅ BridgeContribution publishes command manifest to Hub
4. ✅ Chat widget displays and allows session creation
5. ✅ User can send message to agent via chat widget
6. ✅ OpenCode agent receives message and responds
7. ✅ Agent response streams correctly through SyncService
8. ✅ Message appears in chat widget with streaming indicator
9. ✅ Agent can fetch instructions from Hub endpoint
10. ✅ Agent demonstrates knowledge of OpenSpace commands
11. ✅ Test procedure documented for reproducibility

---

## Scope

### In Scope
- Manual integration test procedure (step-by-step verification)
- Component integration verification (Hub, BridgeContribution, SessionService, Chat widget)
- End-to-end message flow validation
- OpenCode configuration verification (Task 1.12 setup)
- Documentation of test results and observations
- Troubleshooting guide for common integration issues

### Out of Scope
- Automated Playwright tests (can be added in Phase 2)
- Command execution testing (agent emitting %%OS{...}%% commands)
- Permission flow testing (Task 1.14)
- Performance/load testing
- Multi-user scenarios

---

## Technical Specification

### Test Environment Setup

**Prerequisites:**
1. OpenSpace IDE built and ready (`yarn build` completed)
2. OpenCode server installed on system
3. OpenCode configured with instructions URL (per Task 1.12)
4. Port 3000 (Theia) and 3100 (Hub) available
5. Port 3333 (OpenCode) available

**Configuration Files:**
- `~/.opencode/opencode.json` — Must include `"instructions": ["http://localhost:3100/openspace/instructions"]`
- OpenSpace build artifacts in `applications/browser/lib/`

### Test Scenarios

#### Scenario 1: System Startup Verification

**Objective:** Verify all components start correctly and connect

**Steps:**
1. Start OpenSpace IDE: `yarn start:browser`
2. Verify Theia starts on port 3000
3. Verify Hub starts on port 3100
4. Check console logs for errors
5. Verify BridgeContribution publishes manifest to Hub

**Expected Results:**
- Console shows: "Theia app listening on http://localhost:3000"
- Console shows: "[Hub] OpenSpace Hub configured"
- Console shows: "[Hub] Manifest updated: X commands registered"
- No critical errors in console
- Browser can access http://localhost:3000

**Pass Criteria:**
- All services start without errors
- Manifest contains ≥5 commands
- Hub endpoint accessible

---

#### Scenario 2: Hub Instructions Endpoint

**Objective:** Verify Hub generates correct system prompt

**Steps:**
1. Wait 10 seconds after Theia startup (allow extension loading)
2. Test endpoint: `curl http://localhost:3100/openspace/instructions`
3. Verify response format and content
4. Check command list completeness

**Expected Results:**
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

**Pass Criteria:**
- HTTP 200 response
- Content-Type: text/plain
- Response contains "## Available Commands"
- At least 5 commands listed
- Each command has description and example

---

#### Scenario 3: Chat Widget Functionality

**Objective:** Verify chat widget renders and allows interaction

**Steps:**
1. Open OpenSpace in browser: http://localhost:3000
2. Locate Chat icon in left sidebar
3. Click Chat icon to open widget
4. Verify widget displays correctly
5. Click "+ New" to create session
6. Verify session appears in dropdown
7. Verify text input is enabled

**Expected Results:**
- Chat icon visible in sidebar (speech bubble icon)
- Widget opens when clicked
- Session dropdown shows "Session [timestamp]"
- Text input field visible and enabled
- Send button visible
- No console errors

**Pass Criteria:**
- Chat widget renders without errors
- Session creation works
- UI is interactive (can type in input)

---

#### Scenario 4: OpenCode Configuration

**Objective:** Verify OpenCode is configured and running

**Steps:**
1. Check OpenCode config: `cat ~/.opencode/opencode.json`
2. Verify instructions URL present
3. Start OpenCode server: `opencode start` (if not running)
4. Check OpenCode logs for instruction fetch
5. Verify OpenCode is listening on port 3333

**Expected Results:**
- Config file contains: `"instructions": ["http://localhost:3100/openspace/instructions"]`
- OpenCode logs show: "Fetching instructions from http://localhost:3100/openspace/instructions"
- OpenCode logs show: "Successfully loaded X KB of instructions"
- No connection errors in logs

**Pass Criteria:**
- OpenCode configured correctly
- Instructions fetched successfully
- OpenCode server running

---

#### Scenario 5: Message Send and Receive

**Objective:** Verify full message round-trip works

**Steps:**
1. In OpenSpace chat widget, type test message: "Hello, can you hear me?"
2. Press Enter or click Send
3. Observe message appears in chat history
4. Wait for agent response
5. Verify streaming indicator appears
6. Verify response appears character-by-character or in chunks
7. Verify streaming indicator disappears when complete
8. Verify response is readable and coherent

**Expected Results:**
- User message appears immediately in chat (optimistic update)
- Streaming indicator appears (blinking cursor or "Thinking...")
- Agent response streams in incrementally
- Response completes without errors
- Final message shows "assistant" role
- Console shows SSE events: "message.created", "message.partial", "message.completed"

**Pass Criteria:**
- Message sent successfully (no errors)
- Agent responds within 10 seconds
- Streaming works (not blank then complete)
- Response is coherent
- No errors in console

---

#### Scenario 6: Agent Knowledge of IDE Commands

**Objective:** Verify agent has access to OpenSpace instructions

**Steps:**
1. Create new session (ensures fresh instruction fetch)
2. Send message: "What IDE commands do you have access to? List them."
3. Wait for response
4. Verify agent lists OpenSpace commands

**Expected Results:**
Agent response includes:
- Mention of OpenSpace IDE commands
- List of command names (e.g., "openspace.pane.open", "openspace.chat.send")
- Brief descriptions of what commands do
- Mention of `%%OS{...}%%` syntax (if agent explains how to use them)

**Pass Criteria:**
- Agent lists ≥3 OpenSpace commands by name
- Commands match those in Hub manifest
- Agent demonstrates awareness of IDE control capability

---

#### Scenario 7: Multiple Messages in Conversation

**Objective:** Verify conversation context is maintained

**Steps:**
1. Send message: "My name is Alice."
2. Wait for response
3. Send follow-up: "What is my name?"
4. Verify agent remembers context

**Expected Results:**
- Agent acknowledges first message
- Agent responds to second message with "Alice" or equivalent
- Both messages appear in chat history
- Conversation flow is natural

**Pass Criteria:**
- Agent maintains conversation context
- Both messages appear in UI
- No context loss between messages

---

#### Scenario 8: Session Switching

**Objective:** Verify session management works

**Steps:**
1. Create Session A, send message: "This is session A"
2. Create Session B (+ New button)
3. Send message in Session B: "This is session B"
4. Switch back to Session A (dropdown)
5. Verify Session A messages still visible
6. Switch to Session B
7. Verify Session B messages still visible

**Expected Results:**
- Each session maintains its own message history
- Switching sessions updates message list
- No message leakage between sessions
- Active session indicator (●) shows correct session

**Pass Criteria:**
- Session isolation works (messages don't mix)
- Session switching updates UI correctly
- No errors when switching

---

### Integration Points to Verify

**Component Connections:**
1. **Frontend → Backend RPC:**
   - SessionService calls OpenCodeService methods via RPC proxy
   - Verify: Send message succeeds, no RPC errors

2. **Backend → OpenCode REST API:**
   - OpenCodeProxy forwards requests to OpenCode server
   - Verify: Check backend logs for HTTP requests to localhost:3333

3. **OpenCode → Backend SSE:**
   - OpenCode server sends events to backend SSE endpoint
   - Verify: Check backend logs for SSE connection from OpenCode

4. **Backend → Frontend RPC Callbacks:**
   - OpenCodeSyncService receives events via OpenCodeClient callbacks
   - Verify: Frontend console shows "message.created", "message.partial", "message.completed"

5. **BridgeContribution → Hub:**
   - Manifest published on startup
   - Verify: Hub logs show manifest update with command count

6. **OpenCode → Hub:**
   - OpenCode fetches instructions from Hub
   - Verify: OpenCode logs show successful fetch, Hub logs show GET request

7. **SyncService → SessionService:**
   - Events update SessionService state
   - Verify: Messages appear in chat widget

---

## Test Documentation Requirements

### Test Report Format

**File:** `.opencode/context/active_tasks/result-1.13-integration-test.md`

**Required Sections:**
1. **Test Environment:** OS, Node version, Theia version, OpenCode version
2. **Test Execution Summary:** Date, duration, scenarios run
3. **Scenario Results:** Pass/Fail for each scenario with evidence
4. **Observations:** Logs, screenshots, error messages
5. **Issues Found:** Any bugs or unexpected behavior
6. **Integration Point Verification:** Status of each component connection
7. **Troubleshooting Applied:** Any issues encountered and how resolved
8. **Recommendations:** Next steps, improvements needed

### Evidence to Collect

For each scenario:
- ✅ Console log excerpts showing key events
- ✅ Screenshots of UI state (if applicable)
- ✅ Curl output for HTTP endpoint tests
- ✅ OpenCode log excerpts showing instruction fetch
- ✅ Hub log excerpts showing manifest updates

### Pass/Fail Criteria

**Overall Test PASSES if:**
- All 8 scenarios pass their individual criteria
- No critical errors in any component
- Full message round-trip works (Scenarios 5-7)
- Agent demonstrates IDE command knowledge (Scenario 6)

**Overall Test FAILS if:**
- Any scenario fails
- Critical errors prevent core functionality
- Message round-trip broken
- Agent cannot access instructions

---

## Implementation Tasks for Builder

### Task 1: Create Test Procedure Document

**File:** `docs/testing/INTEGRATION_TEST_PROCEDURE.md`

**Content:**
- Copy of all 8 test scenarios from this contract
- Step-by-step instructions for each scenario
- Expected results formatted for easy verification
- Troubleshooting section
- Checklist format for manual execution

### Task 2: Create Test Execution Script (Optional)

**File:** `scripts/test-integration.sh` (if automated parts possible)

**Content:**
- Start OpenSpace IDE
- Wait for startup
- Run curl tests for Hub endpoint
- Check for expected log messages
- Report results

### Task 3: Execute Manual Test

**Actions:**
1. Set up test environment per specifications
2. Execute all 8 scenarios in order
3. Document results in test report
4. Collect evidence (logs, screenshots)
5. Identify any issues or bugs

### Task 4: Create Test Report

**File:** `.opencode/context/active_tasks/result-1.13-integration-test.md`

**Content:**
- Complete test execution report
- Pass/Fail status for each scenario
- Evidence collected
- Issues found (if any)
- Recommendations

### Task 5: Troubleshooting Guide

**File:** `docs/troubleshooting/INTEGRATION_ISSUES.md`

**Content:**
- Common integration issues encountered during testing
- Solutions and workarounds
- Diagnostic commands
- When to restart components

---

## Dependencies

### Completed Prerequisites
- ✅ Task 1.1-1.11: All core components implemented
- ✅ Task 1.12: OpenCode configuration documented
- ✅ Hub implementation with instructions endpoint
- ✅ BridgeContribution manifest publishing
- ✅ SessionService with message handling
- ✅ Chat widget with UI

### External Dependencies
- OpenCode server must be installed
- Ports 3000, 3100, 3333 must be available
- Browser with JavaScript enabled
- Internet connection (for OpenCode API calls)

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| OpenCode not installed | Medium | High | Document installation steps in test procedure |
| Port conflicts | Medium | High | Document how to check/free ports |
| Manifest publish timing | Low | Medium | Add 10-second wait after startup in test procedure |
| Network errors | Low | Medium | Document retry procedure |
| Agent doesn't fetch instructions | Medium | High | Verify config in Scenario 4, provide troubleshooting |
| SSE connection fails | Low | High | Check firewall, document diagnostic steps |

---

## Acceptance Checklist

- [ ] Test procedure document created with all 8 scenarios
- [ ] Test environment set up per specifications
- [ ] Scenario 1 executed and passed (System startup)
- [ ] Scenario 2 executed and passed (Hub endpoint)
- [ ] Scenario 3 executed and passed (Chat widget)
- [ ] Scenario 4 executed and passed (OpenCode config)
- [ ] Scenario 5 executed and passed (Message send/receive)
- [ ] Scenario 6 executed and passed (Agent knowledge)
- [ ] Scenario 7 executed and passed (Conversation context)
- [ ] Scenario 8 executed and passed (Session switching)
- [ ] Test report created with evidence
- [ ] Issues documented (if any found)
- [ ] Troubleshooting guide created
- [ ] All integration points verified

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Scenario Pass Rate | 100% (8/8) | Count passed scenarios |
| Message Round-Trip Time | <5 seconds | Time from send to response start |
| Instruction Fetch Success | 100% | OpenCode logs show success |
| UI Error Rate | 0 | Console errors during test |
| Component Integration | 7/7 points | All connections verified |

---

## Notes

- **Manual testing is acceptable** for Phase 1 — automated tests can be added in Phase 2
- **Focus on happy path** — edge cases and error handling will be tested in later phases
- **Document everything** — test procedure should be reproducible by any team member
- **Troubleshooting is part of testing** — issues found and resolved should be documented

---

## Next Steps After Completion

1. **If all tests pass:** Proceed to Task 1.14 (Permission UI)
2. **If issues found:** Create bug reports, pass to Builder for fixes, retest
3. **Documentation:** Update WORKPLAN.md with test results
4. **Phase 1 completion:** After Task 1.14, Phase 1 is 100% complete

---

**Estimated Time:** 1-2 hours (manual execution) + 1 hour (documentation)

**Total:** ~3 hours including setup, execution, and reporting
