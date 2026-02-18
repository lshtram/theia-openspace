# Contract: Phase 1 Test & Git Remediation

**Task ID:** 1.X (Remediation)  
**Phase:** 1 (Foundation - Quality Assurance)  
**Owner:** Oracle  
**Created:** 2026-02-16  
**Priority:** 🔴 CRITICAL  
**Status:** Active

---

## Objective

Remediate critical process violations in Phase 1 by implementing comprehensive test coverage, initializing git repository, and establishing proper version control workflow. Bring project into full NSO compliance before proceeding to Task 1.14.

---

## Critical Process Violations Identified

1. ❌ **TDD Not Followed:** Implementation code written without tests
2. ❌ **No Unit Tests:** Zero test coverage for Phase 1 code
3. ❌ **No E2E Tests:** No automated integration tests
4. ❌ **Janitor Protocol Violated:** Approved without running tests
5. ❌ **Git Not Initialized:** No version control, no commits
6. ❌ **Git Worktree Protocol Not Followed:** No branches, no proper workflow

---

## Success Criteria

### Git & Version Control
1. ✅ Git repository initialized
2. ✅ `.gitignore` properly configured
3. ✅ Initial commit created with Phase 0 foundation
4. ✅ Feature branch created for Phase 1 work
5. ✅ All Phase 1 work committed with descriptive messages
6. ✅ Commit history is clean and logical

### Unit Test Coverage
1. ✅ SessionService tests created (getSessions, deleteSession, edge cases)
2. ✅ ChatWidget tests created (session dropdown, create/switch/delete)
3. ✅ Test coverage ≥80% for new code
4. ✅ All unit tests pass
5. ✅ Tests run in CI pipeline (if applicable)

### E2E Test Suite
1. ✅ Playwright tests created for core user flows
2. ✅ At least 5 scenarios automated:
   - System startup and chat widget opens
   - Create new session
   - Send message (mock OpenCode response)
   - Switch between sessions
   - Delete session with confirmation
3. ✅ Tests follow batched execution protocol
4. ✅ All E2E tests pass
5. ✅ Test documentation updated

### Janitor Re-Validation
1. ✅ Unit tests executed and passed
2. ✅ E2E tests executed in batches and passed
3. ✅ Build verification re-run
4. ✅ Spec compliance re-verified
5. ✅ New validation report created

---

## Scope

### In Scope
- Git repository initialization and configuration
- Initial commit with Phase 0 work
- Feature branch for Phase 1
- Unit tests for SessionService extensions (Task 1.11)
- Unit tests for ChatWidget session logic (Task 1.11)
- E2E tests for core integration scenarios
- Test infrastructure setup (test runner, mocking)
- Janitor re-validation with automated tests
- Git commits for all Phase 1 work
- Documentation updates

### Out of Scope
- Tests for Phase 0 code (can be added later)
- 100% test coverage (targeting 80%+)
- Performance/load testing
- Visual regression testing
- Refactoring existing code (unless needed for testability)

---

## Technical Specification

### 1. Git Repository Setup

#### Initialize Repository
```bash
cd /Users/Shared/dev/theia-openspace
git init
git config user.name "OpenSpace Team"
git config user.email "openspace@example.com"
```

#### Verify .gitignore
Ensure `.gitignore` includes:
```
node_modules/
lib/
*.log
.DS_Store
*.js.map
dist/
build/
.theia/
```

#### Commit Structure
```
Initial commit (Phase 0)
├── Scaffold and build system
├── 6 extension stubs
├── Browser app target
└── CI pipeline

Phase 1 commits (on feature branch)
├── Commit 1: RPC protocols (Tasks 1.1-1.4)
├── Commit 2: Hub implementation (Task 1.5)
├── Commit 3: Frontend services (Tasks 1.6-1.9)
├── Commit 4: Chat widget (Task 1.10)
├── Commit 5: Session UI (Task 1.11)
├── Commit 6: Documentation (Task 1.12)
└── Commit 7: Tests and remediation (this task)
```

---

### 2. Unit Test Suite

#### Test Framework
- **Framework:** Mocha or Jest (use Theia's existing test infrastructure)
- **Location:** `extensions/openspace-core/src/browser/__tests__/`
- **Naming:** `*.spec.ts` or `*.test.ts`

#### SessionService Tests

**File:** `extensions/openspace-core/src/browser/__tests__/session-service.spec.ts`

**Test Cases:**
1. **getSessions()**
   - Returns empty array when no sessions exist
   - Returns all sessions from OpenCodeService
   - Handles RPC errors gracefully
   - Logs appropriate messages

2. **deleteSession()**
   - Deletes specified session via OpenCodeService
   - Updates activeSession if deleting active session (switches to latest)
   - Emits onSessionDeleted event
   - Handles delete errors gracefully
   - Refuses to delete if only one session exists (optional)

3. **Edge Cases**
   - Deleting non-existent session
   - Deleting session while operation in progress
   - Network errors during delete
   - Race conditions (multiple rapid deletes)

**Mocking:**
- Mock OpenCodeService RPC interface
- Mock localStorage for state persistence
- Mock logger

#### ChatWidget Tests

**File:** `extensions/openspace-chat/src/browser/__tests__/chat-widget.spec.tsx`

**Test Cases:**
1. **Session Dropdown Rendering**
   - Renders dropdown with current session
   - Shows active indicator (●) on current session
   - Displays "+ New" button
   - Displays delete button (🗑️)

2. **Session Creation**
   - Creates new session with timestamp
   - Updates dropdown to show new session
   - Switches to new session automatically

3. **Session Switching**
   - Switches active session on dropdown selection
   - Updates message list to show new session's messages
   - Closes dropdown after selection

4. **Session Deletion**
   - Shows confirmation dialog (browser alert/confirm)
   - Deletes session on confirmation
   - Does not delete on cancellation
   - Removes session from dropdown after delete
   - Switches to another session if deleting active

5. **Edge Cases**
   - Click outside closes dropdown
   - Multiple rapid clicks
   - Session list refresh on changes

**Mocking:**
- Mock SessionService
- Mock React hooks (useState, useEffect)
- Mock browser confirm/alert

#### Test Coverage Target
- **Goal:** ≥80% coverage for new code (Tasks 1.11)
- **Measurement:** Use Istanbul/nyc or Jest coverage
- **Report:** Generate coverage report in `coverage/` directory

---

### 3. E2E Test Suite

#### Test Framework
- **Framework:** Playwright (already referenced in Task 1.13)
- **Location:** `tests/e2e/` or `e2e-tests/`
- **Configuration:** `playwright.config.ts`

#### Test Scenarios

**File:** `tests/e2e/session-management.spec.ts`

**Scenario 1: System Startup and Chat Widget Opens**
```typescript
test('should start OpenSpace and open chat widget', async ({ page }) => {
  await page.goto('http://localhost:3000');
  await page.waitForSelector('.theia-app-shell');
  
  // Click chat icon in sidebar
  await page.click('[title="Chat"]');
  
  // Verify chat widget opens
  await expect(page.locator('.openspace-chat-widget')).toBeVisible();
});
```

**Scenario 2: Create New Session**
```typescript
test('should create new session', async ({ page }) => {
  // Open chat widget
  await page.click('[title="Chat"]');
  
  // Click "+ New" button
  await page.click('.session-dropdown-new');
  
  // Verify new session appears in dropdown
  const sessions = await page.locator('.session-dropdown-item').count();
  expect(sessions).toBeGreaterThan(0);
});
```

**Scenario 3: Send Message (Mocked)**
```typescript
test('should send message and receive response', async ({ page }) => {
  // Mock OpenCode backend response
  await page.route('**/api/sessions/*/messages', route => {
    route.fulfill({
      status: 200,
      body: JSON.stringify({ id: 'msg-1', content: 'Hello!' })
    });
  });
  
  // Type message
  await page.fill('.chat-input', 'Hello, assistant!');
  await page.press('.chat-input', 'Enter');
  
  // Verify message appears
  await expect(page.locator('.message-user')).toContainText('Hello, assistant!');
  
  // Verify response appears (mocked)
  await expect(page.locator('.message-assistant')).toContainText('Hello!');
});
```

**Scenario 4: Switch Between Sessions**
```typescript
test('should switch between sessions', async ({ page }) => {
  // Create two sessions
  await page.click('.session-dropdown-new');
  await page.click('.session-dropdown-new');
  
  // Switch to first session
  await page.click('.session-dropdown-toggle');
  await page.click('.session-dropdown-item:first-child');
  
  // Verify active indicator
  await expect(page.locator('.session-dropdown-item:first-child .active-indicator')).toBeVisible();
});
```

**Scenario 5: Delete Session with Confirmation**
```typescript
test('should delete session after confirmation', async ({ page }) => {
  // Create session
  await page.click('.session-dropdown-new');
  
  const initialCount = await page.locator('.session-dropdown-item').count();
  
  // Click delete button (mock confirmation)
  page.on('dialog', dialog => dialog.accept());
  await page.click('.session-dropdown-delete');
  
  // Verify session removed
  const newCount = await page.locator('.session-dropdown-item').count();
  expect(newCount).toBe(initialCount - 1);
});
```

#### Batched Execution Protocol

**Per NSO instructions.md:**
```bash
# Batch 1: Smoke tests (2-3 tests)
npm run test:e2e -- system-startup.spec.ts

# If pass, Batch 2: Core functionality (3-4 tests)
npm run test:e2e -- session-management.spec.ts

# If pass, Batch 3: Advanced features
npm run test:e2e -- message-flow.spec.ts
```

#### Test Configuration

**File:** `playwright.config.ts`
```typescript
export default {
  testDir: './tests/e2e',
  timeout: 30000,
  use: {
    baseURL: 'http://localhost:3000',
    headless: true,
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'yarn start:browser',
    port: 3000,
    timeout: 120000,
    reuseExistingServer: true,
  },
};
```

---

### 4. Test Infrastructure

#### Package Dependencies

Add to `package.json` (root or relevant extension):
```json
{
  "devDependencies": {
    "@playwright/test": "^1.40.0",
    "@types/mocha": "^10.0.0",
    "@types/chai": "^4.3.0",
    "mocha": "^10.2.0",
    "chai": "^4.3.0",
    "sinon": "^17.0.0",
    "nyc": "^15.1.0"
  },
  "scripts": {
    "test:unit": "mocha 'extensions/**/src/**/__tests__/*.spec.ts' --require ts-node/register",
    "test:e2e": "playwright test",
    "test:coverage": "nyc npm run test:unit",
    "test:all": "npm run test:unit && npm run test:e2e"
  }
}
```

#### Mocha Configuration

**File:** `.mocharc.json`
```json
{
  "require": ["ts-node/register"],
  "extensions": ["ts"],
  "spec": "extensions/**/src/**/__tests__/*.spec.ts",
  "timeout": 5000
}
```

---

### 5. Janitor Re-Validation Checklist

After implementation, Janitor MUST verify:

**Unit Tests:**
- [ ] All unit tests execute successfully
- [ ] No test failures or errors
- [ ] Coverage report shows ≥80% for new code
- [ ] Tests are well-structured and meaningful

**E2E Tests:**
- [ ] Playwright installed and configured
- [ ] Tests execute in batched mode per NSO protocol
- [ ] Batch 1 (smoke tests) passes
- [ ] Batch 2 (core functionality) passes
- [ ] No test failures or timeouts
- [ ] Screenshots captured on failures (if any)

**Build Verification:**
- [ ] `yarn build` completes successfully
- [ ] No TypeScript errors in our code
- [ ] All extensions compile

**Git Verification:**
- [ ] Git repository initialized
- [ ] `.gitignore` configured
- [ ] Commits are logical and descriptive
- [ ] Feature branch exists for Phase 1
- [ ] All Phase 1 work committed

**Spec Compliance:**
- [ ] All original Task 1.11 requirements still met
- [ ] No regressions introduced by tests
- [ ] Documentation updated with test instructions

---

## Implementation Tasks for Builder

### Task 1: Initialize Git Repository

**Actions:**
1. Run `git init` in project root
2. Verify `.gitignore` is comprehensive
3. Create initial commit with Phase 0 work:
   ```bash
   git add .
   git commit -m "chore: Phase 0 foundation - Theia scaffold and build system
   
   - Theia 1.68.2 monorepo with Yarn workspaces
   - 6 extension stubs (core, chat, layout, files, terminal, drawing)
   - Browser app target with working build
   - Feature filtering and custom branding
   - CI pipeline with GitHub Actions"
   ```
4. Create feature branch for Phase 1:
   ```bash
   git checkout -b feature/phase-1-foundation
   ```

### Task 2: Commit Phase 1 Work (Logical Commits)

Create separate commits for logical units:

**Commit 1: RPC Protocols and Backend Services**
```bash
git add extensions/openspace-core/src/common/
git add extensions/openspace-core/src/node/opencode-proxy.ts
git add extensions/openspace-core/src/node/hub.ts
git add extensions/openspace-core/src/node/openspace-core-backend-module.ts
git commit -m "feat: implement RPC protocols and backend services

- Define OpenCodeService and OpenCodeClient protocols (Task 1.1)
- Implement OpenCodeProxy with 23 REST API methods (Task 1.2)
- Add SSE event forwarding with reconnection (Task 1.3)
- Configure backend DI module with RPC handlers (Task 1.4)
- Implement Hub server with 5 endpoints (Task 1.5)"
```

**Commit 2: Frontend Services**
```bash
git add extensions/openspace-core/src/browser/session-service.ts
git add extensions/openspace-core/src/browser/opencode-sync-service.ts
git add extensions/openspace-core/src/browser/bridge-contribution.ts
git add extensions/openspace-core/src/browser/openspace-core-frontend-module.ts
git commit -m "feat: implement frontend state management services

- Add SessionService with 7 events and localStorage persistence (Task 1.6)
- Add BridgeContribution for command manifest publishing (Task 1.7)
- Add SyncService for SSE event handling (Task 1.8)
- Configure frontend DI module bindings (Task 1.9)"
```

**Commit 3: Chat Widget**
```bash
git add extensions/openspace-chat/
git commit -m "feat: add chat widget with basic messaging

- Create ChatWidget React component (Task 1.10)
- Integrate with SessionService for message handling
- Add streaming support with cursor animation
- Style with Theia theme variables"
```

**Commit 4: Session Management UI**
```bash
git add extensions/openspace-chat/src/browser/chat-widget.tsx
git add extensions/openspace-core/src/browser/session-service.ts
git add extensions/openspace-chat/src/browser/style/chat-widget.css
git commit -m "feat: add session management UI

- Add session dropdown with create/switch/delete (Task 1.11)
- Extend SessionService with getSessions() and deleteSession()
- Add active session indicator and confirmation dialogs
- Style session dropdown with hover states"
```

**Commit 5: Documentation**
```bash
git add docs/setup/OPENCODE_CONFIGURATION.md
git add docs/testing/INTEGRATION_TEST_PROCEDURE.md
git add docs/troubleshooting/INTEGRATION_ISSUES.md
git commit -m "docs: add OpenCode configuration and testing guides

- OpenCode configuration guide with troubleshooting (Task 1.12)
- Integration test procedure with 8 scenarios (Task 1.13)
- Troubleshooting guide for common issues"
```

### Task 3: Set Up Test Infrastructure

**Actions:**
1. Install test dependencies:
   ```bash
   yarn add -D @playwright/test mocha chai sinon @types/mocha @types/chai nyc ts-node
   ```
2. Create `.mocharc.json` configuration
3. Create `playwright.config.ts` configuration
4. Add test scripts to `package.json`
5. Create test directory structure:
   ```
   extensions/openspace-core/src/browser/__tests__/
   extensions/openspace-chat/src/browser/__tests__/
   tests/e2e/
   ```

### Task 4: Write Unit Tests

**Actions:**
1. Create `session-service.spec.ts` with 10+ test cases
2. Create `chat-widget.spec.tsx` with 8+ test cases
3. Set up mocks for OpenCodeService, logger, localStorage
4. Run tests: `npm run test:unit`
5. Fix any failures
6. Generate coverage report: `npm run test:coverage`
7. Ensure ≥80% coverage

### Task 5: Write E2E Tests

**Actions:**
1. Install Playwright: `npx playwright install`
2. Create `session-management.spec.ts` with 5 scenarios
3. Configure test server (Theia on port 3000)
4. Set up request mocking for OpenCode API
5. Run tests in batches per NSO protocol:
   ```bash
   npm run test:e2e -- --grep "startup"
   npm run test:e2e -- --grep "session"
   npm run test:e2e -- --grep "message"
   ```
6. Fix any failures
7. Capture screenshots on failures

### Task 6: Commit Tests

**Actions:**
```bash
git add extensions/openspace-core/src/browser/__tests__/
git add extensions/openspace-chat/src/browser/__tests__/
git add tests/e2e/
git add .mocharc.json playwright.config.ts
git add package.json  # Updated with test scripts
git commit -m "test: add comprehensive unit and E2E test suites

- Unit tests for SessionService (getSessions, deleteSession)
- Unit tests for ChatWidget session management
- E2E tests for 5 core integration scenarios
- Test infrastructure with Mocha and Playwright
- Achieve 80%+ test coverage for Phase 1 code"
```

### Task 7: Document Test Procedures

**Actions:**
1. Update `README.md` with test commands
2. Create `docs/testing/UNIT_TEST_GUIDE.md`
3. Update `docs/testing/INTEGRATION_TEST_PROCEDURE.md` with automated test info
4. Commit documentation:
   ```bash
   git add README.md docs/testing/
   git commit -m "docs: add test execution guides"
   ```

---

## Validation Protocol

### Janitor Must Execute:

1. **Pull latest code from feature branch**
2. **Install dependencies:** `yarn install`
3. **Run unit tests:** `npm run test:unit`
   - Verify: All tests pass
   - Verify: No errors or warnings
4. **Check coverage:** `npm run test:coverage`
   - Verify: ≥80% coverage
5. **Run E2E tests (batched):**
   - Batch 1: `npm run test:e2e -- --grep "startup"`
   - Batch 2: `npm run test:e2e -- --grep "session"`
   - Batch 3: `npm run test:e2e -- --grep "message"`
   - Verify: All batches pass
6. **Verify build:** `yarn build`
   - Verify: No TypeScript errors
7. **Check git history:** `git log --oneline`
   - Verify: Logical commits
   - Verify: Descriptive messages
8. **Create validation report**

---

## Acceptance Checklist

- [ ] Git repository initialized
- [ ] `.gitignore` configured
- [ ] Initial commit created (Phase 0)
- [ ] Feature branch created (Phase 1)
- [ ] All Phase 1 work committed (5-7 logical commits)
- [ ] Test infrastructure installed and configured
- [ ] SessionService unit tests created (10+ cases)
- [ ] ChatWidget unit tests created (8+ cases)
- [ ] All unit tests pass
- [ ] Test coverage ≥80%
- [ ] E2E test suite created (5 scenarios)
- [ ] Playwright configured
- [ ] All E2E tests pass in batched execution
- [ ] Janitor re-validation completed with tests
- [ ] Validation report shows all tests passing
- [ ] Documentation updated with test instructions
- [ ] No regressions in existing functionality

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Unit test coverage | ≥80% | nyc coverage report |
| Unit tests passing | 100% | Mocha test output |
| E2E tests passing | 100% | Playwright test output |
| Git commits | 5-7 logical commits | `git log` count |
| Test execution time | <5 minutes | Total test run time |
| Build success | 100% | `yarn build` exit code |

---

## Risks & Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| Tests reveal bugs | High | Medium | Fix bugs as discovered, update code |
| E2E tests flaky | Medium | Medium | Add waits, retries, improve selectors |
| Coverage below 80% | Medium | Low | Add more test cases for uncovered paths |
| Git merge conflicts | Low | Low | Use feature branch, clean history |
| Test setup complex | Medium | Medium | Document thoroughly, use existing Theia patterns |

---

## Timeline Estimate

| Task | Estimated Time |
|------|----------------|
| Git initialization and commits | 30 minutes |
| Test infrastructure setup | 30 minutes |
| Unit tests (SessionService) | 1.5 hours |
| Unit tests (ChatWidget) | 1.5 hours |
| E2E tests (5 scenarios) | 2 hours |
| Test debugging and fixes | 1 hour |
| Documentation | 30 minutes |
| Janitor re-validation | 1 hour |
| **Total** | **8-9 hours** |

---

## Deliverables

1. Git repository with clean history
2. SessionService unit tests (`.spec.ts` file)
3. ChatWidget unit tests (`.spec.tsx` file)
4. E2E test suite (`session-management.spec.ts`)
5. Test configuration files (`.mocharc.json`, `playwright.config.ts`)
6. Coverage report (in `coverage/` directory)
7. Updated documentation (`docs/testing/`)
8. Janitor validation report (all tests passing)

---

## Next Steps After Completion

1. **Merge feature branch** (or keep for Task 1.14)
2. **Proceed to Task 1.14** (Permission UI) with proper TDD from start
3. **Establish pattern:** All future tasks follow test-first approach
4. **Update NSO:** Document learnings in session improvements

---

**Estimated Completion:** 8-9 hours  
**Priority:** 🔴 CRITICAL (blocks Task 1.14)  
**Owner:** Builder (with TDD skill)

---

**Oracle Authorization:** ✅ Approved for immediate execution  
**Next Agent:** Builder (follow TDD protocol strictly)
