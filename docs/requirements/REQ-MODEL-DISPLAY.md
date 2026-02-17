---
id: REQ-MODEL-DISPLAY
title: Model/Provider Display
status: DRAFT
priority: P0
phase: 1
task: 1.15
author: analyst_7a3e
created: 2026-02-17
---

# REQ-MODEL-DISPLAY: Model/Provider Display

## Overview

Add minimal read-only display of current model and provider information to the chat widget. This makes Phase 1 testable by allowing users to verify which AI model/provider they're communicating with, without requiring full model selection UI (deferred to Phase 5).

## User Stories

- As a user, I want to see which AI model I'm currently using, so I can verify the correct model is active
- As a user, I want to see which provider (e.g., Anthropic, OpenAI) is active, so I understand which service is being used
- As a developer testing Phase 1, I need to verify that model/provider configuration is correctly loaded from the opencode server
- As a user with multiple provider configurations, I want to quickly identify which one is active without opening settings

## Functional Requirements

### REQ-MD-1: Display Current Provider Name
**Priority:** P0

The chat widget MUST display the current provider name (e.g., "Anthropic", "OpenAI").

- Data source: `OpenCodeService.getProvider().name`
- Fallback: Display "Unknown Provider" if RPC call fails or returns null
- Update trigger: On session initialization, on active session change

### REQ-MD-2: Display Current Model Name
**Priority:** P0

The chat widget MUST display the current model name (e.g., "claude-sonnet-4.5", "gpt-4").

- Data source: `OpenCodeService.getProvider().model`
- Fallback: Display "Unknown Model" if RPC call fails or returns null
- Update trigger: On session initialization, on active session change

### REQ-MD-3: Display Format
**Priority:** P0

The model/provider information MUST be displayed in a clear, non-intrusive format:

- Format: `[Provider] Model` (e.g., "Anthropic claude-sonnet-4.5")
- Location: Chat widget status area (below session header, above message list)
- Style: Small text, secondary color, read-only (no click/edit interaction)
- Alternative acceptable format: Tooltip on hover over a small info icon

### REQ-MD-4: Refresh on Session Initialization
**Priority:** P0

When a session is created or activated, the model/provider display MUST refresh:

- Subscribe to `SessionService.onActiveSessionChanged` event
- Call `OpenCodeService.getProvider()` on session change
- Update display with new data

### REQ-MD-5: Error Handling
**Priority:** P0

The display MUST gracefully handle RPC failures:

- If `getProvider()` throws an error, display "Model info unavailable"
- Log error to console with DEBUG level
- Do NOT block chat functionality if model info cannot be loaded
- Retry on next session change (no continuous retry loop)

### REQ-MD-6: Performance - Caching
**Priority:** P1

To avoid unnecessary RPC calls:

- Cache provider/model info for the duration of a session
- Only refresh when active session changes or on explicit refresh
- Do NOT poll or refresh on every message

## UI Requirements

### Location Options (Choose One)

**Option A: Status Bar in Chat Widget** (Recommended)
- Position: Below session header, above message list
- Visual: Small grey text with icon (e.g., `🤖 Anthropic claude-sonnet-4.5`)
- Advantage: Always visible, chat-specific context

**Option B: Theia Status Bar** (Alternative)
- Position: Bottom-right of Theia status bar (global)
- Visual: Status bar item with codicon
- Advantage: Global visibility, follows Theia conventions

**Decision:** Option A is recommended for Phase 1 (chat-specific, simpler implementation).

### Visual Design

```
┌─────────────────────────────────────┐
│ [Session Dropdown] [+ New] [🗑️]   │ ← Session Header
├─────────────────────────────────────┤
│ 🤖 Anthropic claude-sonnet-4.5      │ ← NEW: Model/Provider Display
├─────────────────────────────────────┤
│                                     │
│ [Messages]                          │
│                                     │
└─────────────────────────────────────┘
```

**CSS Classes:**
- `.model-provider-status` — container
- `.model-provider-status-icon` — icon (optional)
- `.model-provider-status-text` — text content
- `.model-provider-status-error` — error state styling

### Update Frequency

- On session init (when chat widget first loads)
- On active session change
- Manual refresh: Not required for Phase 1 (no refresh button)

## Technical Requirements

### Data Sources

**Primary RPC Methods** (already implemented in backend):
```typescript
// From opencode-protocol.ts
interface OpenCodeService {
  getProvider(directory?: string): Promise<Provider>;
  getConfig(directory?: string): Promise<AppConfig>;
}

interface Provider {
  readonly id: string;
  readonly name: string;    // e.g., "Anthropic"
  readonly model: string;   // e.g., "claude-sonnet-4.5"
}

interface AppConfig {
  readonly model: string;
  readonly provider: string;
  readonly directory?: string;
}
```

**Implementation Approach:**
- Inject `OpenCodeService` into `ChatWidget`
- Call `getProvider()` in session change handler
- Store result in React state (`useState<Provider | undefined>`)

### Error Handling

| Error Condition | Display Behavior | Logging |
|---|---|---|
| RPC timeout | "Model info unavailable" | `console.debug('[ModelDisplay] RPC timeout')` |
| Provider undefined | "Unknown Provider Unknown Model" | `console.debug('[ModelDisplay] Provider returned undefined')` |
| Network error | "Model info unavailable" | `console.debug('[ModelDisplay] Network error: ${err}')` |
| Session not initialized | Don't show display (hidden) | No log |

### Performance

**Caching Strategy:**
- Cache provider data at session level (not per-message)
- Invalidate cache on session change
- No background refresh (only on-demand)

**Expected RPC Call Frequency:**
- ~1-2 calls per session switch
- 0 calls during normal message streaming
- No impact on message send/receive performance

## Non-Requirements (Deferred to Phase 5)

The following are **explicitly out of scope** for Phase 1:

- ❌ Model selection dropdown
- ❌ Provider configuration UI
- ❌ API key management
- ❌ Model switching without restarting opencode server
- ❌ Per-session model configuration
- ❌ Model capability display (token limits, pricing, etc.)
- ❌ Agent-specific model display (Oracle, Builder, etc.)
- ❌ Multiple concurrent provider support
- ❌ Click-to-copy model name
- ❌ Refresh button or manual reload

## Acceptance Criteria

### AC-1: Visual Display
- [ ] Current provider name is visible in the chat widget
- [ ] Current model name is visible in the chat widget
- [ ] Display format is clear and non-intrusive (not blocking chat)
- [ ] Display uses appropriate styling (secondary text, not prominent)

### AC-2: Data Accuracy
- [ ] Display shows correct provider from `getProvider()` RPC call
- [ ] Display shows correct model from `getProvider()` RPC call
- [ ] Display updates when switching sessions

### AC-3: Error Handling
- [ ] If RPC fails, display shows "Model info unavailable" or similar
- [ ] Chat functionality is NOT blocked by model display errors
- [ ] Errors are logged to console at DEBUG level
- [ ] No continuous retry loops on error

### AC-4: Performance
- [ ] Model info is cached per session (not fetched per message)
- [ ] No observable delay in message sending due to model display
- [ ] RPC calls only occur on session change (not on every render)

### AC-5: User Testing
- [ ] Manual test: Start session, verify correct model displayed
- [ ] Manual test: Switch sessions, verify display updates
- [ ] Manual test: Simulate RPC failure, verify graceful fallback
- [ ] Manual test: Verify chat functionality unaffected by display

## Implementation Notes

### Suggested Implementation Location

**File:** `extensions/openspace-chat/src/browser/chat-widget.tsx`

**Changes:**
1. Add state: `const [providerInfo, setProviderInfo] = React.useState<Provider | undefined>()`
2. Add effect to load provider on session change:
   ```typescript
   React.useEffect(() => {
     if (sessionService.activeSession) {
       openCodeService.getProvider()
         .then(setProviderInfo)
         .catch(err => {
           console.debug('[ModelDisplay] Failed to load provider:', err);
           setProviderInfo(undefined);
         });
     }
   }, [sessionService.activeSession]);
   ```
3. Add display component in render:
   ```tsx
   {providerInfo && (
     <div className="model-provider-status">
       <span className="model-provider-status-icon">🤖</span>
       <span className="model-provider-status-text">
         {providerInfo.name} {providerInfo.model}
       </span>
     </div>
   )}
   ```

### CSS Additions

**File:** `extensions/openspace-chat/src/browser/style/chat-widget.css` (or inline styles)

```css
.model-provider-status {
  padding: 4px 12px;
  font-size: 0.85em;
  color: var(--theia-descriptionForeground);
  background-color: var(--theia-editor-background);
  border-bottom: 1px solid var(--theia-panel-border);
  display: flex;
  align-items: center;
  gap: 6px;
}

.model-provider-status-error {
  color: var(--theia-errorForeground);
}
```

## Dependencies

**Upstream:**
- `OpenCodeService.getProvider()` — already implemented in backend
- `SessionService.onActiveSessionChanged` — already implemented

**Downstream:**
- None (read-only display, no downstream consumers)

## Testing Strategy

### Manual Testing (Phase 1)

1. **Basic Display:**
   - Start Theia Openspace
   - Create or open a session
   - Verify provider and model are displayed correctly

2. **Session Switch:**
   - Create multiple sessions
   - Switch between sessions
   - Verify display updates (or remains stable if same config)

3. **Error Handling:**
   - Simulate RPC failure (disconnect backend)
   - Verify graceful fallback display
   - Verify chat still functional

4. **Visual Check:**
   - Verify display is non-intrusive (not too prominent)
   - Verify text is readable (not too small)
   - Verify display doesn't overlap with messages

### Automated Testing (Phase 2+)

Deferred to Phase 2. When implemented:
- Unit test: `ChatWidget` loads provider on mount
- Unit test: `ChatWidget` updates provider on session change
- Unit test: `ChatWidget` handles RPC failure gracefully
- E2E test: Visual regression test for display position

## Open Questions

1. **Q:** Should model/provider be displayed when no session is active?
   **A:** No — hide display when `activeSession === undefined` (cleaner UI).

2. **Q:** Should we display agent name (Oracle, Builder) in addition to model?
   **A:** Not in Phase 1. Agent display is a separate requirement (if needed).

3. **Q:** Should we use `getConfig()` or `getProvider()` as primary data source?
   **A:** Use `getProvider()` — it returns both provider name and model in one call.

4. **Q:** Should display be clickable (tooltip, copy, etc.)?
   **A:** Not in Phase 1. Read-only display only. Interactivity deferred to Phase 5.

## Related Requirements

- Phase 5 Task 5.3: Model Selection UI (full configuration interface)
- REQ-MODALITY-PLATFORM-V2: Chat widget requirements
- TECHSPEC-THEIA-OPENSPACE §4.3: Chat Widget architecture

## Revision History

| Date | Author | Changes |
|---|---|---|
| 2026-02-17 | analyst_7a3e | Initial draft |
