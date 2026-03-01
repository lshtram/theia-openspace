# Send Button Always Visible — Design

**Date:** 2026-03-01
**Status:** Approved

## Problem

The chat widget prompt toolbar is a single flex row:

```
[left-group: Agent | Model | Mode pills]  [@]  [/]  [📎]  [SEND]
```

When the chat panel is narrowed, the pills in the left-group don't have sufficient shrink
budget, so the browser distributes overflow shrinkage to the right-side elements — eventually
pushing the send button out of view.

Previous attempts (`d8a4d64`, `7968982`) added `min-width: 0; flex-shrink: 1` to the model
selector pill only. This helped partially but left the agent pill and mode pill unconstrained,
and didn't guarantee the send button's visibility.

## Root Cause

The DOM structure is:

```html
<div class="prompt-input-toolbar">   <!-- flex row -->
  <div class="prompt-toolbar-left-group">  <!-- flex: 1 -->
    <button class="prompt-toolbar-pill">Agent</button>
    <!-- modelSelectorSlot (model-selector wrapper) -->
    <button class="prompt-toolbar-pill">Mode</button>
  </div>
  <button class="prompt-input-icon-btn">@</button>
  <button class="prompt-input-icon-btn">/</button>
  <button class="prompt-input-icon-btn">📎</button>
  <button class="prompt-input-send-button">↑</button>
</div>
```

The left-group has `flex: 1` so it "wants" to take all available space. But `flex: 1` alone
doesn't make it shrink below its content minimum — `min-width: 0` is required for that.
Without `overflow: hidden` on the left-group, the pills overflow it and intrude on siblings.

## Design

**Three-part CSS-only fix in `prompt-input.css`:**

### Part 1 — Left group absorbs all shrinkage

```css
.prompt-toolbar-left-group {
    flex: 1;
    min-width: 0;        /* allow shrinking below content size */
    overflow: hidden;    /* clip pills rather than overflow into siblings */
}
```

### Part 2 — Pills shrink gracefully inside the left group

All `.prompt-toolbar-pill` buttons (Agent, Mode) get shrink budget:

```css
.prompt-toolbar-pill {
    flex-shrink: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
}
```

The model selector wrapper (`.model-selector`) already has `min-width: 0; flex-shrink: 1`
from previous fixes — confirmed sufficient.

### Part 3 — Send button is protected

The send button already has `flex-shrink: 0`. Confirm it stays and that `margin-left: auto`
is removed (the left-group's `flex: 1` provides the same right-push effect and `margin-left:
auto` on the send button can fight with it).

### Part 4 — Icon buttons protected

`@`, `/`, `📎` icon buttons get `flex-shrink: 0` so they won't shrink. At extreme widths
the left-group will collapse its pills to near-zero before these are touched, and the send
button is last so it always has space.

## Priority Order (narrowest → lost first)

1. Mode pill label text truncates
2. Agent pill label text truncates  
3. Model pill label text truncates
4. Pills collapse to near-zero (overflow: hidden clips them)
5. `@` `/` `📎` icon buttons stay (flex-shrink: 0)
6. Send button always visible (flex-shrink: 0, last in DOM)

## Files

- **Modify only:** `extensions/openspace-chat/src/browser/style/prompt-input.css`
- **No JSX changes needed**
- **Worktree:** `.worktrees/phase-2.7-2.8`

## Testing

Visual regression: open the IDE, narrow the chat panel progressively.
Expected: send button stays visible at all widths. Pills shrink/truncate before icon buttons disappear.

Unit test: render `.prompt-input-toolbar` with jsdom and assert `.prompt-input-send-button` is present.
