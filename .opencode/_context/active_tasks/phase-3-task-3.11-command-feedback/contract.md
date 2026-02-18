# Contract: Phase 3 Task 3.11 — Command Result Feedback Mechanism

> **Task ID:** 3.11  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Implement command result feedback loop - capture command results and include in system prompt.

**Why:** The agent needs to know if its commands succeeded or failed, to learn from mistakes.

**Dependencies:** Task 3.9 (E2E working) ✅ IN PROGRESS

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.11 (FR-3.11) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.6 |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/opencode-sync-service.ts  (MODIFY)
extensions/openspace-core/src/node/hub.ts  (MODIFY - POST /openspace/command-results)
```

---

## 4. Requirements

### 4.1 Capture Command Results

```typescript
// In OpenCodeSyncService
async executeCommand(cmd: string, args: unknown): Promise<CommandResult> {
  const startTime = Date.now();
  try {
    const result = await this.commandRegistry.executeCommand(cmd, args);
    const result: CommandResult = {
      success: true,
      output: result,
      executionTime: Date.now() - startTime
    };
    await this.postResult(cmd, args, result);
    return result;
  } catch (error) {
    const result: CommandResult = {
      success: false,
      error: error.message,
      executionTime: Date.now() - startTime
    };
    await this.postResult(cmd, args, result);
    throw error;
  }
}
```

### 4.2 POST Result to Hub

```typescript
private async postResult(cmd: string, args: unknown, result: CommandResult): Promise<void> {
  await fetch('/openspace/command-results', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      cmd,
      args,
      ...result,
      timestamp: new Date().toISOString()
    })
  });
}
```

### 4.3 Hub Ring Buffer

```typescript
// In hub.ts
const commandResults: CommandResult[] = [];
const MAX_RESULTS = 20;

app.post('/openspace/command-results', (req, res) => {
  commandResults.push(req.body);
  if (commandResults.length > MAX_RESULTS) {
    commandResults.shift();
  }
  res.json({ success: true });
});
```

### 4.4 Include in System Prompt

Update GET /openspace/instructions to include recent results:

```typescript
// In hub.ts
app.get('/openspace/instructions', (req, res) => {
  // ... existing prompt generation ...
  
  // Add recent command results
  const resultsSection = commandResults
    .slice(-5) // Last 5 results
    .map(r => `- ${r.cmd} → ${r.success ? 'SUCCESS' : 'FAILED: ' + r.error}`)
    .join('\n');
  
  prompt += `\n## Recent Command Results\n${resultsSection}\n`;
  
  res.send(prompt);
});
```

---

## 5. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.11.1 | Failed command → result logged in Hub | Check Hub logs |
| AC-3.11.2 | Next GET /openspace/instructions includes failure | Check prompt |
| AC-3.11.3 | Agent can reference failures in responses | Test scenario |
| AC-3.11.4 | Ring buffer limits to 20 results | Verify size |

---

## 6. Files to Modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/opencode-sync-service.ts` | Add result capture |
| `extensions/openspace-core/src/node/hub.ts` | Add endpoint + prompt inclusion |

---

## 7. Success Criteria

- [ ] Command results captured
- [ ] Results POSTed to Hub
- [ ] Ring buffer (20 max)
- [ ] Results in system prompt
- [ ] Build passes

---

**Contract Status:** APPROVED
