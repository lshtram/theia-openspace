# Agent Control E2E Tests - Documentation

## Overview

This document describes how to run the Agent IDE Control E2E tests for Phase 3 Task 3.9.

## Test File Location

- **Test File**: `tests/e2e/agent-control.spec.ts`
- **Config**: `playwright.config.ts`

## Prerequisites

1. **Theia Application Running**: The tests require Theia to be running on `http://localhost:3000`
2. **OpenCode Server**: The Hub server must be running for full integration tests
3. **Node.js 18+**: Required for Playwright

## Running the Tests

### Full E2E Test Suite

```bash
# Run all E2E tests (includes agent-control tests)
npm run test:e2e
```

### Run Only Agent Control Tests

```bash
# Run specific test file
npx playwright test tests/e2e/agent-control.spec.ts

# Run with UI mode (visual debugging)
npm run test:e2e:ui -- tests/e2e/agent-control.spec.ts
```

### Individual Test Scenarios

```bash
# Run a specific test
npx playwright test tests/e2e/agent-control.spec.ts --grep "T1: openspace.editor.open"
```

## Test Scenarios

### Core Tests (8 scenarios)

| ID | Test | Description |
|----|------|-------------|
| T1 | `openspace.editor.open` | File opens at specified line |
| T2 | `openspace.editor.highlight` | Lines are highlighted in editor |
| T3 | `openspace.terminal.create + send` | Terminal created and command runs |
| T4 | `openspace.terminal.read_output` | Terminal output is readable |
| T5 | `openspace.pane.open` | Pane opens correctly |
| T6 | Multiple blocks | Multiple commands in one response |
| T7 | Malformed JSON | Malformed blocks are discarded |
| T8 | Chunk boundary split | Streaming chunks are reassembled |

### Additional Tests (4 scenarios)

| ID | Test | Description |
|----|------|-------------|
| T9 | Clean text | No `%%OS{...}%%` visible to user |
| T10 | Command palette | openspace.* commands visible |
| T11 | Path traversal | Security: path traversal blocked |
| T12 | Sensitive files | Security: sensitive files blocked |

## Expected Behavior

### When Theia is Running

All 12 tests will execute and verify:
- Command parsing and execution
- Security validations
- Clean text display
- Full pipeline integration

### When Theia is Not Running

Tests will **skip gracefully** with appropriate messages:
- `Theia not available - requires running browser app`
- `Chat widget not available`
- `Failed to load Theia`

This is **expected behavior** - tests are designed to detect Theia availability and skip rather than fail.

## Manual Testing

To manually verify the agent control functionality:

1. **Start Theia**:
   ```bash
   yarn start:browser
   ```

2. **Open Chat**: Navigate to the OpenSpace chat panel

3. **Send a Test Message**: 
   Send a message that would trigger an agent response

4. **Verify Command Execution**:
   - Check the browser console for command logs
   - Verify IDE actions (editor opens, terminal creates, etc.)

## Debugging

### View Test Traces

```bash
# Traces are saved on test failure in test-results/
npx playwright show-trace test-results/
```

### Increase Timeout

If tests are timing out, modify `playwright.config.ts`:

```typescript
export default defineConfig({
  timeout: 120 * 1000, // 2 minutes
  // ...
});
```

### Verbose Logging

```bash
# Run with debug output
DEBUG=* npx playwright test tests/e2e/agent-control.spec.ts
```

## CI/CD

In CI environments, the tests will automatically skip if Theia is not available:

```bash
# CI typically doesn't have Theia running
npm run test:e2e
# Output: Tests skipped - Theia not available
```

## Troubleshooting

### "Theia not available" Errors

1. Ensure `yarn start:browser` is running
2. Check port 3000 is accessible
3. Verify Theia shell loaded correctly

### "Chat widget not available"

1. The OpenSpace extension must be loaded
2. Check browser console for extension errors

### Test Failures

1. Check Playwright browser is installed: `npx playwright install`
2. Verify network connectivity
3. Review test traces in `test-results/`

## Architecture Notes

The tests verify the complete pipeline:

```
Agent Response (%%OS{...}%%)
    ↓
Frontend Interceptor (SyncService)
    ↓
Hub RPC Call
    ↓
CommandRegistry.executeCommand()
    ↓
IDE Action (editor/terminal/pane)
```

Each test verifies one or more steps in this pipeline.
