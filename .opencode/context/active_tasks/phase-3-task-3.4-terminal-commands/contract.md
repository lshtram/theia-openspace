# Contract: Phase 3 Task 3.4 — Terminal Commands Registration

> **Task ID:** 3.4  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Create `TerminalCommandContribution` to register 5 terminal commands in Theia's `CommandRegistry`.

**Why:** The agent needs to create terminals, send commands, read output, and close terminals.

**Dependencies:** Phase 1 complete (✅)

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.4 (FR-3.4: Terminal Commands Registration) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.6 (Terminal Commands) |
| TECHSPEC-THEIA-OPENSPACE.md | §17.3 (Dangerous command confirmation) |
| TECHSPEC-THEIA-OPENSPACE.md | §17.9 (Terminal output sanitization) |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/terminal-command-contribution.ts  (NEW)
extensions/openspace-core/src/browser/terminal-ring-buffer.ts  (NEW - for output capture)
extensions/openspace-core/src/browser/__tests__/terminal-command-contribution.spec.ts  (NEW)
extensions/openspace-core/src/browser/openspace-core-frontend-module.ts  (MODIFY)
```

---

## 4. Requirements

### 4.1 Commands to Register

| Command ID | Arguments | Returns |
|---|---|---|
| `openspace.terminal.create` | `{ title?: string, cwd?: string, shellPath?: string }` | `{ success: boolean, terminalId: string }` |
| `openspace.terminal.send` | `{ terminalId: string, text: string }` | `{ success: boolean }` |
| `openspace.terminal.read_output` | `{ terminalId: string, lines?: number }` | `{ success: boolean, output: string[] }` |
| `openspace.terminal.list` | `{}` | `{ success: boolean, terminals: TerminalInfo[] }` |
| `openspace.terminal.close` | `{ terminalId: string }` | `{ success: boolean }` |

### 4.2 Ring Buffer Implementation

Capture terminal output for agent read-back:

```typescript
class TerminalRingBuffer {
  private buffer: Map<string, string[]> = new Map(); // terminalId -> lines
  private maxLines = 10000;
  
  append(terminalId: string, data: string): void {
    const lines = this.buffer.get(terminalId) || [];
    lines.push(...data.split('\n'));
    if (lines.length > this.maxLines) {
      lines.splice(0, lines.length - this.maxLines);
    }
    this.buffer.set(terminalId, lines);
  }
  
  read(terminalId: string, lines: number = 100): string[] {
    const all = this.buffer.get(terminalId) || [];
    return all.slice(-lines);
  }
}
```

### 4.3 Dangerous Command Detection (GAP-8)

Per §17.3, detect dangerous commands and prompt for confirmation:

```typescript
const DANGEROUS_PATTERNS = [
  /^rm\s+-rf\s+/,
  /^sudo\s+/,
  /^chmod\s+777\s+/,
  /^:\(\)\{:\|:&\}\;:*/,
];

function isDangerous(text: string): boolean {
  return DANGEROUS_PATTERNS.some(p => p.test(text.trim()));
}
```

### 4.4 Output Sanitization (GAP-2)

Per §17.9, sanitize terminal output before returning to agent:

```typescript
function sanitizeOutput(output: string): string {
  // Remove ANSI escape sequences
  output = output.replace(/\x1B\[[0-9;]*[a-zA-Z]/g, '');
  // Remove control characters
  output = output.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');
  return output;
}
```

---

## 5. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.4.1 | Can create a terminal | Test: create terminal, verify ID returned |
| AC-3.4.2 | Can send and read output | Test: send "echo hello", read back "hello" |
| AC-3.4.3 | Ring buffer prevents memory exhaustion | Test: verify 10K line limit |
| AC-3.4.4 | Terminal IDs are stable | Test: create, use, close, verify ID |
| AC-3.4.5 | Dangerous commands trigger confirmation | Test: send "rm -rf", verify prompt |

---

## 6. Test Scenarios

| # | Test | Expected |
|---|------|----------|
| T1 | `openspace.terminal.create({ title: 'test' })` | Returns terminalId |
| T2 | `openspace.terminal.send({ terminalId: 'x', text: 'echo hello' })` | Success |
| T3 | `openspace.terminal.read_output({ terminalId: 'x', lines: 10 })` | Returns ["hello"] |
| T4 | `openspace.terminal.list()` | Returns terminal list |
| T5 | `openspace.terminal.send({ text: 'rm -rf /' })` | Triggers confirmation |
| T6 | Read large output (>10K lines) | Returns last 10K only |

---

## 7. Files to Create/Modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/terminal-command-contribution.ts` | CREATE |
| `extensions/openspace-core/src/browser/terminal-ring-buffer.ts` | CREATE |
| `extensions/openspace-core/src/browser/__tests__/terminal-command-contribution.spec.ts` | CREATE |
| `extensions/openspace-core/src/browser/openspace-core-frontend-module.ts` | MODIFY |

---

## 8. Success Criteria

- [ ] 5 terminal commands registered
- [ ] Ring buffer implementation (10K lines max)
- [ ] Dangerous command detection + confirmation
- [ ] Output sanitization
- [ ] Unit tests pass (minimum 8)
- [ ] No regressions

---

**Contract Status:** APPROVED  
**Start Date:** 2026-02-17
