# OpenCode Configuration for OpenSpace

This guide explains how to configure the OpenCode AI coding assistant to connect to OpenSpace's dynamic instruction system.

---

## Overview

OpenSpace provides a **dynamic instruction endpoint** that generates system prompts for AI agents based on the currently available IDE commands. This allows the OpenCode agent to:

- Learn about OpenSpace-specific commands automatically
- Receive updated command lists when new extensions are loaded
- Execute IDE operations using the `%%OS{...}%%` command syntax

---

## Prerequisites

- OpenCode server installed and configured
- OpenSpace IDE running (Theia + Hub on port 3100)
- Write access to `~/.opencode/opencode.json`

---

## Configuration Steps

### 1. Locate Your OpenCode Configuration File

The OpenCode configuration file is located at:

```
~/.opencode/opencode.json
```

If this file doesn't exist, create it.

### 2. Add the Instructions URL

Edit `~/.opencode/opencode.json` and add the `instructions` array:

```json
{
  "instructions": [
    "http://localhost:3100/openspace/instructions"
  ],
  "model": "claude-sonnet-4.5",
  "apiKey": "your-api-key-here"
}
```

**Key Points:**
- The `instructions` field is an array (you can add multiple instruction URLs)
- The Hub runs on port `3100` by default
- Use `http://localhost` if OpenCode runs on the same machine as OpenSpace
- If OpenSpace runs on a different machine, replace `localhost` with the machine's IP/hostname

### 3. Restart OpenCode Server

If the OpenCode server is already running, restart it to load the new configuration:

```bash
# Stop the server (Ctrl+C or kill process)
# Then start it again
opencode start
```

### 4. Verify Configuration

#### Test 1: Check Hub Endpoint

Open a terminal and verify the Hub is serving instructions:

```bash
curl http://localhost:3100/openspace/instructions
```

**Expected Output:**
```markdown
# OpenSpace IDE Commands

You are controlling the OpenSpace IDE via special commands embedded in your response...

## Available Commands

### openspace.pane.open
Opens a new pane in the IDE...

### openspace.chat.send
Sends a message to a chat session...
```

If you see a markdown document with command descriptions, the Hub is working correctly.

#### Test 2: Verify OpenCode Fetches Instructions

Check the OpenCode server logs for a message indicating it fetched the instructions URL:

```
[INFO] Fetching instructions from http://localhost:3100/openspace/instructions
[INFO] Successfully loaded 3.2KB of instructions
```

#### Test 3: Test Agent Knowledge

1. Open OpenSpace IDE
2. Open the Chat widget (sidebar icon)
3. Create a new session or use existing one
4. Send a message: **"What IDE commands are available to you?"**

**Expected Response:**
The agent should list OpenSpace commands like:
- `openspace.pane.open`
- `openspace.chat.send`
- `openspace.terminal.open`
- etc.

---

## How It Works

### Dynamic Instruction Generation

1. **Command Registration:** When OpenSpace starts, extensions register commands with Theia's CommandRegistry
2. **Manifest Collection:** BridgeContribution collects all `openspace.*` commands and sends manifest to Hub
3. **Instruction Generation:** Hub generates markdown instructions from the manifest
4. **Agent Fetch:** OpenCode fetches instructions when creating a new session
5. **System Prompt Injection:** Instructions are included in the agent's system prompt

### Command Execution Flow

```
User sends message
    ↓
Agent generates response with %%OS{...}%% blocks
    ↓
Stream interceptor strips command blocks
    ↓
Commands sent to Hub via POST /commands
    ↓
Hub broadcasts AGENT_COMMAND events via SSE
    ↓
BridgeContribution receives event
    ↓
Command dispatched to Theia CommandRegistry
    ↓
IDE action executes
```

---

## Troubleshooting

### Issue: Endpoint Returns 404

**Symptom:**
```bash
curl http://localhost:3100/openspace/instructions
# Returns: 404 Not Found
```

**Solutions:**
1. Verify OpenSpace IDE is running: `ps aux | grep theia`
2. Check Hub is listening on port 3100: `lsof -i :3100`
3. Verify Hub started successfully in Theia logs
4. Try restarting OpenSpace: `yarn start:browser`

### Issue: Agent Doesn't Know OpenSpace Commands

**Symptom:**
Agent responds "I don't have access to IDE commands" or doesn't mention OpenSpace commands.

**Solutions:**
1. Verify `opencode.json` has correct instructions URL
2. Restart OpenCode server after configuration change
3. Check OpenCode logs for fetch errors
4. Create a **new session** (instructions are fetched per-session, not mid-session)
5. Verify Hub endpoint returns commands (see Test 1 above)

### Issue: OpenCode Can't Reach Hub

**Symptom:**
OpenCode logs show connection errors:
```
[ERROR] Failed to fetch http://localhost:3100/openspace/instructions
[ERROR] Connection refused
```

**Solutions:**
1. Verify OpenSpace is running on the correct machine
2. If OpenSpace is on a different machine, update URL from `localhost` to the machine's IP
3. Check firewall rules allow access to port 3100
4. Verify no other service is using port 3100: `lsof -i :3100`

### Issue: Instructions Are Empty

**Symptom:**
Hub endpoint returns empty command list or minimal instructions.

**Solutions:**
1. Wait 5-10 seconds after OpenSpace starts (command registration takes time)
2. Verify extensions are loaded correctly
3. Check Theia logs for extension loading errors
4. Manually refresh instructions: restart OpenSpace

### Issue: Commands Not Executing

**Symptom:**
Agent generates `%%OS{...}%%` blocks but nothing happens in the IDE.

**Solutions:**
1. This is NOT a configuration issue (instructions are separate from execution)
2. Check that Hub is receiving commands: `curl http://localhost:3100/state`
3. Verify BridgeContribution is connected to Hub SSE
4. See troubleshooting in Task 1.13 (Integration Test)

---

## Advanced Configuration

### Multiple Instruction Sources

You can add multiple instruction URLs:

```json
{
  "instructions": [
    "http://localhost:3100/openspace/instructions",
    "https://mycompany.com/coding-standards.md",
    "file:///Users/me/custom-instructions.md"
  ]
}
```

OpenCode will fetch and concatenate all sources.

### Remote OpenSpace Instance

If OpenSpace runs on a remote server:

```json
{
  "instructions": [
    "http://192.168.1.100:3100/openspace/instructions"
  ]
}
```

Replace `192.168.1.100` with your server's IP address.

### Custom Hub Port

If you changed the Hub port (default 3100), update the URL:

```json
{
  "instructions": [
    "http://localhost:8080/openspace/instructions"
  ]
}
```

---

## Example Configuration File

Complete example `~/.opencode/opencode.json`:

```json
{
  "instructions": [
    "http://localhost:3100/openspace/instructions"
  ],
  "model": "claude-sonnet-4.5",
  "apiKey": "sk-ant-...",
  "baseURL": "https://api.anthropic.com",
  "maxTokens": 8192,
  "temperature": 0.7
}
```

---

## Testing Checklist

After configuration, verify:

- [ ] Hub endpoint returns markdown with command list
- [ ] OpenCode logs show successful instruction fetch
- [ ] New chat session created in OpenSpace
- [ ] Agent demonstrates knowledge of OpenSpace commands
- [ ] Agent can list available commands when asked

---

## Next Steps

Once configuration is complete:

1. **Test Integration:** Follow the integration test procedure in Task 1.13
2. **Try Commands:** Ask the agent to execute IDE operations (e.g., "Open a new pane")
3. **Explore Features:** Use the Chat widget to interact with the agent
4. **Report Issues:** If commands don't execute, check Task 1.13 troubleshooting

---

## Reference

- **Hub Endpoints:** See `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` §6.4
- **Command Syntax:** `%%OS{"cmd":"openspace.pane.open","args":{...}}%%`
- **BridgeContribution:** Handles manifest publishing and command dispatch
- **OpenCode Documentation:** https://github.com/your-org/opencode

---

**Last Updated:** 2026-02-16  
**Task:** 1.12 (Configure opencode.json Instructions URL)
