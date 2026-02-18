---
id: CONTRACT-PHASE-2B-SDK-ADOPTION-V2
author: oracle_e4c1
date: 2026-02-18
task_id: phase-2b-sdk-adoption
worktree: .worktrees/phase-2b-sdk-adoption
version: 2.0 (Hybrid Approach)
---

# Builder Contract: Phase 2B — SDK Adoption (Hybrid Approach)

## 1. Overview

**Goal:** Replace ~263 lines of hand-rolled type definitions with the official `@opencode-ai/sdk` auto-generated types.

**Why:** Our custom types are already diverging from the actual OpenCode API (7 field name mismatches, 9 missing message Part types, 11 missing event types). Building code on top of incorrect types causes runtime bugs (`undefined` property access) and blocks Phase 3 completion.

**CRITICAL CHANGE (2026-02-18):** Original plan to replace HTTP/SSE runtime code is **BLOCKED** by ESM/CommonJS incompatibility. SDK is ESM-only (`"type": "module"`), Theia requires CommonJS (`"module": "commonjs"`). TypeScript cannot import ESM modules in CJS projects regardless of `moduleResolution` strategy. See `docs/architecture/DECISION-SDK-ADOPTION.md` §6 for full blocker analysis.

**Approved Solution:** Hybrid approach — extract SDK's auto-generated type file (`dist/gen/types.gen.d.ts`, 3,380 lines, zero imports, self-contained) into our codebase. Keep hand-rolled HTTP/SSE client but type it with SDK types. Achieves primary goal (type compatibility) while deferring runtime SDK until blocker resolved.

**Worktree:** `.worktrees/phase-2b-sdk-adoption`  
**Base Branch:** `feature/phase-1-permission-ui`  
**Estimated Effort:** 6–8 hours (down from 12–18)  
**Code Reduction Target:** ~263 lines (type definitions only)

---

## 2. Scope

### 2.1 In Scope (5 Tasks — Reduced from 6)

| Task | What | Target Files |
|------|------|--------------|
| 2B.1 | Extract SDK types + create npm script | `extensions/openspace-core/package.json`, `src/common/opencode-sdk-types.ts` (NEW) |
| 2B.2 | Create type bridge in opencode-protocol.ts | `opencode-protocol.ts` |
| 2B.3 | Update consumers for field renames + Part types | `session-service.ts`, `chat-widget.tsx`, `opencode-sync-service.ts`, `opencode-proxy.ts`, tests |
| 2B.4 | Cleanup hand-written types + documentation | `opencode-protocol.ts`, `docs/development/SDK-TYPE-EXTRACTION.md` (NEW), `THIRD-PARTY-NOTICES` |
| 2B.5 | Integration verification | All of the above + full test suite |

### 2.2 Out of Scope (DO NOT MODIFY)

**Runtime Code (Stays Unchanged):**
- HTTP client in `opencode-proxy.ts` — all 24 methods (`listProjects`, `createSession`, `sendMessage`, etc.) stay exactly as-is, only return type annotations change
- SSE handling in `opencode-sync-service.ts` — zero changes to logic
- `eventsource-parser` dependency — stays in `package.json` (still needed)
- Stream interceptor logic — zero changes (operates on raw SSE data)
- Permission dialog UI — zero changes
- Command validation / security — zero changes
- Hub endpoints — zero changes
- Architecture B1 components — zero changes

**Why Runtime Stays:** ESM/CJS blocker prevents using SDK client at runtime. HTTP/SSE transport must remain until Theia supports ESM or SDK adds CJS builds.

### 2.3 What Changes (Types Only)

| File | Before | After | Change |
|------|--------|-------|--------|
| `opencode-protocol.ts` | ~313 lines (hand-written types) | ~80-100 lines (SDK re-exports + RPC interfaces) | -213 lines |
| `opencode-sdk-types.ts` | N/A | ~3,380 lines (copied from SDK) | +3,380 lines (but sourced from SDK, not hand-written) |
| `session-service.ts` | `session.projectId` | `session.projectID` | Field renames |
| `chat-widget.tsx` | `message.sessionId` | `message.sessionID` | Field renames |
| `opencode-proxy.ts` | `Promise<Session>` (hand-written type) | `Promise<SDKTypes.Session>` (SDK type) | Type annotations only |
| Tests | Old field names | New field names | Test assertions updated |
| **Net LOC change** | — | — | **-263 lines** (hand-written types eliminated) |

---

## 3. Technical Requirements

### 3.1 SDK Installation (Task 2B.1)

**Install SDK as devDependency:**
```bash
cd extensions/openspace-core
npm install --save-dev --save-exact @opencode-ai/sdk@1.2.6
```

**Extract Type File:**
```bash
# Copy SDK's auto-generated types to our codebase
cp node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts \
   src/common/opencode-sdk-types.ts
```

**Create npm Script:**
```json
// In extensions/openspace-core/package.json
{
  "scripts": {
    "extract-sdk-types": "cp node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts src/common/opencode-sdk-types.ts"
  }
}
```

**Verify TypeScript Can Import:**
```typescript
// Test in opencode-protocol.ts
import * as SDKTypes from './opencode-sdk-types';
// TypeScript should provide autocomplete for SDKTypes.components['schemas']['Session']
```

**Acceptance Criteria:**
- [ ] `@opencode-ai/sdk@1.2.6` listed in `package.json` devDependencies (exact version)
- [ ] `src/common/opencode-sdk-types.ts` exists with 3,380 lines
- [ ] npm script `extract-sdk-types` exists and works
- [ ] `yarn build` succeeds with zero errors
- [ ] TypeScript recognizes imports from `opencode-sdk-types.ts`

---

### 3.2 Type Bridge (Task 2B.2)

**Pattern: Create Type Aliases for Backward Compatibility**

```typescript
// In opencode-protocol.ts

import * as SDKTypes from './opencode-sdk-types';

// Re-export SDK types under our current names
export type Session = SDKTypes.components['schemas']['Session'];
export type UserMessage = SDKTypes.components['schemas']['UserMessage'];
export type AssistantMessage = SDKTypes.components['schemas']['AssistantMessage'];
export type Message = UserMessage | AssistantMessage;
export type Part = SDKTypes.components['schemas']['Part'];
export type Provider = SDKTypes.components['schemas']['Provider'];
export type Model = SDKTypes.components['schemas']['Model'];
export type Config = SDKTypes.components['schemas']['Config'];
export type Project = SDKTypes.components['schemas']['Project'];

// Event types
export type SessionEvent = SDKTypes.components['schemas']['SessionEvent'];
export type MessageEvent = SDKTypes.components['schemas']['MessageEvent'];
// ... (map all event types we currently use)

// Keep Theia-specific RPC interfaces (NOT in SDK)
export const OPENCODE_SERVICE_PATH = '/services/opencode';

export interface OpenCodeService {
  // ... (unchanged)
}

export interface OpenCodeClient {
  // ... (unchanged)
}

// DO NOT remove old hand-written types yet — that's Task 2B.4
// Keep them coexisting with SDK types for now (non-breaking change)
```

**Key Points:**
1. **DO NOT delete old types yet** — this allows gradual migration
2. **Bridge pattern:** SDK types aliased to our names → existing code compiles unchanged
3. **OpenAPI schema path:** SDK types live at `SDKTypes.components['schemas']['TypeName']`
4. **Keep RPC interfaces:** `OpenCodeService`, `OpenCodeClient`, `OPENCODE_SERVICE_PATH` are Theia-specific, not in SDK

**Acceptance Criteria:**
- [ ] All SDK types re-exported under our current names
- [ ] `yarn build` succeeds with zero errors
- [ ] Old and new types coexist (no consumer changes yet)
- [ ] TypeScript shows both old (hand-written) and new (SDK) types are valid

---

### 3.3 Field Renames + Part Types (Task 2B.3)

**Known Field Renames:**

| Old Name | New Name | Type | Locations |
|----------|----------|------|-----------|
| `Session.projectId` | `Session.projectID` | string | `session-service.ts`, tests |
| `Message.sessionId` | `Message.sessionID` | string | `session-service.ts`, `chat-widget.tsx`, tests |
| `Session.createdAt` | `Session.time.created` | number (not string!) | If used anywhere |
| `Session.updatedAt` | `Session.time.updated` | number (not string!) | If used anywhere |

**Part Type Expansion:**

SDK has 12 Part variants vs our current 3:

| SDK Part Types | Our Current Types | Action |
|----------------|-------------------|--------|
| `text`, `image`, `tool`, `agent`, `step-start`, `step-end`, `snapshot`, `patch`, `attachment`, `thinking`, `citation`, `error` | `text`, `image`, `tool-call` | Add handlers for new types OR graceful fallback (render as text/ignore) |

**Files to Update:**

1. **session-service.ts** (~856 LOC):
   ```typescript
   // OLD
   const projectId = session.projectId;
   const sessionId = message.sessionId;
   
   // NEW
   const projectID = session.projectID;
   const sessionID = message.sessionID;
   ```

2. **chat-widget.tsx**:
   ```typescript
   // OLD
   <div data-session-id={message.sessionId}>
   
   // NEW
   <div data-session-id={message.sessionID}>
   ```

3. **opencode-proxy.ts** (return types only, NO logic changes):
   ```typescript
   // OLD
   async listSessions(): Promise<Session[]> { ... }
   
   // NEW (type annotation updated, logic unchanged)
   async listSessions(): Promise<SDKTypes.components['schemas']['Session'][]> { ... }
   ```

4. **Part type handling** (likely in `chat-widget.tsx` or message renderer):
   ```typescript
   // OLD
   switch (part.type) {
     case 'text': return <span>{part.text}</span>;
     case 'image': return <img src={part.url} />;
     case 'tool-call': return <ToolCallRenderer call={part} />;
   }
   
   // NEW (exhaustive + fallback)
   switch (part.type) {
     case 'text': return <span>{part.text}</span>;
     case 'image': return <img src={part.url} />;
     case 'tool': return <ToolCallRenderer call={part} />;
     case 'agent': return <AgentRenderer agent={part} />;
     case 'step-start':
     case 'step-end':
     case 'snapshot':
     case 'patch':
     case 'attachment':
     case 'thinking':
     case 'citation':
     case 'error':
       // Fallback: render as text or ignore gracefully
       return <span className="unknown-part">{JSON.stringify(part)}</span>;
     default:
       // TypeScript exhaustiveness check
       const _exhaustive: never = part;
       return null;
   }
   ```

**Strategy:**
1. Remove old type definitions from `opencode-protocol.ts` (force TypeScript errors)
2. Use TypeScript compiler errors as guide to find all locations
3. Fix each location with new field names
4. Run `yarn build` repeatedly until zero errors

**Acceptance Criteria:**
- [ ] All field accesses use SDK naming conventions
- [ ] `yarn build` succeeds with zero TypeScript errors
- [ ] Part type handling is exhaustive (12 types covered)
- [ ] No runtime `undefined` errors from field mismatches
- [ ] Unit tests updated for new field names (expect 10-15 failures initially)
- [ ] All unit tests pass after fixes

---

### 3.4 Cleanup (Task 2B.4)

**Remove Hand-Written Types:**

In `opencode-protocol.ts`, delete ALL hand-written API types (~263 lines):
- `interface Session { ... }`
- `interface Message { ... }`
- `type MessagePart = ...`
- `interface Provider { ... }`
- `interface Model { ... }`
- Event type definitions
- Etc.

**Keep:**
- SDK type re-exports (from Task 2B.2)
- `OpenCodeService` interface (Theia RPC)
- `OpenCodeClient` interface (Theia RPC)
- `OPENCODE_SERVICE_PATH` constant

**Target:** `opencode-protocol.ts` reduced from ~313 lines to ~80-100 lines.

**Update THIRD-PARTY-NOTICES:**
```markdown
## @opencode-ai/sdk

Type definitions sourced from @opencode-ai/sdk v1.2.6 (MIT license).
Types are auto-generated from the OpenCode OpenAPI 3.1 specification.

Copyright (c) 2024-2026 OpenCode Project
License: MIT
Source: https://github.com/opencodegit/sdk
```

**Document Type Extraction:**

Create `docs/development/SDK-TYPE-EXTRACTION.md`:
```markdown
# SDK Type Extraction

Type definitions are sourced from the official `@opencode-ai/sdk` package.

## Updating Types

When updating to a new SDK version:

1. Update SDK version in `package.json`:
   ```bash
   npm install --save-dev --save-exact @opencode-ai/sdk@<new-version>
   ```

2. Re-extract types:
   ```bash
   npm run extract-sdk-types
   ```

3. Verify build:
   ```bash
   yarn build
   ```

4. Run tests:
   ```bash
   yarn test
   ```

5. Check for API breaking changes:
   - TypeScript compiler will flag incompatibilities
   - Review SDK changelog for field renames or type changes
   - Update consumers as needed

6. Commit both `package.json` and `opencode-sdk-types.ts` together

## Why Not Import Directly?

The SDK is ESM-only (`"type": "module"`), while Theia requires CommonJS.
TypeScript cannot import ESM modules in CommonJS projects.

We extract the auto-generated type file (which has zero imports) as a workaround.

## Future: Runtime SDK Adoption

When Theia migrates to ESM or the SDK adds CJS builds, we can:
1. Remove `opencode-sdk-types.ts`
2. Import types directly from `@opencode-ai/sdk`
3. Replace HTTP client with SDK client methods
4. Replace SSE handling with SDK `event.subscribe()`

See `docs/architecture/DECISION-SDK-ADOPTION.md` for full rationale.
```

**Acceptance Criteria:**
- [ ] `opencode-protocol.ts` contains only SDK re-exports + RPC interfaces (~80-100 lines)
- [ ] No hand-written API types remain
- [ ] THIRD-PARTY-NOTICES updated with SDK attribution
- [ ] `docs/development/SDK-TYPE-EXTRACTION.md` created
- [ ] `yarn build` clean (zero errors)
- [ ] All unit tests pass
- [ ] All E2E tests pass

---

### 3.5 Integration Verification (Task 2B.5)

**Manual Smoke Test (Repeat Phase 1.13):**

1. **Start Theia:**
   ```bash
   cd /Users/Shared/dev/theia-openspace
   yarn start:browser
   ```
   Navigate to http://localhost:3000

2. **Connect to OpenCode server** (must be running at localhost:4096)

3. **Create session:**
   - Open chat widget
   - Click "New Session" or use session dropdown
   - Verify: Session list populates, new session appears with correct `projectID` field

4. **Send message:**
   - Type: "Hello, can you explain what you do?"
   - Send message
   - Verify: Message appears in chat with correct `sessionID` field
   - Verify: Streaming response appears (SSE still works)
   - Verify: No console errors (check browser DevTools)

5. **Verify Part type rendering:**
   - Send: "Show me a code example"
   - Verify: Code blocks render correctly (Part type = `text` with code fence)
   - Verify: No crashes from unknown Part types

6. **Permission dialog:**
   - If agent requests permission, verify dialog appears
   - Verify: Dialog displays correctly (no type errors)

7. **Stream interceptor:**
   - If agent sends commands (%%OS{...}%%), verify they're intercepted
   - Check console for agent command dispatch logs

8. **Session CRUD:**
   - Switch sessions (dropdown)
   - Delete session
   - Create new session
   - Verify: All operations work with new field names

**Automated Test Suite:**

Run full test suite in batches (NSO E2E protocol):

```bash
# Unit tests
yarn test

# E2E tests (batched)
# Batch 1
npm run test:e2e -- tests/session.spec.ts tests/chat.spec.ts

# If pass, Batch 2
npm run test:e2e -- tests/permission.spec.ts tests/commands.spec.ts

# Continue until all pass or first failure
```

**Acceptance Criteria:**
- [ ] Manual smoke test: All 8 steps pass
- [ ] No runtime `undefined` errors (field mismatches fixed)
- [ ] No console errors in browser DevTools
- [ ] Part type rendering works (no crashes from unknown types)
- [ ] `yarn build` clean (zero TypeScript errors)
- [ ] All unit tests pass (100+ tests)
- [ ] All E2E tests pass (batched execution)
- [ ] Document results in `result.md`

---

## 4. Exit Criteria (Phase 2B Complete)

**Code Quality:**
- [ ] `yarn build` succeeds with zero TypeScript errors
- [ ] `yarn lint` succeeds with zero lint errors
- [ ] All unit tests pass (100+ tests)
- [ ] All E2E tests pass (batched execution)

**Type Correctness:**
- [ ] All hand-written API types eliminated (~263 lines)
- [ ] All consumers use SDK type field names (`projectID` not `projectId`)
- [ ] Part type handling exhaustive (12 variants covered)
- [ ] Zero `undefined` runtime errors from field mismatches

**SDK Integration:**
- [ ] SDK installed as devDependency with exact version
- [ ] SDK types extracted to `src/common/opencode-sdk-types.ts` (3,380 lines)
- [ ] npm script `extract-sdk-types` exists
- [ ] Type extraction process documented

**Runtime Unchanged:**
- [ ] HTTP client unchanged (all 24 methods same logic, just retyped)
- [ ] SSE handling unchanged
- [ ] `eventsource-parser` still in dependencies
- [ ] Stream interceptor unchanged
- [ ] No performance regressions

**Documentation:**
- [ ] THIRD-PARTY-NOTICES updated with SDK attribution
- [ ] `docs/development/SDK-TYPE-EXTRACTION.md` created
- [ ] Task result documented in `result.md`

---

## 5. Risk Mitigation

### 5.1 Field Rename Cascades (High Probability, Low Impact)

**Risk:** Changing `projectId` → `projectID` causes 10-15 test failures.

**Mitigation:**
1. Use TypeScript compiler as guide (it will flag every location)
2. Fix systematically file-by-file
3. Run tests after each file fix
4. Expected effort: 2 hours (already in task estimate)

### 5.2 Part Type Rendering Breaks (Low Probability, Medium Impact)

**Risk:** Unknown Part types crash chat widget.

**Mitigation:**
1. Add exhaustive switch with default case
2. Render unknown types as text or JSON
3. Add 2-3 unit tests for unknown types
4. Test manually with real agent responses

### 5.3 Manual Type Sync Forgotten (Medium Probability, Medium Impact)

**Risk:** SDK version updated but types not re-extracted → type drift resumes.

**Mitigation:**
1. npm script `extract-sdk-types` makes it easy
2. Documentation in `SDK-TYPE-EXTRACTION.md`
3. Consider pre-commit hook (future improvement)
4. Pin SDK version exactly (no auto-updates)

### 5.4 ESM/CJS Blocker Persists (High Probability, Low Impact)

**Risk:** Theia never migrates to ESM, SDK never adds CJS → stuck with hybrid approach.

**Mitigation:**
1. Hybrid approach is sustainable long-term
2. Type compatibility (primary goal) is achieved
3. HTTP/SSE client works fine (just not "best practice")
4. Can revisit runtime SDK in future (not blocking)

---

## 6. Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Code reduction | ~263 lines | Count lines removed from `opencode-protocol.ts` |
| Type correctness | 100% | Zero TypeScript errors, zero runtime `undefined` from field mismatches |
| Test pass rate | 100% | All unit + E2E tests pass |
| Build time | ≤30s | No performance regression from type changes |
| Runtime behavior | 0 regressions | Manual smoke test: all 8 steps pass |

---

## 7. Builder Implementation Sequence

**Day 1 (3-4 hours):**
1. Task 2B.1: Extract SDK types + npm script (1h)
2. Task 2B.2: Create type bridge (2h)
3. Checkpoint: `yarn build` passes, types importable

**Day 2 (3-4 hours):**
4. Task 2B.3: Update consumers for field renames (2h)
5. Task 2B.4: Cleanup + documentation (1h)
6. Task 2B.5: Integration verification (1-2h)

**Total: 6-8 hours (1 session)**

---

## 8. Validation Checklist (Janitor)

When Builder completes, Janitor MUST verify:

- [ ] All 5 tasks (2B.1–2B.5) completed
- [ ] `yarn build` succeeds (zero errors)
- [ ] `yarn lint` succeeds (zero errors)
- [ ] All unit tests pass (100+)
- [ ] All E2E tests pass (batched)
- [ ] Manual smoke test documented with screenshots/logs
- [ ] SDK in devDependencies with exact version
- [ ] Type extraction script exists and works
- [ ] THIRD-PARTY-NOTICES updated
- [ ] Documentation created (`SDK-TYPE-EXTRACTION.md`)
- [ ] No runtime regressions (HTTP/SSE still work)
- [ ] Field renames complete (no `projectId` references remain)
- [ ] Part type handling exhaustive

---

*End of Contract v2.0 — Hybrid Approach Approved 2026-02-18*
