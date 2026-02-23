# Documentation Restructure Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Clean up project documentation: archive junk/stale files, rewrite stale setup docs, expand the README, and establish a clear agent onboarding structure with explicit separation between project docs and agent behaviour directives.

**Architecture:** 
- Create `docs/archive/` subtrees (gitignored) for debris, stale docs, and completed plans
- Rewrite stale docs (`STARTUP_INSTRUCTIONS.md`, `docs/setup/OPENCODE_CONFIGURATION.md`, `docs/requirements/REQ-OPENSPACE.md`) to reflect current MCP architecture
- Expand `README.md` to be a proper front-door document
- Establish `.opencode/_context/` as the canonical agent onboarding location, with a clear `AGENT_ONBOARDING.md` as the single entry point for new agent sessions

**No deletions.** Everything moved to archive is preserved and discoverable.

---

## Task 1: Add archive paths to .gitignore

**Files:**
- Modify: `.gitignore`

**Step 1: Add archive entries to .gitignore**

Add these lines to `.gitignore` (after the existing "Internal docs" block):

```
# Archives — preserved for reference but not committed
docs/archive/
archive/
```

**Step 2: Verify the change**

Run: `grep -n "archive" .gitignore`
Expected: lines showing the two new entries.

**Step 3: Commit**

```bash
git add .gitignore
git commit -m "chore: add archive directories to .gitignore"
```

---

## Task 2: Archive root-level debris

**Files:**
- Move (not delete): all junk files from project root → `archive/root-debris/`

**Step 1: Create archive directory**

```bash
mkdir -p archive/root-debris
```

**Step 2: Move session analysis files**

```bash
mv session_analysis_*.md archive/root-debris/
mv session_improvements_*.md archive/root-debris/
mv session_analysis_tracker.csv archive/root-debris/
mv all_sessions_tracker.csv archive/root-debris/
```

**Step 3: Move PNG screenshots**

```bash
mv *.png archive/root-debris/
```

**Step 4: Move misc text artifacts**

```bash
mv poem-draft-*.txt archive/root-debris/
mv console-debug.txt archive/root-debris/
mv Untitled.txt archive/root-debris/
mv network-requests.txt archive/root-debris/
mv nvidia-presentation.html archive/root-debris/
```

**Step 5: Move misplaced doc artifacts**

```bash
mv PHASE_4_3_4_6_SUMMARY.md archive/root-debris/
mv model-selection-protocol.md archive/root-debris/
```

**Step 6: Verify root is clean**

Run: `ls *.md *.txt *.html *.png *.csv 2>/dev/null`
Expected: only `README.md`, `CODING_STANDARDS.md`, `KNOWN_BUGS.md`, `STARTUP_INSTRUCTIONS.md` (to be rewritten next)

**Step 7: Commit**

Note: archive/ is gitignored so these files drop from git tracking. The commit just records the removal.

```bash
git add -A
git commit -m "chore: archive root-level debris to archive/root-debris/"
```

---

## Task 3: Archive completed plans

**Files:**
- Move: `docs/plans/*.md` (all dated implementation plans) → `docs/archive/plans/`
- Keep: `docs/plans/` directory (for future plans)
- Note: `docs/plans/chat-window-mockup*.html` and `docs/plans/screenshots/` also move

**Step 1: Create archive directory**

```bash
mkdir -p docs/archive/plans
```

**Step 2: Move all dated plans**

```bash
mv docs/plans/2026-*.md docs/archive/plans/
mv docs/plans/chat-window-mockup*.html docs/archive/plans/
mv docs/plans/screenshots docs/archive/plans/
```

**Step 3: Verify plans directory is now empty (except current plan)**

Run: `ls docs/plans/`
Expected: only `2026-02-23-doc-restructure.md` (this plan, currently being executed)

**Step 4: Commit**

```bash
git add -A
git commit -m "chore: archive completed implementation plans to docs/archive/plans/"
```

---

## Task 4: Archive stale setup docs

**Files:**
- Move: `docs/setup/OPENCODE_CONFIGURATION.md` → `docs/archive/stale-docs/OPENCODE_CONFIGURATION-STALE.md`
- Move: `STARTUP_INSTRUCTIONS.md` → `archive/root-debris/STARTUP_INSTRUCTIONS-STALE.md`

**Step 1: Create stale-docs archive dir**

```bash
mkdir -p docs/archive/stale-docs
```

**Step 2: Move the stale files**

```bash
mv docs/setup/OPENCODE_CONFIGURATION.md docs/archive/stale-docs/OPENCODE_CONFIGURATION-STALE.md
mv STARTUP_INSTRUCTIONS.md archive/root-debris/STARTUP_INSTRUCTIONS-STALE.md
```

**Step 3: Commit**

```bash
git add -A
git commit -m "chore: archive stale setup docs that describe retired %%OS{} architecture"
```

---

## Task 5: Rewrite STARTUP_INSTRUCTIONS.md

**Files:**
- Create: `STARTUP_INSTRUCTIONS.md` (current architecture — MCP-based)

**Step 1: Write the new startup guide**

Create `STARTUP_INSTRUCTIONS.md` with this content:

```markdown
# Quick Start

## Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.7 and < 2.0
- OpenCode CLI installed and configured (`opencode.json` at project root is pre-configured)

## Start the Application

```bash
yarn start:browser
```

Theia starts on **http://localhost:3000** (30–60 seconds first build; 2–3 seconds subsequent).

Expected console output:
```
[OpenSpaceCore] Backend module loaded
[Hub] OpenSpace Hub configured at /mcp
Theia app listening on http://127.0.0.1:3000
```

## Verify the Application

### IDE smoke test
- Theia IDE loads (file explorer, editor, terminal visible)
- Window title: "Theia Openspace"
- No Debug/SCM/Notebook panels (intentionally filtered)
- Chat panel visible in sidebar

### Hub endpoints
```bash
# Instructions endpoint (used by OpenCode as system prompt)
curl http://localhost:3000/openspace/instructions

# Hub manifest
curl http://localhost:3000/openspace/manifest

# MCP endpoint (used by OpenCode agent for IDE control)
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
```

## Connect OpenCode

The project ships with `opencode.json` pre-configured to connect OpenCode to this IDE:

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

Start OpenCode (in a separate terminal) and it will automatically discover the 17 MCP tools.

## Architecture Overview

OpenSpace uses an **MCP-first** architecture:

```
OpenCode Agent
    │
    ▼ MCP tools (http://localhost:3000/mcp)
OpenSpace Hub (port 3000, co-located with Theia)
    │
    ▼ Theia CommandRegistry / RPC
Theia IDE Extensions
```

The agent controls the IDE exclusively via MCP tools — no stream interceptors, no SSE relay.  
See `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` for the full architecture.

## Rebuild After Code Changes

```bash
# Rebuild all extensions + browser bundle
yarn build

# Rebuild only browser webpack bundle (needed after browser-extension changes)
cd browser-app && npx webpack --config webpack.config.js --mode development

# Then force-refresh browser: Cmd+Shift+R (Mac) / Ctrl+Shift+R (Linux/Win)
```

## Troubleshooting

| Symptom | Cause | Fix |
|---|---|---|
| Infinite loading spinner | Build out of date | `yarn build` then hard-refresh |
| Port 3000 in use | Another process | `lsof -i :3000` then `kill -9 <PID>` |
| MCP tools not found | Theia not running | Start Theia first, then OpenCode |
| Build errors after `yarn install` | `proxy-factory.js` patch lost | See `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` §Known Issues |

## Running Tests

```bash
# Unit tests
yarn test

# E2E tests (requires Theia running on port 3000)
npx playwright test app-load.spec.ts   # start small — see patterns.md
yarn test:e2e                           # full suite
```
```

**Step 2: Verify file was created and reads correctly**

Run: `wc -l STARTUP_INSTRUCTIONS.md`
Expected: ~80 lines

**Step 3: Commit**

```bash
git add STARTUP_INSTRUCTIONS.md
git commit -m "docs: rewrite STARTUP_INSTRUCTIONS.md for current MCP architecture"
```

---

## Task 6: Rewrite docs/setup/OPENCODE_CONFIGURATION.md

**Files:**
- Create: `docs/setup/OPENCODE_CONFIGURATION.md` (current architecture)

**Step 1: Write the new configuration guide**

Create `docs/setup/OPENCODE_CONFIGURATION.md`:

```markdown
# OpenCode Configuration for OpenSpace

## Overview

OpenSpace provides an MCP (Model Context Protocol) server that gives OpenCode direct control over the IDE. The agent uses MCP tools — not custom command syntax — to open panes, read/write files, run terminal commands, and more.

The project root ships with `opencode.json` pre-configured. No manual setup is required for local development.

---

## How It Works

```
OpenCode Agent
    │  MCP tools (http://localhost:3000/mcp)
    ▼
OpenSpace Hub  ──  /mcp endpoint (McpServer, 17 tools)
    │
    ▼
Theia IDE (browser, port 3000)
```

1. Theia starts and the Hub registers at `http://localhost:3000/mcp`
2. OpenCode reads `opencode.json` and discovers the `openspace-hub` MCP server
3. Agent lists available tools with `tools/list` — gets 17 IDE control tools
4. Agent calls tools directly; Hub dispatches them to Theia's CommandRegistry via RPC

---

## Configuration File

The pre-configured `opencode.json` at the project root:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "openspace-hub": {
      "type": "remote",
      "url": "http://localhost:3000/mcp"
    }
  }
}
```

OpenCode reads this file automatically from the working directory.

---

## Available MCP Tools (17)

| Group | Tools |
|---|---|
| Pane (4) | `openspace.pane.open`, `close`, `focus`, `list` |
| Editor (6) | `openspace.editor.open`, `read_file`, `close`, `scroll_to`, `highlight`, `clear_highlight` |
| Terminal (5) | `openspace.terminal.create`, `send`, `read_output`, `list`, `close` |
| File (5, Hub FS) | `openspace.file.read`, `write`, `list`, `search`, `patch` |

---

## Dynamic Instructions

OpenCode also fetches a dynamic system prompt from:

```
http://localhost:3000/openspace/instructions
```

This endpoint returns a markdown document describing the IDE's capabilities, currently available panes, and agent behaviour directives. OpenCode fetches this at session start.

---

## Verifying the Connection

```bash
# 1. Confirm MCP endpoint is live
curl -X POST http://localhost:3000/mcp \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/list","params":{}}'
# Expected: JSON with 17 tools listed

# 2. Confirm instructions endpoint
curl http://localhost:3000/openspace/instructions
# Expected: markdown system prompt
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| `tools/list` returns empty | Theia not running — start first |
| 404 on `/mcp` | Wrong port — check `opencode.json`, Hub is on port 3000 |
| Agent doesn't know IDE commands | Session fetches instructions at start — create a new session |

---

## Reference

- Architecture: `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` §6.4 (Hub), §6.5 (MCP)
- MCP server implementation: `extensions/openspace-core/src/node/hub-mcp.ts`
- Retired architecture: `docs/archive/stale-docs/OPENCODE_CONFIGURATION-STALE.md`
```

**Step 2: Commit**

```bash
git add docs/setup/OPENCODE_CONFIGURATION.md
git commit -m "docs: rewrite OpenCode configuration guide for MCP architecture"
```

---

## Task 7: Update REQ-OPENSPACE.md status to reflect completed phases

**Files:**
- Modify: `docs/requirements/REQ-OPENSPACE.md`

**Step 1: Read the current file**

Read `docs/requirements/REQ-OPENSPACE.md` in full.

**Step 2: Update completion status**

The following phases are complete per `docs/architecture/WORKPLAN.md` and must be reflected:
- Phase 0: All tasks ✅
- Phase 1: All tasks (1.1–1.15) ✅  
- Phase 1B1: All tasks ✅
- Phase 1C: All tasks (hardening) ✅
- Phase 2B: SDK types adoption ✅
- Phase 3: All tasks (3.1–3.11) — MCP agent control ✅
- Phase T3: MCP migration ✅
- Phase 4: Modality surfaces ✅ (per WORKPLAN)
- Phase T4/T5/T6/EW/EW.5/6.8: ✅ per WORKPLAN

Update every `⬜ Pending` item that maps to a completed phase to `✅ Complete`.

Add a header note:
```markdown
> **Last Updated:** 2026-02-23 — Status synchronized with WORKPLAN.md.  
> See `docs/architecture/WORKPLAN.md` for the authoritative phase completion record.
```

**Step 3: Commit**

```bash
git add docs/requirements/REQ-OPENSPACE.md
git commit -m "docs: sync REQ-OPENSPACE.md status with completed phases per WORKPLAN"
```

---

## Task 8: Expand README.md

**Files:**
- Modify: `README.md`

**Step 1: Rewrite README.md**

Replace the content of `README.md` with a comprehensive front-door document:

```markdown
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
  openspace-core/       # Hub, MCP server, OpenCode proxy, permission system
  openspace-chat/       # Chat widget, session management
  openspace-presentation/  # Presentation modality
  openspace-whiteboard/    # Whiteboard modality
  openspace-layout/        # Layout management
  openspace-settings/      # Settings
browser-app/            # Theia browser app target
tests/e2e/              # Playwright E2E tests
docs/
  architecture/         # TECHSPEC, WORKPLAN, RFCs, decisions
  requirements/         # REQ-OPENSPACE (features), REQ-AGENT-IDE-CONTROL
  setup/                # Setup guides (OpenCode config, etc.)
  guides/               # Feature guides
  testing/              # Manual test procedures
  technical-debt/       # Known gaps and deferred work
.opencode/
  _context/             # Agent onboarding and memory (see AGENT_ONBOARDING.md)
  skills/               # Project-level OpenCode skills
```

---

## Agent Onboarding

New agent session? Start here: **`.opencode/_context/AGENT_ONBOARDING.md`**

This document gives an agent everything it needs to understand the project, find relevant files, and follow the right directives — in under 5 minutes of reading.

---

## License

MIT
```

**Step 2: Verify file reads correctly**

Run: `wc -l README.md`
Expected: ~110 lines

**Step 3: Commit**

```bash
git add README.md
git commit -m "docs: expand README with architecture, features, and agent onboarding pointer"
```

---

## Task 9: Create AGENT_ONBOARDING.md

This is the single document a new agent reads at session start. It replaces the scattered `active_context.md` / `progress.md` / `patterns.md` as the *entry point* (those files remain as depth references).

**Files:**
- Create: `.opencode/_context/AGENT_ONBOARDING.md`

**Step 1: Write the onboarding document**

Create `.opencode/_context/AGENT_ONBOARDING.md`:

```markdown
# Agent Onboarding

**Read this first at every new session.** It gives you the project context, current state, where to find things, and the directives that govern agent behaviour in this project.

---

## What This Project Is

**Theia OpenSpace** is an AI-native IDE built on Eclipse Theia. You (the AI agent) control the IDE via MCP tools. The human collaborates through the chat panel inside the IDE.

- **Your entry point:** `http://localhost:3000/mcp` — 17 MCP tools
- **Your system prompt:** fetched from `http://localhost:3000/openspace/instructions`
- **Human's interface:** Theia chat panel in the browser at `http://localhost:3000`

---

## Current State

See `01_memory/progress.md` for the detailed phase-by-phase completion log.

**Summary as of 2026-02-23:**
- ✅ Phase 0: Scaffold
- ✅ Phase 1 + 1B1 + 1C: Core connection, chat, session management, hardening
- ✅ Phase 2B: SDK type adoption
- ✅ Phase 3: MCP agent control (17 tools)
- ✅ Phase T3: Stream interceptor retired; MCP is the sole command path
- ✅ Phase 4: Modality surfaces (presentation, whiteboard)
- ✅ Phase T4/T5/T6/EW/EW.5: ArtifactStore, PatchEngine, voice, waveform, streaming UX
- ✅ Phase 6.8/1C: E2E suite, code hardening
- 🔄 Phase 5: Polish & Desktop — in progress
- ⬜ Phase 6: Extended features

---

## Where to Find Things

| What | Where |
|---|---|
| Architecture (authoritative) | `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` |
| Phase completion status | `docs/architecture/WORKPLAN.md` |
| Requirements tracker | `docs/requirements/REQ-OPENSPACE.md` |
| Feature requirements | `docs/requirements/REQ-AGENT-IDE-CONTROL.md` |
| Known bugs | `KNOWN_BUGS.md` |
| Technical debt | `docs/technical-debt/` |
| Coding standards | `CODING_STANDARDS.md` |
| E2E test patterns | `docs/technical-debt/E2E-INFRASTRUCTURE-GAP.md` |
| Agent memory (current context) | `01_memory/active_context.md` |
| Agent memory (patterns/gotchas) | `01_memory/patterns.md` |
| Agent memory (progress log) | `01_memory/progress.md` |
| Hub MCP server | `extensions/openspace-core/src/node/hub-mcp.ts` |
| OpenCode proxy | `extensions/openspace-core/src/node/opencode-proxy.ts` |
| Chat widget | `extensions/openspace-chat/src/browser/chat-widget.tsx` |

---

## Agent Behaviour Directives

These are accumulated project-specific rules. They are additive to the user-level superpowers skills.

### Rule 1: Never modify OpenCode server code
Any files under `/Users/Shared/dev/opencode/` or equivalent are off-limits.  
OpenCode is an external dependency. Modifications create a maintenance burden.

### Rule 2: Never modify Theia core code
`node_modules/@theia/*` is off-limits. Use proper Theia extension APIs.  
**Exception:** The `proxy-factory.js` patch (see patterns.md) is a known violation pending upstream fix.

### Rule 3: Build target may be a worktree
Before any build step, run `ps aux | grep main.js` to confirm which directory Theia is serving from.  
If it is a worktree (`.worktrees/<name>/`), build there — not in the repo root.  
See `01_memory/patterns.md` → "The Server Runs From a Worktree".

### Rule 4: E2E tests — run incrementally
Never run the full suite in one command; it times out. Start with one spec file, then expand.  
See `01_memory/patterns.md` → "E2E Testing Protocol: Incremental Execution".

### Rule 5: E2E required before push for production changes
Any commit touching Hub routes, MCP tools, browser extensions, ArtifactStore, or PatchEngine  
requires the full E2E suite to pass before `git push`.

### Rule 6: Webpack bundle rebuild required after browser extension changes
After TypeScript changes to a browser extension, rebuild the webpack bundle:  
`cd browser-app && npx webpack --config webpack.config.js --mode development`  
Then hard-refresh the browser (Cmd+Shift+R).

### Rule 7: React imports in Theia extensions
Always use `import * as React from '@theia/core/shared/react'`, not bare `'react'`.

### Rule 8: Circular DI pattern
Avoid `@inject()` cycles. Use setter injection + `queueMicrotask` wiring.  
See `01_memory/patterns.md` → "Circular DI Dependencies".

---

## Superpowers Skills

This project uses OpenCode superpowers skills at two levels:

**User-level skills** (apply globally, all projects):
- Location: `/Users/agentuser/.config/opencode/skills/superpowers/`
- Key skills: `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`

**Project-level skills** (apply only to this project):
- Location: `.opencode/skills/`
- Current skills: `presentation-builder`, `draw-diagram`
- These extend or override user-level skills for OpenSpace-specific workflows

When a skill applies, invoke it before taking any action. See `using-superpowers` skill for the full protocol.

---

## MCP Tools Quick Reference

| Tool | Description |
|---|---|
| `openspace.pane.open/close/focus/list` | Manage IDE panes |
| `openspace.editor.open/read_file/close/scroll_to/highlight/clear_highlight` | Editor control |
| `openspace.terminal.create/send/read_output/list/close` | Terminal sessions |
| `openspace.file.read/write/list/search/patch` | File system (Hub-direct) |

---

## Memory Update Protocol

At the end of every session:
1. Update `01_memory/active_context.md` with current focus and recent decisions
2. Add new patterns/gotchas to `01_memory/patterns.md`
3. Update `01_memory/progress.md` with completed milestones
4. Keep each memory file under 200 lines (archive overflow to `docs/archive/`)
```

**Step 2: Verify the file was created**

Run: `wc -l .opencode/_context/AGENT_ONBOARDING.md`
Expected: ~130 lines

**Step 3: Commit**

```bash
git add .opencode/_context/AGENT_ONBOARDING.md
git commit -m "docs: add AGENT_ONBOARDING.md as canonical agent session entry point"
```

---

## Task 10: Add AGENT_ONBOARDING pointer to opencode.json instructions

The best way to ensure every new agent session reads the onboarding doc is to reference it from `opencode.json` via the instructions URL. However, since `opencode.json` uses an HTTP URL (pointing to the running Theia Hub), and the Hub's `/openspace/instructions` endpoint is dynamically generated, the simplest approach is to add a `rules` field to `opencode.json` pointing agents to the onboarding file.

**Files:**
- Modify: `opencode.json`

**Step 1: Read current opencode.json**

(Already read — content above.)

**Step 2: Add instructions pointer**

Update `opencode.json` to add:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "instructions": ".opencode/_context/AGENT_ONBOARDING.md",
  "skills": {
    "paths": [".opencode/skills"]
  },
  "mcp": { ... }
}
```

The `instructions` field accepts a file path. This loads the onboarding doc into every new agent session automatically.

**Step 3: Commit**

```bash
git add opencode.json
git commit -m "config: wire AGENT_ONBOARDING.md into opencode.json instructions field"
```

---

## Task 11: Final verification

**Step 1: Verify root is clean**

Run: `ls /Users/Shared/dev/theia-openspace/*.md`
Expected: `CODING_STANDARDS.md`, `KNOWN_BUGS.md`, `README.md`, `STARTUP_INSTRUCTIONS.md`

**Step 2: Verify docs/plans is clean**

Run: `ls docs/plans/`
Expected: only `2026-02-23-doc-restructure.md`

**Step 3: Verify docs/setup is current**

Run: `head -5 docs/setup/OPENCODE_CONFIGURATION.md`
Expected: new MCP-centric header

**Step 4: Verify agent onboarding exists**

Run: `ls .opencode/_context/`
Expected: `AGENT_ONBOARDING.md`, `01_memory/`

**Step 5: Verify .gitignore covers archives**

Run: `grep archive .gitignore`
Expected: two archive entries

**Step 6: Final commit if any cleanup needed**

```bash
git status
# If anything unstaged:
git add -A && git commit -m "docs: final cleanup pass"
```
