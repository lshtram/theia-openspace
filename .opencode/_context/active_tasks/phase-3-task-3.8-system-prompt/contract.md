# Contract: Phase 3 Task 3.8 — System Prompt Generation

> **Task ID:** 3.8  
> **Status:** IN_PROGRESS  
> **Created:** 2026-02-17  
> **Worktree:** `.worktrees/phase-3-agent-control/`

---

## 1. Overview

**What:** Implement system prompt template in Hub's `GET /openspace/instructions` handler.

**Why:** The agent needs to know how to use IDE commands via `%%OS{...}%%` blocks.

**Dependencies:** Task 3.7 (Manifest) ✅ IN PROGRESS

---

## 2. Technical Specification Reference

| Source | Section |
|--------|---------|
| REQ-AGENT-IDE-CONTROL.md | §2.8 (FR-3.8) |
| TECHSPEC-THEIA-OPENSPACE.md | §6.4 |

---

## 3. Implementation Location

```
extensions/openspace-core/src/node/hub.ts  (MODIFY - GET /openspace/instructions)
```

---

## 4. Requirements

### 4.1 Prompt Template

```
# System Instructions: Theia OpenSpace IDE Control

You are operating inside Theia OpenSpace IDE. You can control the IDE by emitting
%%OS{...}%% blocks in your response. These are invisible to the user.

## Available Commands
[Generated from manifest — full command list with argument schemas]

## Current IDE State
[Generated from pane state — open panes, active tabs, terminals]

## Examples
[2-3 concrete examples of %%OS{...}%% usage]
```

### 4.2 Dynamic Sections

**Commands Section:**
```typescript
function generateCommandsSection(manifest: CommandManifest): string {
  return manifest.commands
    .map(cmd => `- ${cmd.id}: ${cmd.description}`)
    .join('\n');
}
```

**IDE State Section:**
```typescript
function generateStateSection(state: PaneStateSnapshot): string {
  return `- Main area: ${state.panes.filter(p => p.area === 'main').map(p => p.title).join(', ') || 'none'}
- Bottom panel: ${state.panes.filter(p => p.area === 'bottom').map(p => p.title).join(', ') || 'none'}`;
}
```

### 4.3 Hub Endpoint

```typescript
app.get('/openspace/instructions', (req, res) => {
  const prompt = generatePrompt(hubState.manifest, hubState.paneState);
  res.type('text/plain').send(prompt);
});
```

---

## 5. Acceptance Criteria

| ID | Criteria | Verification |
|----|----------|--------------|
| AC-3.8.1 | GET /openspace/instructions returns prompt | curl endpoint |
| AC-3.8.2 | Prompt includes command inventory | Check content |
| AC-3.8.3 | Prompt includes current IDE state | Check content |
| AC-3.8.4 | Examples section included | Check content |

---

## 6. Files to Modify

| File | Action |
|------|--------|
| `extensions/openspace-core/src/node/hub.ts` | Add prompt generation |

---

## 7. Success Criteria

- [ ] GET /openspace/instructions returns formatted prompt
- [ ] Commands section populated from manifest
- [ ] IDE state section populated from pane state
- [ ] Examples section included
- [ ] Build passes

---

**Contract Status:** APPROVED
