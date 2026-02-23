# OpenCode Configuration for OpenSpace

## Overview

OpenSpace provides an MCP (Model Context Protocol) server that gives OpenCode direct control over the IDE. The agent uses MCP tools — not custom command syntax — to open panes, read/write files, run terminal commands, render presentations, and more.

The project root ships with `opencode.json` pre-configured. **No manual setup is required for local development.**

---

## How It Works

```
OpenCode Agent
    │  MCP tools over HTTP (http://localhost:3000/mcp)
    ▼
OpenSpace Hub  ──  /mcp endpoint (McpServer, 17 tools)
    │
    ▼  Theia RPC / CommandRegistry
Theia IDE Extensions (browser, port 3000)
```

1. Theia starts; the Hub registers the MCP server at `/mcp`
2. OpenCode reads `opencode.json` and discovers `openspace-hub`
3. At session start, OpenCode calls `tools/list` — receives 17 IDE control tools
4. OpenCode also fetches `/openspace/instructions` — a dynamic markdown system prompt describing available capabilities
5. The agent calls tools directly; the Hub dispatches them to Theia via RPC

---

## Configuration File

The pre-configured `opencode.json` at the project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ".opencode/_context/AGENT_ONBOARDING.md",
  "mcp": {
    "openspace-hub": {
      "type": "remote",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

OpenCode reads this file automatically from the working directory when started inside the project.

---

## Available MCP Tools (17)

| Group | Tools |
|---|---|
| Pane (4) | `openspace.pane.open`, `openspace.pane.close`, `openspace.pane.focus`, `openspace.pane.list` |
| Editor (6) | `openspace.editor.open`, `openspace.editor.read_file`, `openspace.editor.close`, `openspace.editor.scroll_to`, `openspace.editor.highlight`, `openspace.editor.clear_highlight` |
| Terminal (5) | `openspace.terminal.create`, `openspace.terminal.send`, `openspace.terminal.read_output`, `openspace.terminal.list`, `openspace.terminal.close` |
| File (5, Hub FS) | `openspace.file.read`, `openspace.file.write`, `openspace.file.list`, `openspace.file.search`, `openspace.file.patch` |

---

## Dynamic Instructions Endpoint

At session start, OpenCode fetches:

```
GET http://localhost:3000/openspace/instructions
```

This returns a markdown system prompt generated from the currently registered commands — it tells the agent what IDE capabilities are available and how to use them.

---

## Verifying the Connection

```bash
# 1. Confirm MCP endpoint is live and lists tools
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Expected: JSON response with 17 tools in the result

# 2. Confirm instructions endpoint
curl http://localhost:3000/openspace/instructions
# Expected: markdown system prompt (~several KB)
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `tools/list` returns empty or connection refused | Theia is not running — start it first with `yarn start:browser` |
| 404 on `/mcp` | Wrong port or Hub not started — check that Theia is on port 3000 |
| Agent doesn't know IDE commands | Instructions are fetched per-session — create a new chat session |
| Agent says tools are unavailable | Check OpenCode logs for MCP connection errors; verify `opencode.json` URL |

---

## Reference

- Architecture: `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` §6 (Hub & MCP)
- MCP server implementation: `extensions/openspace-core/src/node/hub-mcp.ts`
- Hub implementation: `extensions/openspace-core/src/node/hub.ts`
- Agent onboarding: `.opencode/_context/AGENT_ONBOARDING.md`
- Retired architecture (%%OS{} syntax): `docs/archive/stale-docs/OPENCODE_CONFIGURATION-STALE.md`

---

**Last Updated:** 2026-02-23
