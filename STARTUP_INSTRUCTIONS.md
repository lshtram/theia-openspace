# Quick Start

## Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.7 and < 2.0
- (For AI features) OpenCode CLI — the project `opencode.json` is pre-configured

## Start the Application

```bash
yarn start:browser
```

Theia starts on **http://localhost:3000** (30–60 seconds on first build; 2–3 seconds subsequently).

Expected console output:
```
[OpenSpaceCore] Backend module loaded
[Hub] OpenSpace Hub configured at /mcp
Theia app listening on http://127.0.0.1:3000
```

## Smoke Test

### IDE loads
- [ ] Theia loads (file explorer, editor, terminal visible)
- [ ] Window title: "Theia Openspace"
- [ ] Chat panel icon visible in sidebar
- [ ] No Debug/SCM/Notebook panels (intentionally filtered out)
- [ ] No fatal errors in browser console (F12)

### Hub endpoints respond
```bash
# Dynamic system prompt for OpenCode
curl http://localhost:3000/openspace/instructions

# MCP tools list
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Expected: JSON listing 17 MCP tools
```

## Architecture Overview

OpenSpace uses an **MCP-first** architecture — the AI agent controls the IDE via MCP tools, not custom command syntax:

```
OpenCode Agent
    │
    ▼  MCP tools (http://localhost:3000/mcp)
OpenSpace Hub (port 3000, co-located with Theia)
    │
    ▼  Theia RPC / CommandRegistry
Theia IDE Extensions (browser)
```

The Hub exposes 17 MCP tools: pane control (4), editor control (6), terminal sessions (5), file operations (5).

See `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` for the full architecture.

## Connect OpenCode

The project ships with `opencode.json` pre-configured:

```json
{
  "mcp": {
    "openspace-hub": {
      "type": "remote",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

Start Theia first, then start OpenCode — it will auto-discover the MCP server.

See `docs/setup/OPENCODE_CONFIGURATION.md` for details and verification steps.

## Rebuild After Code Changes

```bash
# Rebuild all extensions + browser bundle
yarn build

# Rebuild only webpack bundle (required after changes to browser extensions)
cd browser-app && npx webpack --config webpack.config.js --mode development

# Then hard-refresh: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Linux/Win)
```

**Note:** If Theia is running from a worktree (check with `ps aux | grep main.js`), build in the worktree directory, not the repo root. See `patterns.md` in `.opencode/_context/01_memory/` for details.

## Running Tests

```bash
# Unit tests
yarn test

# E2E (requires Theia running on port 3000) — run incrementally, not all at once
npx playwright test tests/e2e/app-load.spec.ts --reporter=line
yarn test:e2e   # full suite
```

## Troubleshooting

| Symptom | Likely Cause | Fix |
|---|---|---|
| Infinite loading spinner | Build out of date or webpack chunk stale | `yarn build` then Cmd+Shift+R |
| Port 3000 in use | Another Theia or service | `lsof -i :3000` → `kill -9 <PID>` |
| MCP tools/list returns empty | Theia not running | Start Theia first, then OpenCode |
| Chat shows no sessions | OpenCode not connected | Verify OpenCode is running and connected |
| Build errors after `yarn install` | `proxy-factory.js` patch lost | See TECHSPEC §Known Issues for reapply steps |
| Blank screen | Build mismatch or browser cache | Hard-refresh; if persists, `yarn build` |
