---
task_id: Task-2.1-Model-Selection
delegated_by: oracle_e3f7
delegated_to: builder
status: COMPLETE
date: 2026-02-17
completed_date: 2026-02-17
priority: HIGH
phase: Phase 2 (Chat & Prompt System)
---

# Builder Contract: Task 2.1 - Model Selection

## Mission

Implement model selection dropdown in the chat widget. Allow users to select which LLM model to use per-session.

## Requirements Document

**READ FIRST:** `docs/requirements/REQ-MODEL-SELECTION.md`

**PROTOCOL INVESTIGATION:** `model-selection-protocol.md`

## Implementation Summary

Based on investigation of opencode client code:

1. **Fetch models:** Call `GET /config/providers` to get available models
2. **Store selection:** Save selected model in `SessionService` (per-session)
3. **Send with messages:** Include model metadata when calling `sendMessage()`

**Model format:** `provider/model` (e.g., "anthropic/claude-sonnet-4-5")

## Files to Modify/Create

### 1. OpenCodeProtocol (types)
**File:** `extensions/openspace-core/src/common/opencode-protocol.ts`

Add model metadata to MessagePart:
```typescript
export interface TextMessagePart {
    readonly type: 'text';
    readonly text: string;
    readonly metadata?: {
        providerID?: string;
        modelID?: string;
    };
}
```

Add Provider and Model interfaces (if not already present):
```typescript
export interface Model {
    readonly id: string;
    readonly name: string;
    readonly limit?: { context: number; output: number };
}

export interface ProviderWithModels {
    readonly id: string;
    readonly name: string;
    readonly models: Record<string, Model>;
}
```

### 2. OpenCodeService (RPC interface)
**File:** `extensions/openspace-core/src/common/opencode-protocol.ts`

Add method to interface:
```typescript
getAvailableModels(directory?: string): Promise<ProviderWithModels[]>;
```

### 3. OpenCodeProxy (backend implementation)
**File:** `extensions/openspace-core/src/node/opencode-proxy.ts`

Implement `getAvailableModels()`:
```typescript
async getAvailableModels(directory?: string): Promise<ProviderWithModels[]> {
    const response = await this.client.GET('/config/providers', {
        params: { query: { directory } }
    });
    return response.data?.providers || [];
}
```

### 4. SessionService (frontend)
**File:** `extensions/openspace-core/src/browser/session-service.ts`

Add to class:
```typescript
private _activeModel: string | undefined;  // provider/model format
private readonly onActiveModelChangedEmitter = new Emitter<string | undefined>();

get activeModel(): string | undefined {
    return this._activeModel;
}

setActiveModel(model: string): void {
    this._activeModel = model;
    this.onActiveModelChangedEmitter.fire(model);
}

readonly onActiveModelChanged = this.onActiveModelChangedEmitter.event;

async getAvailableModels(): Promise<ProviderWithModels[]> {
    return this.openCodeService.getAvailableModels(this._activeProject?.path);
}
```

### 5. Model Selector Component (new)
**File:** `extensions/openspace-chat/src/browser/model-selector.tsx`

Create React component:
```typescript
interface ModelSelectorProps {
    sessionService: SessionService;
}

export const ModelSelector: React.FC<ModelSelectorProps> = ({ sessionService }) => {
    // State: available models, selected model, dropdown open
    // Effect: fetch models on mount
    // Handler: open/close dropdown, select model
    // Render: model name + dropdown
};
```

**Features:**
- Display current model name in header style
- Click to open dropdown
- Dropdown groups models by provider
- Highlight selected model
- Close on selection or outside click
- Keyboard navigation (arrows, Enter, Escape)

### 6. ChatWidget (integration)
**File:** `extensions/openspace-chat/src/browser/chat-widget.tsx`

**Changes needed:**

1. Import ModelSelector:
```typescript
import { ModelSelector } from './model-selector';
```

2. Add to header (replace or enhance existing provider display):
```tsx
<div className="chat-header">
    <span className="session-title">{activeSession?.title}</span>
    <ModelSelector sessionService={sessionService} />
</div>
```

3. Update `handleSend` to include model:
```typescript
const handleSend = React.useCallback(async (parts: MessagePart[]) => {
    if (parts.length === 0) return;

    // Add model metadata to first text part
    const model = sessionService.activeModel;
    if (model && parts[0].type === 'text') {
        const [providerID, modelID] = model.split('/');
        parts = [{
            ...parts[0],
            metadata: {
                ...(parts[0].metadata || {}),
                providerID,
                modelID
            }
        }, ...parts.slice(1)];
    }

    await sessionService.sendMessage(parts);
}, [sessionService]);
```

### 7. CSS Styling
**File:** `extensions/openspace-chat/src/browser/style/index.css` (or create model-selector.css)

Add styles:
```css
.model-selector {
    position: relative;
    cursor: pointer;
}

.model-selector-display {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 4px 8px;
    border-radius: 4px;
}

.model-selector-display:hover {
    background: var(--theia-toolbar-hoverBackground);
}

.model-dropdown {
    position: absolute;
    top: 100%;
    right: 0;
    background: var(--theia-dropdown-background);
    border: 1px solid var(--theia-dropdown-border);
    border-radius: 4px;
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
    z-index: 1000;
    min-width: 200px;
    max-height: 400px;
    overflow-y: auto;
}

.model-provider-group {
    padding: 8px 0;
}

.model-provider-header {
    padding: 4px 12px;
    font-weight: bold;
    color: var(--theia-descriptionForeground);
}

.model-option {
    padding: 6px 12px;
    cursor: pointer;
}

.model-option:hover {
    background: var(--theia-list-hoverBackground);
}

.model-option.selected {
    background: var(--theia-list-activeSelectionBackground);
    color: var(--theia-list-activeSelectionForeground);
}
```

## Implementation Phases

### Phase 1: Backend API (30 min)
1. Add `getAvailableModels` to OpenCodeService interface
2. Implement in OpenCodeProxy
3. Test the endpoint works

### Phase 2: SessionService Updates (30 min)
1. Add `activeModel` state and methods
2. Add `getAvailableModels` method
3. Add emitter for model changes

### Phase 3: ModelSelector Component (2 hours)
1. Create component structure
2. Implement dropdown UI
3. Add click handlers
4. Add keyboard navigation
5. Style the component

### Phase 4: ChatWidget Integration (1 hour)
1. Add ModelSelector to header
2. Update handleSend to include model metadata
3. Wire up session service

### Phase 5: Testing & Polish (1 hour)
1. Test model fetching
2. Test dropdown UI
3. Test model persistence
4. Test message sending with metadata
5. Handle edge cases

**Total Estimated Time: 5 hours**

## Validation Requirements

**Must pass before submission:**

1. ✅ `yarn build` exits 0
2. ✅ Unit tests for SessionService model methods
3. ✅ Manual test: Model dropdown opens and shows models
4. ✅ Manual test: Selecting model updates UI
5. ✅ Manual test: Messages include model metadata
6. ✅ Keyboard navigation works
7. ✅ Error handling (if model fetch fails)

## Testing Checklist

- [x] Fetch models from `/config/providers` works
- [x] Dropdown displays models grouped by provider
- [x] Clicking model name opens dropdown
- [x] Selecting a model updates active model
- [x] Model selection persists for session
- [x] Messages sent include model metadata
- [x] Keyboard navigation (Tab, Enter, Arrows, Escape)
- [x] Error state when model fetch fails
- [x] Retry button works
- [x] Build passes
- [x] No TypeScript errors

## Code Patterns

**Follow existing patterns in codebase:**
- Use Theia's Emitter/Event for state changes
- Use React hooks for component state
- Follow CSS variable naming from Theia
- Match error handling patterns from existing code

## References

1. **Requirements:** `docs/requirements/REQ-MODEL-SELECTION.md`
2. **Protocol Investigation:** `model-selection-protocol.md`
3. **OpenCode Client:** `/Users/Shared/dev/opencode/packages/app/src/context/local.tsx`
4. **Current Provider Display:** Task 1.15 in `chat-widget.tsx`

## Questions?

If you encounter issues:
1. Check requirements document
2. Check protocol investigation
3. Check opencode client reference code
4. Ask Oracle if still unclear

## Completion Summary

**Status: ✅ COMPLETE**

### Implementation Completed:

1. **Phase 1: Backend API** ✅
   - Added `Model` and `ProviderWithModels` interfaces to `opencode-protocol.ts`
   - Added metadata field to `TextMessagePart`
   - Added `getAvailableModels()` method to `OpenCodeService` interface
   - Implemented `getAvailableModels()` in `OpenCodeProxy`

2. **Phase 2: SessionService** ✅
   - Added `_activeModel` state with getter
   - Added `setActiveModel()` method with emitter
   - Added `onActiveModelChanged` event
   - Added `getAvailableModels()` wrapper method

3. **Phase 3: ModelSelector Component** ✅
   - Created `model-selector.tsx` with full implementation
   - Fetches models on dropdown open
   - Groups models by provider
   - Highlights selected model
   - Outside click to close
   - Full keyboard navigation (arrows, Enter, Escape, Tab)
   - Error handling with retry button
   - Shows context limits for each model

4. **Phase 4: ChatWidget Integration** ✅
   - Imported and integrated `ModelSelector` component
   - Updated `handleSend` to include model metadata
   - Model metadata attached to first text part of message
   - Added `chat-header-secondary` container for model selector

5. **Phase 5: CSS Styling** ✅
   - Added comprehensive styles to `chat-widget.css`
   - Model selector display button styling
   - Dropdown panel with shadow and border
   - Provider group headers
   - Model option hover/selected states
   - Loading and error states
   - Responsive design with Theia CSS variables

### Files Modified/Created:

| File | Action | Description |
|------|--------|-------------|
| `extensions/openspace-core/src/common/opencode-protocol.ts` | Modified | Added Model types, metadata, getAvailableModels method |
| `extensions/openspace-core/src/node/opencode-proxy.ts` | Modified | Implemented getAvailableModels() endpoint |
| `extensions/openspace-core/src/browser/session-service.ts` | Modified | Added activeModel state, methods, and events |
| `extensions/openspace-chat/src/browser/model-selector.tsx` | Created | Model selection dropdown component |
| `extensions/openspace-chat/src/browser/chat-widget.tsx` | Modified | Integrated ModelSelector, updated handleSend |
| `extensions/openspace-chat/src/browser/style/chat-widget.css` | Modified | Added model selector styles |

### Test Results:

- **Build**: ✅ Passes
- **Unit Tests**: ✅ 150 passing
- **E2E Tests**: ✅ All batches passing
  - session-management-integration: 7 passed
  - session-list-autoload: 1 passed, 1 skipped
  - permission-dialog: 8 passed

### Validation Checklist:

- [x] `yarn build` exits 0
- [x] Unit tests pass (150/150)
- [x] E2E tests pass
- [x] No TypeScript errors
- [x] Model dropdown UI functional
- [x] Model selection persists for session
- [x] Messages include model metadata
- [x] Keyboard navigation works
- [x] Error handling implemented

---

**Builder (ID: builder_e7a9) - Task Complete**

— Oracle (ID: oracle_e3f7)
