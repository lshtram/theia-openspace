---
id: REQ-MODEL-SELECTION
title: Model Selection (Task 2.1)
author: oracle_e3f7
status: READY
date: 2026-02-17
task_id: Task-2.1
phase: Phase 2 (Chat & Prompt System)
priority: HIGH
---

# Requirements: Model Selection

## 1. Introduction

### 1.1 Background

Currently, Theia Openspace displays the active model read-only (Task 1.15) but provides no way to change it. Users are stuck with the default or last-used model from the opencode server. This is a critical blocker for production use.

### 1.2 Solution Approach

Investigation of opencode client code revealed that **model selection is per-message**, not global. The protocol is:

1. **Fetch models:** `GET /config/providers` returns available providers and models
2. **Store selection:** Model is stored per-session in client state (SessionService)
3. **Send with messages:** Model metadata is included in each message's parts metadata

### 1.3 Goals

1. User can view and change the active model per-session
2. Model selection persists for the session lifetime
3. All messages use the selected model
4. UI is intuitive and matches opencode client patterns

## 2. User Stories

### US-1: View Current Model
**As a** developer  
**I want to** see which model is currently active for my session  
**So that** I know which AI is responding to my queries

**Acceptance:**
- Model name displayed in chat header (e.g., "🤖 Claude Sonnet 4.5")
- Provider name shown alongside model
- Updates when model is changed

### US-2: Change Model via Dropdown
**As a** developer  
**I want to** click the model name to open a dropdown  
**So that** I can switch to a different model

**Acceptance:**
- Clicking model name opens dropdown
- Dropdown shows all available models from `/config/providers`
- Models grouped by provider
- Selected model highlighted
- Clicking a model selects it and closes dropdown

### US-3: Model Persists Per Session
**As a** developer  
**I want to** have different models for different sessions  
**So that** I can use appropriate models for different tasks

**Acceptance:**
- Model selection is per-session
- Switching sessions shows that session's model
- New sessions use a default model (configurable)

## 3. Functional Requirements

### FR-1: Fetch Available Models
**ID:** FR-1  
**Description:** System must fetch available models from opencode server

**Requirements:**
- Call `GET /config/providers` endpoint
- Parse response to extract provider and model list
- Cache results with 5-minute TTL
- Handle errors gracefully (show "Unable to load models")

**API Response Format:**
```typescript
{
  providers: Array<{
    id: string              // e.g., "anthropic", "openai"
    name: string            // Display name
    models: Record<string, {
      id: string
      name: string
      cost?: { input: number, output: number }
      limit: { context: number, output: number }
    }>
  }>,
  default: Record<string, string>  // provider -> default model mapping
}
```

### FR-2: Per-Session Model Storage
**ID:** FR-2  
**Description:** Store selected model per session

**Requirements:**
- Add `activeModel` field to SessionService state
- Model format: `provider/model` (e.g., "anthropic/claude-sonnet-4-5")
- Default to first available model if none selected
- Persist in memory only (not localStorage - server is source of truth)

### FR-3: Model Metadata in Messages
**ID:** FR-3  
**Description:** Include model metadata when sending messages

**Requirements:**
- When calling `sessionService.sendMessage()`, include model in metadata
- Format: `{ providerID: string, modelID: string }`
- Model metadata attached to first text part of message

**Example:**
```typescript
const parts: MessagePart[] = [{
  type: 'text',
  text: 'Hello AI',
  metadata: {
    providerID: 'anthropic',
    modelID: 'claude-sonnet-4-5'
  }
}];
```

### FR-4: Model Selection UI
**ID:** FR-4  
**Description:** Dropdown UI for model selection

**Requirements:**
- Display current model in chat header (already done in Task 1.15)
- Make model name clickable
- Open dropdown on click
- Dropdown positioned below model name
- Show provider name as group header
- Show model name and context limit
- Highlight currently selected model
- Close dropdown on selection or outside click

### FR-5: Model Change Updates
**ID:** FR-5  
**Description:** Update session when model changes

**Requirements:**
- Update `SessionService.activeModel` when user selects new model
- Update UI immediately (optimistic)
- Next message uses new model
- No server call needed (model is per-message, not stored server-side)

## 4. Non-Functional Requirements

### NFR-1: Performance
- Model list fetch: < 500ms
- Dropdown open: < 100ms
- No UI blocking during fetch

### NFR-2: Error Handling
- If `/config/providers` fails, show "Models unavailable" in dropdown
- Allow retry via button
- Don't block chat if model fetch fails (use default)

### NFR-3: Accessibility
- Dropdown keyboard navigable (arrow keys, Enter, Escape)
- Screen reader announces model selection
- ARIA labels for dropdown

## 5. Acceptance Criteria

### AC-1: Model Display
- Current model visible in chat header
- Format: "🤖 {Provider} {Model}" (e.g., "🤖 Anthropic Claude Sonnet 4.5")

### AC-2: Model Dropdown
- Clicking model name opens dropdown
- Dropdown shows all available models
- Models grouped by provider

### AC-3: Model Selection
- Clicking a model selects it
- Dropdown closes on selection
- UI updates immediately

### AC-4: Per-Session Storage
- Model selection is per-session
- Switching sessions shows correct model for each

### AC-5: Message Metadata
- Messages include model metadata
- Verified by checking network requests or server logs

### AC-6: Error Handling
- Graceful handling if model fetch fails
- User can retry
- Chat remains functional

### AC-7: Keyboard Navigation
- Tab to focus model selector
- Enter to open dropdown
- Arrow keys to navigate
- Enter to select
- Escape to close

## 6. API Reference

### GET /config/providers
Returns configured providers and their models.

**Request:**
```
GET /config/providers?directory=/path/to/project
```

**Response:**
```json
{
  "providers": [
    {
      "id": "anthropic",
      "name": "Anthropic",
      "models": {
        "claude-sonnet-4-5": {
          "id": "claude-sonnet-4-5",
          "name": "Claude Sonnet 4.5",
          "limit": { "context": 200000, "output": 8192 }
        }
      }
    }
  ],
  "default": { "anthropic": "claude-sonnet-4-5" }
}
```

### POST /session/{id}/message
Send message with model metadata.

**Request Body:**
```json
{
  "parts": [
    {
      "type": "text",
      "text": "Hello",
      "metadata": {
        "providerID": "anthropic",
        "modelID": "claude-sonnet-4-5"
      }
    }
  ]
}
```

## 7. UI Design

### Header Display
```
┌─────────────────────────────────────────────────────────────┐
│ Session Title                      🤖 Anthropic Claude... ▼ │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  [Chat messages...]                                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Dropdown Open
```
┌─────────────────────────────────────────────────────────────┐
│ Session Title                      🤖 Anthropic Claude... ▼ │
├─────────────────────────────────────────────────────────────┤
│ ┌───────────────────────────┐                               │
│ │ Anthropic                 │                               │
│ │ ● Claude Sonnet 4.5       │                               │
│ │   Claude Opus 4           │                               │
│ │   Claude Haiku 3.5        │                               │
│ │ OpenAI                    │                               │
│ │   GPT-4o                  │                               │
│ │   GPT-4o-mini             │                               │
│ └───────────────────────────┘                               │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

## 8. Implementation Notes

### SessionService Changes
Add to `SessionService`:
```typescript
private _activeModel: string | undefined;  // provider/model format

get activeModel(): string | undefined {
  return this._activeModel;
}

setActiveModel(model: string): void {
  this._activeModel = model;
  this.onActiveModelChangedEmitter.fire(model);
}

readonly onActiveModelChanged: Event<string | undefined>;
```

### OpenCodeProxy Changes
Add method:
```typescript
async getAvailableModels(directory?: string): Promise<Provider[]> {
  const response = await this.client.GET('/config/providers', {
    params: { query: { directory } }
  });
  return response.data?.providers || [];
}
```

### ChatWidget Changes
- Add model selector component
- Connect to SessionService.activeModel
- Include model in sendMessage calls

## 9. Out of Scope

- Global default model configuration (Phase 5)
- Model cost display (future enhancement)
- Model-specific settings (temperature, etc.)
- Favorite/recent models (can be added later)

## 10. References

- Investigation: `model-selection-protocol.md` (391 lines)
- OpenCode client code: `/Users/Shared/dev/opencode/packages/app/src/context/local.tsx`
- OpenCode SDK: `/Users/Shared/dev/opencode/packages/sdk/js/src/v2/gen/sdk.gen.ts`
- Current provider display: Task 1.15 implementation in `chat-widget.tsx`

## 11. Success Criteria

Task 2.1 is **COMPLETE** when:

1. ✅ AC-1 through AC-7 all pass
2. ✅ User can change model via dropdown
3. ✅ Model selection is per-session
4. ✅ Messages include model metadata
5. ✅ Build passes with zero errors
6. ✅ Unit tests for SessionService model methods
7. ✅ CodeReviewer approves (80%+ confidence)
