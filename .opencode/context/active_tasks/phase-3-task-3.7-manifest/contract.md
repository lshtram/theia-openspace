# Contract: Phase 3 Task 3.7 — Command Manifest Auto-Generation

> **Task ID:** 3.7  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Upgrade BridgeContribution to build and publish a rich command manifest to Hub.

**Why:** The agent needs to know what commands are available. The manifest is the source of truth.

**Dependencies:** Tasks 3.2, 3.3, 3.4, 3.5 ✅ COMPLETE

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.7 (FR-3.7) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.3 |

---

## 3. Implementation Location

```
extensions/openspace-core/src/browser/bridge-contribution.ts  (MODIFY)
extensions/openspace-core/src/node/hub.ts  (MODIFY - manifest endpoint)
```

---

## 4. Requirements

### 4.1 Build Manifest

```typescript
// In BridgeContribution.onStart()
buildCommandManifest(): CommandManifest {
  const commands = this.commandRegistry.commands
    .filter(cmd => cmd.id.startsWith('openspace.'))
    .map(cmd => ({
      id: cmd.id,
      name: cmd.label || cmd.id,
      description: cmd.description || '',
      category: this.getCategory(cmd.id),
      arguments_schema: this.getArgumentSchema(cmd.id),
      handler: cmd.id
    }));
  
  return {
    version: '1.0',
    commands,
    lastUpdated: new Date().toISOString()
  };
}
```

### 4.2 Publish to Hub

```typescript
async publishManifest(): Promise<void> {
  const manifest = this.buildCommandManifest();
  await fetch('/openspace/manifest', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(manifest)
  });
}
```

### 4.3 Hub Endpoint

```typescript
// In hub.ts
app.post('/openspace/manifest', (req, res) => {
  hubState.manifest = req.body;
  hubState.lastManifestUpdate = new Date().toISOString();
  res.json({ success: true });
});
```

### 4.4 Re-publish on Extension Load

```typescript
// Listen for new extensions
this.extensionService.onExtensionLoad(() => {
  this.publishManifest();
});
```

---

## 5. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.7.1 | Hub's manifest cache contains all openspace commands | GET /openspace/manifest returns commands |
| AC-3.7.2 | Adding new command → manifest updates | Register command, check manifest |
| AC-3.7.3 | Manifest includes argument schemas | Check JSON in manifest |
| AC-3.7.4 | 20 Phase 3 commands in manifest | Count commands |

---

## 6. Files to Modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/browser/bridge-contribution.ts` | Add manifest building |
| `extensions/openspace-core/src/node/hub.ts` | Add POST /openspace/manifest |

---

## 7. Success Criteria

- [ ] All 20 openspace.* commands in manifest
- [ ] Argument schemas included
- [ ] Manifest published to Hub on startup
- [ ] Re-publishes on extension load
- [ ] Build passes

---

**Contract Status:** APPROVED
