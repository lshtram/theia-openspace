# Contract: Task 1.14 - Permission Dialog UI

**Date:** 2026-02-16  
**Oracle ID:** oracle_a3f7  
**Task:** Implement Permission Dialog UI for AI Agent Action Approval  
**Assignee:** Builder (TDD workflow required)  
**Estimated Duration:** 2-3 hours  
**Workflow:** BUILD  
**Git Workflow:** Feature branch `feature/phase-1-permission-ui` from `feature/phase-1-foundation`

---

## Context

**Phase 1 Goal:** Complete AI-native IDE foundation where AI agents have equal control over the IDE through a command manifest system.

**Current Status:**
- ✅ Tasks 1.1-1.13 complete (all Phase 1 core features implemented)
- ✅ Remediation complete (test suite + git workflow established)
- ✅ SyncService already emits `onPermissionRequired` events with action details
- ⬜ Missing: UI to display permission requests and capture user grant/deny decisions

**This Task:** Create the Permission Dialog component that displays when AI agents request permission for operations, allowing users to grant or deny actions.

---

## Requirements

### Functional Requirements (FR)

#### FR1: Permission Dialog Component
- **FR1.1:** Create a modal dialog component that appears centered over the IDE
- **FR1.2:** Dialog must display:
  - Agent ID requesting the permission
  - Action type (e.g., "file_write", "command_execute")
  - Action details (file path, command string, or other relevant context)
  - Clear description of what will happen if approved
- **FR1.3:** Dialog must provide two buttons:
  - "Grant" button (primary action, green/positive styling)
  - "Deny" button (secondary action, red/negative styling)
- **FR1.4:** Dialog must be keyboard accessible:
  - Enter key grants permission
  - Escape key denies permission
  - Tab navigation between buttons

#### FR2: Integration with SyncService
- **FR2.1:** Listen to `SyncService.onPermissionRequired` event
- **FR2.2:** When event fires, display the permission dialog with event data
- **FR2.3:** When user clicks "Grant", call `SyncService.respondToPermission(actionId, true)`
- **FR2.4:** When user clicks "Deny", call `SyncService.respondToPermission(actionId, false)`
- **FR2.5:** Dialog must close automatically after user response

#### FR3: Queue Management
- **FR3.1:** If multiple permission requests arrive while dialog is open, queue them
- **FR3.2:** Display queued requests one at a time (FIFO order)
- **FR3.3:** Show queue indicator if multiple requests are pending (e.g., "1 of 3")

#### FR4: Timeout Handling
- **FR4.1:** If user does not respond within 60 seconds, auto-deny and show timeout notification
- **FR4.2:** Move to next queued request after timeout

### Non-Functional Requirements (NFR)

#### NFR1: User Experience
- **NFR1.1:** Dialog must appear within 200ms of permission event firing
- **NFR1.2:** Dialog must be visually consistent with Theia's dialog system
- **NFR1.3:** Action details must be formatted clearly (no raw JSON dumps)
- **NFR1.4:** Dialog must be modal (blocks interaction with IDE until resolved)

#### NFR2: Code Quality
- **NFR2.1:** Component must be written in React with TypeScript
- **NFR2.2:** Component must use Theia's dialog framework (or standard React patterns if Theia dialogs are not suitable)
- **NFR2.3:** Component must have comprehensive unit tests (TDD workflow)
- **NFR2.4:** Component must have E2E integration test verifying permission flow

#### NFR3: Testability
- **NFR3.1:** Component must accept mock permission events for testing
- **NFR3.2:** Component must expose state for test assertions (queue length, current request)
- **NFR3.3:** Tests must verify keyboard shortcuts work correctly

---

## Technical Specifications

### Architecture

**Component Location:**
- **Path:** `extensions/openspace-core/src/browser/permission-dialog.tsx`
- **Reason:** Permission system is core functionality, not chat-specific

**Integration Point:**
- Hook into `SyncService.onPermissionRequired` event from `openspace-core-frontend-module.ts` or a dedicated contribution class

**Dialog Framework:**
- **Option A (Recommended):** Use Theia's `AbstractDialog` class from `@theia/core/lib/browser/dialogs`
- **Option B (Fallback):** Use React modal with custom styling if Theia dialogs don't support dynamic content well

### Data Structures

**Permission Request Interface:**
```typescript
interface PermissionRequest {
    actionId: string;           // Unique identifier for this action
    agentId: string;            // ID of agent requesting permission
    actionType: string;         // e.g., "file_write", "command_execute"
    actionDetails: {            // Type-specific details
        filePath?: string;
        command?: string;
        arguments?: string[];
        [key: string]: any;
    };
    timestamp: number;          // When request was made
}
```

**Component State:**
```typescript
interface PermissionDialogState {
    currentRequest: PermissionRequest | null;
    queue: PermissionRequest[];
    isOpen: boolean;
    timeoutHandle: NodeJS.Timeout | null;
}
```

### API Surface

**SyncService Methods (Already Implemented):**
- `onPermissionRequired: Event<PermissionRequest>` — Subscribe to permission events
- `respondToPermission(actionId: string, granted: boolean): void` — Send user response

**New Component Methods:**
```typescript
class PermissionDialog {
    // Show dialog with request
    show(request: PermissionRequest): void;
    
    // Close dialog and clear state
    close(): void;
    
    // Handle user grant action
    handleGrant(): void;
    
    // Handle user deny action
    handleDeny(): void;
    
    // Process next queued request
    processNextRequest(): void;
}
```

### UI Layout

**Dialog Structure:**
```
┌─────────────────────────────────────────────────┐
│  Permission Required                        [X] │
├─────────────────────────────────────────────────┤
│                                                 │
│  Agent: oracle_a3f7                             │
│  Action: Write File                             │
│                                                 │
│  Details:                                       │
│    Path: /workspace/src/test.ts                 │
│                                                 │
│  This will create or overwrite the file at the  │
│  specified path.                                │
│                                                 │
│                            [Deny]  [Grant ✓]   │
│                                                 │
│  Request 1 of 3                                 │
└─────────────────────────────────────────────────┘
```

### Styling Requirements

**CSS Classes:**
- `.openspace-permission-dialog` — Main dialog container
- `.openspace-permission-header` — Agent ID and action type
- `.openspace-permission-details` — Action details section
- `.openspace-permission-description` — Human-readable explanation
- `.openspace-permission-actions` — Button container
- `.openspace-permission-queue-indicator` — Queue status display

**Color Scheme (Theia Dark Theme):**
- Background: `var(--theia-dialog-background)`
- Border: `var(--theia-dialog-border)`
- Grant button: Green (#4caf50) with hover state
- Deny button: Red (#f44336) with hover state
- Text: `var(--theia-foreground)`

---

## Testing Strategy (TDD Required)

### Test Phases

**Phase 1: Write Unit Tests FIRST**
1. Test dialog renders with permission request data
2. Test "Grant" button calls `respondToPermission(actionId, true)`
3. Test "Deny" button calls `respondToPermission(actionId, false)`
4. Test Enter key triggers grant action
5. Test Escape key triggers deny action
6. Test queue management (multiple requests)
7. Test timeout auto-deny after 60 seconds
8. Test dialog closes after response
9. Test queue indicator displays correctly

**Phase 2: Implement Component**
1. Create `PermissionDialog` component
2. Implement render logic with action details formatting
3. Implement button click handlers
4. Implement keyboard event handlers
5. Implement queue management logic
6. Implement timeout logic
7. Integrate with SyncService

**Phase 3: Write E2E Integration Test**
1. Mock `SyncService.onPermissionRequired` event emission
2. Verify dialog appears in DOM
3. Simulate button clicks and verify `respondToPermission()` calls
4. Verify dialog closes after response
5. Verify queued requests are processed in order

**Phase 4: Manual Testing**
1. Start Theia with OpenCode server running
2. Trigger permission request from OpenCode (mock endpoint or actual agent action)
3. Verify dialog appears with correct data
4. Test grant flow
5. Test deny flow
6. Test queue with multiple rapid requests
7. Test timeout behavior

### Test Files

**Unit Tests:**
- `extensions/openspace-core/src/browser/__tests__/permission-dialog.spec.ts`
- **Target:** 12+ tests covering all requirements

**E2E Tests:**
- `tests/e2e/permission-dialog.spec.ts`
- **Target:** 5+ scenarios (show dialog, grant, deny, queue, timeout)

**Test Coverage Goal:** 100% for PermissionDialog component

---

## Acceptance Criteria (Definition of Done)

### Implementation
- [ ] PermissionDialog component created in `extensions/openspace-core/src/browser/permission-dialog.tsx`
- [ ] Component integrated with SyncService permission events
- [ ] Dialog displays agent ID, action type, action details, and description
- [ ] Grant and Deny buttons work correctly
- [ ] Keyboard shortcuts (Enter/Escape) work correctly
- [ ] Queue management implemented for multiple requests
- [ ] Timeout logic auto-denies after 60 seconds
- [ ] Dialog styling matches Theia theme
- [ ] CSS file created with all required classes

### Testing
- [ ] 12+ unit tests written BEFORE implementation (TDD)
- [ ] All unit tests pass (100%)
- [ ] 5+ E2E integration tests written and passing
- [ ] Test coverage report shows 100% for PermissionDialog
- [ ] Manual testing completed with real OpenCode server

### Build & Git
- [ ] Build succeeds with zero TypeScript errors (`yarn build`)
- [ ] No linting errors introduced
- [ ] Git branch `feature/phase-1-permission-ui` created from `feature/phase-1-foundation`
- [ ] Logical commits (e.g., "test: add unit tests for PermissionDialog", "feat: implement PermissionDialog component")

### Documentation
- [ ] Inline code comments explain complex logic (queue management, timeout)
- [ ] Component props and methods have JSDoc documentation
- [ ] User-facing behavior documented in `docs/features/PERMISSION_SYSTEM.md` (new file)

### Validation
- [ ] Janitor validation PASS with automated test evidence
- [ ] CodeReviewer audit PASS with 90%+ confidence score
- [ ] No blocking issues or critical quality concerns

---

## Deliverables

### Code Artifacts
1. **Component Implementation:**
   - `extensions/openspace-core/src/browser/permission-dialog.tsx` (~200-300 lines)
   - `extensions/openspace-core/src/browser/style/permission-dialog.css` (~100-150 lines)

2. **Integration:**
   - Update `openspace-core-frontend-module.ts` or create `PermissionDialogContribution` class
   - Wire up SyncService event subscription

3. **Tests:**
   - `extensions/openspace-core/src/browser/__tests__/permission-dialog.spec.ts` (~300-400 lines)
   - `tests/e2e/permission-dialog.spec.ts` (~200-300 lines)

4. **Documentation:**
   - `docs/features/PERMISSION_SYSTEM.md` — User guide explaining permission system and dialog behavior

### Process Artifacts
1. **Builder Report:** `.opencode/context/active_tasks/result-1.14-permission-ui.md`
2. **Janitor Validation:** `.opencode/context/active_tasks/validation-report-1.14-permission-ui.md`
3. **CodeReviewer Audit:** `.opencode/context/active_tasks/codereview-1.14-permission-ui.md`

---

## Dependencies

### Upstream (Must Be Complete)
- ✅ Task 1.10: SyncService implementation with `onPermissionRequired` event
- ✅ Remediation: Test infrastructure and git workflow established

### Downstream (Blocks)
- **Phase 1 Completion:** This is the final task of Phase 1
- **Phase 2 Planning:** Cannot start Phase 2 until Phase 1 is validated complete

---

## Constraints & Assumptions

### Constraints
- **C1:** Must use TypeScript with strict mode enabled
- **C2:** Must follow TDD workflow (tests written BEFORE implementation)
- **C3:** Must integrate with existing SyncService (no breaking changes allowed)
- **C4:** Must be compatible with Theia 1.68.2 dialog system
- **C5:** Must pass NSO validation (Janitor + CodeReviewer approval required)

### Assumptions
- **A1:** SyncService's `onPermissionRequired` event provides all necessary data
- **A2:** OpenCode server sends permission requests when agent actions require approval
- **A3:** User will be present to respond to permission requests (system is interactive)
- **A4:** 60-second timeout is sufficient for user decision-making
- **A5:** FIFO queue order is acceptable (no priority-based ordering needed)

### Known Limitations
- **L1:** Permission history is not persisted (no audit log in Phase 1)
- **L2:** No batch grant/deny (each request must be handled individually)
- **L3:** No configurable timeout duration (hardcoded 60 seconds)
- **L4:** No "remember my choice" option for repeated actions

---

## Risk Assessment

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|------------|
| Theia dialog system is hard to use | Medium | Medium | Fallback to custom React modal |
| Permission events don't fire in tests | Low | High | Mock SyncService completely in unit tests |
| Dialog blocks other UI interactions | Low | High | Verify modal implementation is correct |
| Queue logic has race conditions | Medium | High | Write comprehensive concurrency tests |
| Timeout doesn't work correctly | Low | Medium | Use Sinon fake timers in unit tests |

---

## Success Metrics

### Functional Success
- ✅ Dialog appears when permission event fires
- ✅ User can grant permission and action proceeds
- ✅ User can deny permission and action is blocked
- ✅ Queue processes multiple requests correctly
- ✅ Timeout auto-denies after 60 seconds

### Quality Success
- ✅ 12+ unit tests passing (100%)
- ✅ 5+ E2E tests passing (100%)
- ✅ Build succeeds with zero errors
- ✅ Janitor validation PASS
- ✅ CodeReviewer confidence score ≥ 90%

### Process Success
- ✅ TDD workflow followed (tests written first)
- ✅ Git workflow followed (feature branch, logical commits)
- ✅ NSO compliance maintained (no role violations)
- ✅ Phase 1 declared 100% complete

---

## Oracle Notes

**Complexity Assessment:** Medium
- UI component is straightforward React
- Queue management adds moderate complexity
- Integration with SyncService is well-defined

**Estimated Effort:** 2-3 hours for Builder (TDD workflow)
- Phase 1 (tests): 45-60 minutes (12+ unit tests)
- Phase 2 (implementation): 45-60 minutes (component + integration)
- Phase 3 (E2E tests): 30 minutes (5+ scenarios)
- Phase 4 (manual testing): 15-30 minutes

**Critical Path:** This is the final Phase 1 task. Completion unblocks Phase 1 validation and Phase 2 planning.

**Delegation:** Assign to Builder with strict TDD enforcement. Janitor MUST verify tests were written before implementation (check git commit order).

---

## Approval

**Oracle Decision:** Contract approved. Ready for Builder implementation.

**Next Steps:**
1. Builder: Load TDD skill, create feature branch, write unit tests FIRST
2. Builder: Implement component and integration
3. Builder: Write E2E tests and perform manual testing
4. Janitor: Validate with automated test execution
5. CodeReviewer: Audit implementation quality
6. Oracle: Review and approve Phase 1 completion
7. Librarian: Post-completion activities and memory updates

**Contract Status:** ✅ APPROVED  
**Contract Date:** 2026-02-16  
**Oracle Signature:** oracle_a3f7
