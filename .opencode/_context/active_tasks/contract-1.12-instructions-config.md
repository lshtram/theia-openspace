# Contract 1.12: Configure opencode.json Instructions URL

**Task ID:** 1.12  
**Phase:** 1 (Foundation)  
**Owner:** Oracle  
**Created:** 2026-02-16  
**Status:** Active

---

## Objective

Document and verify the configuration process for connecting the OpenCode agent to the OpenSpace Hub's instruction endpoint, enabling the agent to receive dynamic system prompts containing the IDE's command manifest.

---

## Success Criteria

1. ✅ Documentation created explaining how to add instructions URL to `opencode.json`
2. ✅ Hub endpoint `/openspace/instructions` verified to return correct system prompt
3. ✅ OpenCode agent confirmed to fetch and use instructions from Hub
4. ✅ Manual test procedure documented for verification
5. ✅ Configuration template provided for users

---

## Scope

### In Scope
- Document configuration format for `opencode.json`
- Verify Hub endpoint returns correct markdown instructions
- Test that OpenCode fetches instructions on session init
- Document troubleshooting steps
- Provide example configuration

### Out of Scope
- Modifications to Hub implementation (already complete in Task 1.5)
- Changes to OpenCode server behavior (external system)
- Automated integration tests (covered in Task 1.13)

---

## Technical Specification

### Configuration Format

The user's `~/.opencode/opencode.json` file should include:

```json
{
  "instructions": [
    "http://localhost:3100/openspace/instructions"
  ]
}
```

**Behavior:**
- OpenCode fetches all URLs in `instructions` array on session initialization
- Content is concatenated and injected into agent's system prompt
- Hub generates instructions dynamically from command manifest

### Hub Endpoint Requirements

**Endpoint:** `GET /openspace/instructions`  
**Port:** 3100 (default Hub port)  
**Response Type:** `text/markdown`

**Expected Response Structure:**
```markdown
# OpenSpace IDE Commands

You are controlling the OpenSpace IDE via special commands...

## Available Commands

### openspace.pane.open
Opens a new pane...

### openspace.chat.send
Sends a message...

[etc.]
```

### Verification Steps

1. **Start Hub:**
   ```bash
   cd /Users/Shared/dev/theia-openspace
   yarn start:browser  # Starts Theia + Hub on port 3100
   ```

2. **Verify endpoint manually:**
   ```bash
   curl http://localhost:3100/openspace/instructions
   ```
   Expected: Markdown document with command descriptions

3. **Configure OpenCode:**
   - Edit `~/.opencode/opencode.json`
   - Add instructions URL
   - Restart OpenCode server if running

4. **Verify OpenCode fetches instructions:**
   - Check OpenCode logs for HTTP request to Hub
   - Start chat session
   - Verify agent has knowledge of OpenSpace commands

---

## Implementation Tasks

### Task 1: Create User Documentation

**File:** `docs/setup/OPENCODE_CONFIGURATION.md`

**Content:**
- Overview of instructions URL feature
- Step-by-step configuration guide
- Example `opencode.json` with instructions
- Troubleshooting common issues
- How to verify configuration works

### Task 2: Verify Hub Endpoint

**Actions:**
1. Start Theia app (Hub starts automatically)
2. Test `/openspace/instructions` endpoint with curl
3. Verify response contains:
   - OpenSpace command syntax (%%OS{...}%%)
   - List of available commands from manifest
   - Usage examples
4. Verify response updates when commands are registered

### Task 3: Test OpenCode Integration

**Actions:**
1. Configure `opencode.json` with instructions URL
2. Start OpenCode server
3. Create new chat session in OpenSpace
4. Send message asking agent to list available IDE commands
5. Verify agent response shows knowledge of OpenSpace commands
6. Test agent executing a simple command (e.g., open pane)

### Task 4: Document Test Procedure

**File:** `.opencode/context/active_tasks/result-1.12-instructions-config.md`

**Content:**
- Configuration steps performed
- Test results (endpoint verification, OpenCode integration)
- Screenshots or log excerpts showing successful fetch
- Known limitations
- Recommendations for Task 1.13

---

## Dependencies

### Completed Dependencies
- ✅ Task 1.5: Hub implementation with `/openspace/instructions` endpoint
- ✅ Task 1.7: BridgeContribution manifest publishing
- ✅ Task 1.10: Chat widget for testing

### External Dependencies
- OpenCode server must be installed and configured
- User must have write access to `~/.opencode/opencode.json`

---

## Risks & Mitigations

| Risk | Impact | Mitigation |
|------|--------|-----------|
| OpenCode doesn't fetch instructions URL | High | Verify OpenCode version supports instructions array, check logs |
| Hub not accessible from OpenCode | High | Verify port 3100 open, check firewall rules |
| Instructions not included in agent prompt | Medium | Verify OpenCode logs show successful fetch, test agent knowledge |
| Manifest empty on first fetch | Low | Document that commands must be registered first (BridgeContribution does this) |

---

## Acceptance Checklist

- [ ] `docs/setup/OPENCODE_CONFIGURATION.md` created with complete configuration guide
- [ ] Hub endpoint `/openspace/instructions` manually verified with curl
- [ ] Response contains OpenSpace command syntax and command list
- [ ] `opencode.json` configured with instructions URL
- [ ] OpenCode server restarted with new configuration
- [ ] OpenCode logs show successful fetch of instructions URL
- [ ] Agent demonstrates knowledge of OpenSpace commands in test session
- [ ] Test procedure documented in result file
- [ ] Troubleshooting section added to documentation

---

## Success Metrics

- **Documentation Quality:** Clear step-by-step guide with examples
- **Endpoint Verification:** Hub returns valid markdown with ≥5 commands
- **Integration Success:** OpenCode successfully fetches instructions without errors
- **Agent Knowledge:** Agent can list and explain OpenSpace commands
- **Test Coverage:** Manual test procedure covers all configuration steps

---

## Notes

- This is primarily a **documentation and verification task**
- No code changes required (Hub already implements endpoint)
- Focus is on user experience and configuration clarity
- Successful completion unblocks Task 1.13 (integration test)
- Configuration pattern can be reused for future instruction sources

---

**Next Steps After Completion:**
1. Mark Task 1.12 complete in `active_context.md`
2. Proceed to Task 1.13 (Integration Test)
3. Use documented test procedure as foundation for automated tests
