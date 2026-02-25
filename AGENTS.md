<!-- # reviewed -->
# Agent Onboarding

**Read this first at every new session.** It gives you the project context, current state, where to find things, and the directives that govern agent behaviour in this project.

---

## What This Project Is

**Theia OpenSpace** is an AI-native IDE built on Eclipse Theia. You (the AI agent) control the IDE via MCP tools. The human collaborates through the chat panel inside the IDE.

- **Your entry point:** `http://localhost:3000/mcp` - 17 MCP tools
- **Your system prompt:** fetched from `http://localhost:3000/openspace/instructions`
- **Human's interface:** Theia chat panel in the browser at `http://localhost:3000`

---

## Current State

See `.opencode/_context/01_memory/progress.md` for the detailed phase-by-phase completion log.

**Summary as of 2026-02-23:**
- ✅ Phase 0: Scaffold
- ✅ Phase 1 + 1B1 + 1C: Core connection, chat, session management, hardening
- ✅ Phase 2B: SDK type adoption
- ✅ Phase 3: MCP agent control (17 tools)
- ✅ Phase T3: Stream interceptor retired; MCP is the sole command path
- ✅ Phase 4: Modality surfaces (presentation, whiteboard)
- ✅ Phase T4/T5/T6/EW/EW.5: ArtifactStore, PatchEngine, voice, waveform, streaming UX
- ✅ Phase 6.8/1C: E2E suite, code hardening
- 🔄 Phase 5: Polish & Desktop - in progress
- ⬜ Phase 6: Extended features

---

## Where to Find Things

| What | Where |
|---|---|
| Architecture (authoritative) | `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` |
| Phase completion status | `docs/architecture/WORKPLAN.md` |
| Requirements tracker | `docs/requirements/REQ-OPENSPACE.md` |
| Feature requirements | `docs/requirements/REQ-AGENT-IDE-CONTROL.md` |
| Session analysis (features) | `docs/reviews/SESSION-ANALYSIS-FEATURES-2026-02-25.md` |
| Session analysis (bugs) | `docs/reviews/SESSION-ANALYSIS-BUGS-2026-02-25.md` |
| Session analysis (agent patterns) | `docs/reviews/SESSION-ANALYSIS-AGENT-PATTERNS-2026-02-25.md` |
| Known bugs | GitHub Issues: https://github.com/lshtram/theia-openspace/issues |
| Technical debt | `docs/technical-debt/` |
| Coding standards | `CODING_STANDARDS.md` |
| E2E test patterns | `docs/technical-debt/E2E-INFRASTRUCTURE-GAP.md` |
| Agent memory (current context) | `.opencode/_context/01_memory/active_context.md` |
| Agent memory (patterns/gotchas) | `.opencode/_context/01_memory/patterns.md` |
| Agent memory (progress log) | `.opencode/_context/01_memory/progress.md` |
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
If it is a worktree (`.worktrees/<name>/`), build there - not in the repo root.
See `.opencode/_context/01_memory/patterns.md` -> "The Server Runs From a Worktree".

### Rule 4: E2E tests - run incrementally
Never run the full suite in one command; it times out. Start with one spec file, then expand.
See `.opencode/_context/01_memory/patterns.md` -> "E2E Testing Protocol: Incremental Execution".

### Rule 5: E2E required before push for production changes
Any commit touching Hub routes, MCP tools, browser extensions, ArtifactStore, or PatchEngine
requires the full E2E suite to pass before `git push`.

### Rule 6: Webpack bundle rebuild required after browser extension changes
After TypeScript changes to a browser extension, rebuild the webpack bundle:
`yarn --cwd browser-app webpack --config webpack.config.js --mode development`
Then hard-refresh the browser (Cmd+Shift+R).

### Rule 7: React imports in Theia extensions
Always use `import * as React from '@theia/core/shared/react'`, not bare `'react'`.

### Rule 8: Circular DI pattern
Avoid `@inject()` cycles. Use setter injection + `queueMicrotask` wiring.
See `.opencode/_context/01_memory/patterns.md` -> "Circular DI Dependencies".

### Rule 9: Command snippets must not use `cd`
Assume the shell working directory is always `/Users/Shared/dev/theia-openspace`.
Do not provide command snippets that start with `cd ...` (especially not `cd ~`), because
it can move the user to the wrong directory and break build/test workflows.

### Rule 10: Use GitHub Issues for task and bug tracking
All tasks, bugs, and deferred issues must be tracked in GitHub Issues.
- Tasks are managed via GitHub Issues (not in-memory todo lists)
- Use the `report-github-issue` skill when a bug is found or a new task is identified
- Label issues as `bug` or `enhancement` with relevant priority labels
- View all issues at: https://github.com/lshtram/theia-openspace/issues

---

## Superpowers Skills

This project uses OpenCode superpowers skills at two levels:

**User-level skills** (apply globally, all projects):
- Location: `/Users/agentuser/.config/opencode/skills/superpowers/`
- Key skills: `brainstorming`, `writing-plans`, `executing-plans`, `test-driven-development`, `systematic-debugging`, `verification-before-completion`, `requesting-code-review`, `receiving-code-review`

**Project-level skills** (apply only to this project):
- Location: `.opencode/skills/`
- Current skills: `presentation-builder`, `draw-diagram`, `report-github-issue`
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
1. Update `.opencode/_context/01_memory/active_context.md` with current focus and recent decisions
2. Add new patterns/gotchas to `.opencode/_context/01_memory/patterns.md`
3. Update `.opencode/_context/01_memory/progress.md` with completed milestones
4. Keep each memory file under 200 lines (archive overflow to `docs/archive/`)
