# Contract: Phase 3 Task 3.10 — Pane State Publishing

> **Task ID:** 3.10  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** BridgeContribution subscribes to PaneService events and publishes state to Hub.

**Why:** The agent needs to know current IDE state (open files, terminals, etc.) in its system prompt.

**Dependencies:** Task 3.1 (PaneService) ✅ COMPLETE, Task 3.7 (Manifest) ✅ IN PROGRESS

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.10 (FR-3.10) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.4 |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/bridge-contribution.ts  (MODIFY)
extensions/openspace-core/src/node/hub.ts  (MODIFY - POST /openspace/state)
```

---

## 4. Requirements

### 4.1 Subscribe to PaneService Events

```typescript
// In BridgeContribution
@inject(PaneService)
private readonly paneService: PaneService;

async onStart(app: FrontendApplication): Promise<void> {
  // Subscribe to layout changes
  this.paneService.onPaneLayoutChanged(snapshot => {
    this.publishState(snapshot);
  });
}
```

### 4.2 Publish State

```typescript
private async publishState(state: PaneStateSnapshot): Promise<void> {
  await fetch('/openspace/state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state)
  });
}
```

### 4.3 Throttling

Max 1 POST per second to avoid flooding:

```typescript
private lastPublishTime = 0;
private throttleDelay = 1000; // 1 second

async publishState(state: PaneStateSnapshot): Promise<void> {
  const now = Date.now();
  if (now - this.lastPublishTime < this.throttleDelay) {
    return; // Skip - throttled
  }
  this.lastPublishTime = now;
  // ... publish
}
```

### 4.4 Hub Endpoint

```typescript
// In hub.ts
app.post('/openspace/state', (req, res) => {
  hubState.paneState = req.body;
  hubState.lastStateUpdate = new Date().toISOString();
  res.json({ success: true });
});
```

---

## 5. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.10.1 | Open file → /openspace/instructions reflects it | Check endpoint |
| AC-3.10.2 | Close file → disappears from instructions | Check endpoint |
| AC-3.10.3 | Create terminal → instructions reflect it | Check endpoint |
| AC-3.10.4 | State updates throttled (≤1/sec) | Verify timing |

---

## 6. Files to Modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/bridge-contribution.ts` | Add state publishing |
| `extensions/openspace-core/src/node/hub.ts` | Add state endpoint |

---

## 7. Success Criteria

- [ ] PaneService events subscribed
- [ ] State published to Hub
- [ ] Throttling works (≤1/sec)
- [ ] Build passes

---

**Contract Status:** APPROVED
