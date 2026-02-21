# Design: Whiteboard Diagram MCP Test Suite

**Date:** 2026-02-19
**Status:** Approved

## Goal

Create a Playwright-based test suite that automatically validates all 21 diagram types
and 3 themes before any live demo. Tests must catch rendering bugs (wrong shape types,
missing shapes, MCP errors) without human review.

## Context

- Server runs at `localhost:3000` (worktree: `.worktrees/whiteboard-direct-mount/`)
- 13 whiteboard MCP tools exist including `replace`, `find_shapes`, `batch_add_shapes`
- Existing test infrastructure: `tests/e2e/`, `playwright.config.ts`, `tests/e2e/helpers/mcp.ts`
- Arrow format in tldraw 4.x: `start: {x, y}`, `end: {x, y}` (plain VecModel, NOT `{type: "point", ...}`)
- Note shape: `type: "note"` (NOT `type: "geo", props.geo: "note"`)

## Architecture

### Single new file

`tests/e2e/whiteboard-diagrams.spec.ts`

Slots into the existing `tests/e2e/` test directory. Uses the existing `mcpCall` helper
from `tests/e2e/helpers/mcp.ts`. No new infrastructure needed.

### Three describe blocks

**Block 1 — `Whiteboard MCP — tools catalog`**
Fast smoke test: calls `tools/list`, asserts all 13 whiteboard tools are present.
Runs first. Fails fast if the server doesn't have the tools registered.

**Block 2 — `Whiteboard MCP — diagram types` (21 tests)**
One test per diagram type. Each test:
1. Calls `openspace.whiteboard.create` to get a fresh whiteboard ID
2. Calls `openspace.whiteboard.replace` with a minimal but correct diagram (3–6 shapes, 1–2 arrows)
3. Calls `openspace.whiteboard.find_shapes` with `{}` to count all shapes
4. Asserts: `result.shapes.length >= EXPECTED_MIN_SHAPES[type]`, no error in response

**3 of the 21 tests are also "full E2E"**: `flowchart`, `sequence`, `c4-context`.
These additionally:
- Navigate to `localhost:3000` in a browser page
- Open the whiteboard (`openspace.whiteboard.open`)
- Take a screenshot (saved to `test-results/diagrams/`)
- Assert the page renders without JS errors

**Block 3 — `Whiteboard MCP — themes` (3 tests)**
Uses `flowchart` as the reference diagram. One test per theme (technical, beautiful, presentation).
Applies theme colors (tldraw named colors from theme mapping). Same assert pattern as block 2.

### Fail fast

Tests use Playwright's default sequential execution within a spec file (`fullyParallel: false`
at the project level). First failure stops the run.

## Shape Payload Conventions

All shape payloads follow these rules:
- Geo shapes: `{type: "geo", x, y, w, h, props: {geo, color, fill, dash}}`
- Text shapes: `{type: "text", x, y, props: {richText: {type:"doc", content:[{type:"paragraph",content:[{type:"text",text:"..."}]}]}}}`
- Arrow shapes: `{type: "arrow", x:0, y:0, props: {start:{x,y}, end:{x,y}, color, dash, arrowheadEnd}}`
- Note shapes: `{type: "note", x, y, w, h, props: {color}}`
- All colors use tldraw named colors (black, blue, red, green, grey, etc.)
- Coordinates are canvas-absolute integers

## Diagram Type → tldraw Shape Mapping

| Diagram type | Primary geo | Arrow style | Note |
|---|---|---|---|
| flowchart | rectangle, diamond | draw/dashed | diamond for decision |
| sequence | rectangle (lifeline) | draw | note for comments |
| activity | rectangle, diamond | draw | |
| state | ellipse | draw | |
| use-case | ellipse, oval | draw | |
| class | rectangle | dashed | text rows inside |
| object | rectangle | dashed | |
| component | rectangle | dashed | |
| composite-structure | rectangle | draw | |
| deployment | rectangle | draw | |
| package | rectangle | dashed | |
| er | rectangle | draw | |
| c4-context | rectangle | draw | |
| c4-container | rectangle | draw | |
| communication | ellipse | draw | |
| block | rectangle | draw | |
| mind-map | ellipse, rectangle | draw | |
| network | rectangle | draw | |
| gantt | rectangle | none | text for dates |
| timing | rectangle | draw | |
| interaction-overview | rectangle, diamond | draw | |

## Expected Minimum Shape Counts

| Diagram type | Min shapes |
|---|---|
| flowchart | 5 |
| sequence | 5 |
| activity | 5 |
| state | 4 |
| use-case | 4 |
| class | 3 |
| object | 3 |
| component | 4 |
| composite-structure | 3 |
| deployment | 4 |
| package | 3 |
| er | 4 |
| c4-context | 4 |
| c4-container | 5 |
| communication | 4 |
| block | 4 |
| mind-map | 4 |
| network | 4 |
| gantt | 4 |
| timing | 4 |
| interaction-overview | 5 |

## Regression Testing Integration

This spec is added to the existing `playwright.config.ts` test suite (`testDir: './tests/e2e'`).
It is not in a separate "nightly only" group — it runs with all other e2e tests on `npx playwright test`.
Teams upgrading tldraw or the MCP server will automatically have these checks run.

## Non-goals

- Not testing visual pixel accuracy (screenshots are for human review on failure, not assertions)
- Not testing every possible shape property combination
- Not testing performance or load
- Not mocking the tldraw store — tests use the real running server

## Files to Create

- `tests/e2e/whiteboard-diagrams.spec.ts` — the test file (single file, ~600 lines)
