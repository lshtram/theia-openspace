# Theia OpenSpace

An AI-native IDE built on [Eclipse Theia](https://theia-ide.org/), designed to be controlled by an AI agent (OpenCode) via MCP tools. The agent sees the IDE as a set of tools — opening panes, reading/writing files, running terminal commands, presenting content — while the human collaborates through the chat panel.

---

## Architecture

```
OpenCode Agent (external process)
    │
    ▼  MCP tools (http://localhost:3000/mcp)
OpenSpace Hub  ──────────────────────────────┐
    │                                         │
    ▼  Theia RPC                              │
Theia IDE Extensions (browser, port 3000)    │
    ├─ openspace-core    (Hub, MCP server) ◄──┘
    ├─ openspace-chat    (chat panel + session management)
    ├─ openspace-presentation  (reveal.js slides modality)
    ├─ openspace-whiteboard    (tldraw canvas modality)
    ├─ openspace-layout        (custom pane layout)
    └─ openspace-settings      (preferences)
```

The agent controls the IDE exclusively via **17 MCP tools** — no custom command syntax, no stream interceptors. The Hub runs co-located with Theia on port 3000.

Full architecture: `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md`  
Work plan + phase status: `docs/architecture/WORKPLAN.md`

---

## Features

| Modality | Description |
|---|---|
| **Chat** | Full session management, streaming responses, tool-use cards, model display |
| **Presentation** | reveal.js slide viewer/editor, agent-controllable |
| **Whiteboard** | tldraw canvas, agent-controllable |
| **Voice** | Voice command input (OpenAI Kokoro TTS/STT integration) |
| **Marketplace** | VS Code extension compatibility layer |
| **MCP Agent Control** | 17 tools: pane, editor, terminal, file operations |
| **Permission System** | First-run consent, dangerous command confirmation, sensitive file denylist |

---

## Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.7 and < 2.0
- (For AI features) OpenCode CLI

---

## Setup

```bash
yarn install
yarn build
```

---

## Running

```bash
yarn start:browser
# Opens at http://localhost:3000
```

See `STARTUP_INSTRUCTIONS.md` for a detailed startup guide, smoke test checklist, and troubleshooting.

---

## Connecting OpenCode

The project ships with `opencode.json` pre-configured. Start Theia first, then start OpenCode — it will auto-discover the MCP server at `http://localhost:3000/mcp`.

See `docs/setup/OPENCODE_CONFIGURATION.md` for details.

---

## Development

```bash
yarn build:extensions   # rebuild extensions only
yarn build:browser      # rebuild webpack bundle only
yarn watch              # watch mode
yarn clean              # clean all build outputs
yarn test               # unit tests
yarn test:e2e           # E2E tests (requires Theia running)
```

**Important:** After changing browser-extension code, you must also rebuild the webpack bundle and hard-refresh the browser (Cmd+Shift+R). See `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` for the full build sequence.

---

## Project Structure

```
extensions/
  openspace-core/          # Hub, MCP server, OpenCode proxy, permission system
  openspace-chat/          # Chat widget, session management
  openspace-presentation/  # Presentation modality
  openspace-whiteboard/    # Whiteboard modality
  openspace-layout/        # Layout management
  openspace-settings/      # Settings
browser-app/               # Theia browser app target
tests/e2e/                 # Playwright E2E tests
docs/
  architecture/            # TECHSPEC, WORKPLAN, RFCs, decisions
  requirements/            # REQ-OPENSPACE (features), REQ-AGENT-IDE-CONTROL
  setup/                   # Setup guides (OpenCode config, etc.)
  guides/                  # Feature guides
  testing/                 # Manual test procedures
  technical-debt/          # Known gaps and deferred work
.opencode/
  _context/                # Agent onboarding and memory (see AGENT_ONBOARDING.md)
  skills/                  # Project-level OpenCode skills
```

---

## Agent Onboarding

New agent session? Start here: **`.opencode/_context/AGENT_ONBOARDING.md`**

This document gives an agent everything it needs to understand the project, find relevant files, and follow the right directives — in under 5 minutes of reading.

---

## License

MIT
