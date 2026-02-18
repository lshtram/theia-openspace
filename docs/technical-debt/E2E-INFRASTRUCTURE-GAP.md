---
title: E2E Test Infrastructure Gap - Architecture B1 Mismatch
date: 2026-02-17
priority: HIGH
status: BLOCKED
blocking: Comprehensive E2E coverage for Tasks 2.0+
owner: TBD (needs dedicated investigation)
---

# E2E Test Infrastructure Gap - Architecture B1 Mismatch

## Problem Statement

The current E2E tests in `tests/e2e/session-list-autoload.spec.ts` were written with the assumption that HTTP requests from the browser can be mocked using Playwright's `page.route()`. However, **Architecture B1** uses a backend proxy pattern where:

```
Browser (Theia frontend)
  ↓ JSON-RPC over WebSocket
Node.js (Theia backend via OpenCodeService)
  ↓ HTTP requests to Hub
Hub (port 7890)
  ↓ HTTP requests to OpenCode
OpenCode Server (port 8000)
```

**Playwright's `page.route()` only intercepts browser HTTP requests**, not Node.js backend HTTP requests. This means:
- ✅ Browser → API calls CAN be mocked
- ❌ Node.js backend → Hub calls CANNOT be mocked with `page.route()`

---

## Current Status

### Working E2E Tests
- ✅ **Test 4**: Empty state test (doesn't require backend data)
- ✅ **session-management.spec.ts**: Other E2E tests that don't rely on session auto-loading

### Failing E2E Tests (Infrastructure Issue, NOT Implementation Bug)
- ❌ **Test 1**: Session list loads immediately (requires active project + sessions)
- ❌ **Test 2**: Slow network race condition (requires controlled network delay)
- ❌ **Test 3**: Error recovery (requires controlled backend failure)
- ⊘ **Test 5**: Event listener cleanup (skipped - requires browser profiling)

### Validation Coverage for Task 2.0
- ✅ **Unit tests**: 13 tests covering session loading logic (all passing)
- ✅ **Manual testing**: Confirmed feature works in live IDE
- ✅ **E2E Test 4**: Confirms UI renders correctly for empty state
- ❌ **E2E Tests 1-3**: Cannot run due to mock architecture mismatch

---

## Root Cause Analysis

### Why `page.route()` Doesn't Work

**Playwright's `page.route()` intercepts network requests at the browser level:**
```typescript
// This ONLY works for fetch() or XMLHttpRequest in the BROWSER
await page.route('**/hub/projects', async route => {
  await route.fulfill({ body: JSON.stringify([...]) });
});
```

**But in Architecture B1, the flow is:**
1. Browser calls `OpenCodeService.getSessions()` (Theia DI service)
2. OpenCodeService sends JSON-RPC message to backend over WebSocket
3. Backend OpenCodeProxy makes HTTP request to Hub on port 7890
4. Hub makes HTTP request to OpenCode on port 8000

**The HTTP request happens in Node.js, not the browser**, so `page.route()` never sees it.

---

## Solution Options

### Option 1: Real Backend Testing (Recommended)
**Approach**: Run actual Hub + OpenCode server during E2E tests, create real test data.

**Implementation Steps**:
1. **Create E2E setup script** (`tests/e2e/global-setup.ts`):
   - Start Hub on port 7890 (or mock Hub server)
   - Start OpenCode server on port 8000 (or use test instance)
   - Create test project via Hub API: `POST /hub/projects`
   - Store project ID in globalSetup context

2. **Update `playwright.config.ts`**:
   ```typescript
   export default defineConfig({
     globalSetup: require.resolve('./tests/e2e/global-setup.ts'),
     globalTeardown: require.resolve('./tests/e2e/global-teardown.ts'),
     use: {
       baseURL: 'http://localhost:3000',
       // Pass test project ID to all tests
       storageState: 'tests/e2e/.auth/test-state.json'
     }
   });
   ```

3. **Update tests to use real project**:
   ```typescript
   test('Test 1: Session list loads immediately', async ({ page }) => {
     // Project already exists from global setup
     // Create sessions via API
     const session = await createTestSession('Test Session 1');
     
     // Open Theia and verify
     await page.goto('/');
     await openChatWidget(page);
     
     // Assertions work because real data exists
     await expect(page.locator('.session-list-item')).toHaveCount(1);
   });
   ```

4. **Cleanup after tests**:
   - Delete test sessions via API
   - Delete test project via API (in global teardown)

**Pros**:
- ✅ Tests the full stack (most realistic)
- ✅ Catches integration bugs between layers
- ✅ No complex mocking logic

**Cons**:
- ❌ Requires Hub + OpenCode running (CI/CD complexity)
- ❌ Slower tests (real network calls)
- ❌ Potential for test pollution if cleanup fails

**Estimated effort**: 4-6 hours

---

### Option 2: Mock at RPC Layer
**Approach**: Intercept JSON-RPC messages between browser and Node.js backend using Playwright's `page.route()` to intercept WebSocket traffic or RPC endpoints.

**Implementation Sketch**:
```typescript
// Intercept RPC calls in browser
await page.addInitScript(() => {
  const originalFetch = window.fetch;
  window.fetch = async (url, options) => {
    if (url.includes('/services/rpc')) {
      // Parse JSON-RPC request
      const body = JSON.parse(options.body);
      if (body.method === 'getSessions') {
        return new Response(JSON.stringify({
          jsonrpc: '2.0',
          id: body.id,
          result: [...mock sessions...]
        }));
      }
    }
    return originalFetch(url, options);
  };
});
```

**Pros**:
- ✅ No external dependencies (Hub/OpenCode)
- ✅ Fast, isolated tests

**Cons**:
- ❌ Very complex (RPC protocol has many methods)
- ❌ Fragile (breaks if RPC format changes)
- ❌ Couples tests to RPC internals
- ❌ Doesn't test backend integration

**Estimated effort**: 8-12 hours (high complexity)

---

### Option 3: Mock Hub Server
**Approach**: Create a lightweight mock Hub server that runs during E2E tests and serves fake data.

**Implementation Steps**:
1. **Create mock Hub** (`tests/e2e/mock-hub.ts`):
   ```typescript
   import express from 'express';
   
   const app = express();
   app.use(express.json());
   
   let projects = [];
   let sessions = [];
   
   app.get('/hub/projects', (req, res) => {
     res.json(projects);
   });
   
   app.get('/projects/:projectId/sessions', (req, res) => {
     res.json(sessions.filter(s => s.projectId === req.params.projectId));
   });
   
   // ... more endpoints
   
   app.listen(7890);
   ```

2. **Start mock Hub in global setup**:
   ```typescript
   // tests/e2e/global-setup.ts
   import { startMockHub } from './mock-hub';
   
   export default async function globalSetup() {
     await startMockHub();
     // Seed test data
     await createMockProject({ id: 'test-project', name: 'E2E Test' });
   }
   ```

3. **Configure Theia to use mock Hub**:
   - Set environment variable: `OPENCODE_HUB_URL=http://localhost:7890`
   - Or update `opencode-proxy.ts` to use configurable Hub URL

**Pros**:
- ✅ Controlled test data (no real backend needed)
- ✅ Fast tests (local mock server)
- ✅ Easy to simulate errors/delays

**Cons**:
- ❌ Need to implement Hub API endpoints (maintenance burden)
- ❌ Mock drift (mock Hub diverges from real Hub over time)
- ❌ Doesn't test real Hub/OpenCode integration

**Estimated effort**: 6-8 hours

---

### Option 4: Network Proxy Interception
**Approach**: Run a proxy server (like `mitmproxy` or custom Node.js proxy) that intercepts HTTP traffic between Theia backend and Hub, modifying responses.

**Implementation Sketch**:
```typescript
// tests/e2e/proxy-server.ts
import http from 'http';
import httpProxy from 'http-proxy';

const proxy = httpProxy.createProxyServer({});

const mockResponses = {
  '/hub/projects': [...],
  '/projects/*/sessions': [...]
};

const server = http.createServer((req, res) => {
  const mockKey = Object.keys(mockResponses).find(k => new RegExp(k).test(req.url));
  if (mockKey) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockResponses[mockKey]));
  } else {
    proxy.web(req, res, { target: 'http://localhost:7890' });
  }
});

server.listen(7891); // Theia backend connects to 7891 instead of 7890
```

**Pros**:
- ✅ Intercepts real HTTP traffic (realistic)
- ✅ No changes to application code

**Cons**:
- ❌ Complex setup (proxy configuration, port management)
- ❌ Requires modifying Theia backend config to use proxy
- ❌ Debugging is harder (extra network layer)

**Estimated effort**: 8-10 hours

---

## Recommended Approach: Option 1 (Real Backend)

**Why Option 1 is best**:
1. **Simplest conceptually** — just run the real backend
2. **Most realistic** — tests what users will actually use
3. **Catches integration bugs** — tests the full stack
4. **Maintainable** — no complex mocking logic to maintain

**Implementation Plan**:

### Phase 1: Global Setup (2 hours)
- [ ] Create `tests/e2e/global-setup.ts`
- [ ] Create `tests/e2e/global-teardown.ts`
- [ ] Create helper: `createTestProject()` via Hub API
- [ ] Create helper: `deleteTestProject()` via Hub API
- [ ] Update `playwright.config.ts` to use global setup

### Phase 2: Test Data Helpers (2 hours)
- [ ] Create `tests/e2e/helpers/test-data.ts`:
  - `createTestSession(projectId, title)`
  - `deleteTestSession(sessionId)`
  - `clearTestData()`
- [ ] Store test project ID in Playwright's `storageState` or environment

### Phase 3: Rewrite Tests (2 hours)
- [ ] Update Test 1: Create sessions via API before test runs
- [ ] Update Test 2: Use real Hub with `setTimeout` in backend to simulate delay (or accept that race condition test is hard to reproduce)
- [ ] Update Test 3: Use real Hub, temporarily stop/start Hub to simulate error (or mock Hub returns 500 on first call)
- [ ] Test 4: Already works (no changes needed)
- [ ] Test 5: Keep skipped (memory leak testing requires profiling)

### Phase 4: CI/CD Integration (if needed)
- [ ] Document how to run Hub + OpenCode in CI
- [ ] Add Docker Compose file for test environment (optional)
- [ ] Update CI workflow to start backend services before E2E tests

---

## Acceptance Criteria

When E2E infrastructure is fixed:
- ✅ All 4 active tests in `session-list-autoload.spec.ts` pass consistently
- ✅ Tests use real backend (Hub + OpenCode or mock Hub)
- ✅ Test data is cleaned up after each test (no pollution)
- ✅ Tests can run in CI without manual setup
- ✅ Documentation explains how to run E2E tests locally

---

## Temporary Mitigation (Current State)

Until E2E infrastructure is fixed:
- **Unit tests** provide coverage for session loading logic (13 tests, all passing)
- **Manual testing** confirms feature works in live IDE
- **E2E Test 4** confirms UI renders correctly for edge cases
- **Document this gap** in task validation reports

**Tasks 2.0+ can proceed** using unit tests + manual verification for validation.

---

## References

- **Original E2E tests**: `tests/e2e/session-list-autoload.spec.ts`
- **Playwright config**: `playwright.config.ts`
- **Architecture doc**: `docs/architecture/TECHSPEC-THEIA-OPENSPACE.md` (Section on Architecture B1)
- **Hub spec**: `/Users/Shared/dev/opencode/specs/project.md`

---

## Owner Assignment

**Who should fix this**: Builder or Scout (dedicated investigation, 6-8 hours)

**When to fix**: Parallel track (doesn't block Tasks 2.1+)

**Priority**: HIGH (needed for comprehensive E2E coverage) but NOT blocking current development

---

**Status**: DOCUMENTED (awaiting assignment)
