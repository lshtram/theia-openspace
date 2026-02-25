# Active Context

**Project:** Theia Openspace
**Last Updated:** 2026-02-25

## GitHub Issues - Task Tracking

All tasks are now managed in GitHub Issues: https://github.com/lshtram/theia-openspace/issues

## Current Focus
- **Status:** BUG-7 FIXED, CPU streaming optimizations applied (5 fixes), awaiting user verification in browser
- **Previous:** BUG-7 root cause found (sessionDiff rendering raw JSON), CPU issue root cause found (renderMarkdown, computeSimpleDiff, groupParts, regex allocation all running on every timer tick during streaming)
- **Next:** User browser verification (Cmd+Shift+R), commit fixes

## BUG-7 Fix (2026-02-25) ✅ COMPLETE

**Root cause:** `sessionDiff` feature in `session-service.ts` fetched raw JSON from OpenCode API `/session/{id}/diff` (714KB+ JSON array of file diffs) and stored it as-is. `chat-widget.tsx` rendered it in a `<pre>` tag above the prompt. Only suppression was for exact `[]`/`{}` strings.

**Fix:** `refreshDiff()` now parses the JSON array and produces a human-readable summary:
```
~ AGENTS.md  (+1 -0)
+ design/deck/demo.md  (+703 -0)
```

**File:** `extensions/openspace-core/src/browser/session-service.ts` — `refreshDiff()` method (~line 1069)

## CPU Streaming Optimizations (2026-02-25) ✅ COMPLETE

**Root cause:** During streaming, `React.memo` is bypassed for the streaming message, and two `setInterval` timers (1s each) trigger full re-renders. Multiple expensive operations ran on every tick even when data hadn't changed.

**Fixes applied (5 total):**
1. **`TextPart` memoization** — `React.memo` + `useMemo(() => renderMarkdown(text, onOpenFile), [text])`
2. **`ReasoningBlock` memoization** — `React.memo` + `useMemo(() => renderMarkdown(text), [text])`
3. **`computeSimpleDiff()` memoization** — O(m*n) LCS now wrapped in `useMemo` with `[isEditOrWrite, isEdit, isWrite, input]` deps
4. **`groupParts()` memoization** — `isIntermediateStep` path now uses `useMemo` instead of calling on every render
5. **Regex hoisting** — 6 inline regex literals in `getToolInfo()` moved to module-scope constants (`READ_TOOL_NAMES`, `SEARCH_TOOL_NAMES`, etc.)

**File:** `extensions/openspace-chat/src/browser/message-bubble.tsx`

## DIAG Log Cleanup (2026-02-25) ✅ COMPLETE

Removed previous agent's temporary BUG-7 diagnostic logging from `opencode-proxy.ts` (message.part.updated and message.part.delta handlers).

## Server State
- **PID:** 70575
- **Location:** Repo root: `/Users/Shared/dev/theia-openspace/browser-app/lib/backend/main.js --port 3000`
- **Build status:** All three packages rebuilt (openspace-core, openspace-chat, browser-app webpack)
- **Browser needs:** Hard refresh (Cmd+Shift+R) to pick up webpack changes

**Jumpiness — RESOLVED**
- Was listed as a secondary issue. Eliminated when the N× duplication was fixed.
- No action needed - marked resolved.

### Key files
```
extensions/openspace-chat/src/browser/
  streaming-vocab.ts          ← vocabulary, CHAOS_VOCAB, pickPhrase(), CHAOS_PROBABILITY
  message-bubble.tsx          ← TurnGroup component, phrase pick on category change
  style/chat-widget.css       ← activity bar CSS, shimmer, step dimming
  style/animations/           ← (empty) drop GIF files here when ready

extensions/openspace-core/src/browser/
  opencode-sync-service.ts    ← SSE replay guard (~line 540)
  session-service.ts          ← computeStreamingStatus, toolNameToCategory (~line 1418)
```

### Server location (2026-02-23)
Running from repo root (NOT a worktree):
`/Users/Shared/dev/theia-openspace/browser-app/lib/backend/main.js --port 3000`

### Build commands
```bash
yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app webpack --config webpack.config.js --mode development
# Then Cmd+Shift+R in browser
```

**Goal:** Replace `%%OS{...}%%` stream interceptor with MCP tools as the sole agent→IDE command path.

**Build:** ✅ PASS (37.9s, 0 errors)  
**Unit Tests:** ✅ 387/387 passing  
**E2E:** Pre-existing infrastructure issue (same as baseline — not introduced by T3)

### Build commands
```bash
yarn --cwd extensions/openspace-core build
yarn --cwd extensions/openspace-chat build
yarn --cwd browser-app webpack --config webpack.config.js --mode development
# Then Cmd+Shift+R in browser
```

## Key References

| What | Where |
|---|---|
| Session analysis (features) | `docs/reviews/SESSION-ANALYSIS-FEATURES-2026-02-25.md` |
| Session analysis (bugs) | `docs/reviews/SESSION-ANALYSIS-BUGS-2026-02-25.md` |
| Session analysis (agent patterns) | `docs/reviews/SESSION-ANALYSIS-AGENT-PATTERNS-2026-02-25.md` |
| All sessions CSV | `archive/root-debris/all_sessions_tracker.csv` (178 sessions) |
| MCP Tools (17) | Pane×4, Editor×6, Terminal×5, File×5 via Hub `/mcp` |
| Architecture | B1 hybrid (Theia AI + custom widget) |

## Known Issues for Future Agents
- **proxy-factory.js patch**: In `node_modules/` — survives `yarn build` but NOT `yarn install`. If re-run, must reapply.
- LSP/TS errors in Theia's own `node_modules` are pre-existing — ignore
- webpack build errors in openspace-layout are pre-existing — unrelated
- **GIF animation slot**: Awaiting user-created assets. Drop files in `extensions/openspace-chat/src/browser/style/animations/`