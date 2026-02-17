# OpenCode Model Selection Protocol Investigation

## Executive Summary

OpenCode clients handle model selection through a **hybrid approach**:
1. **Model list fetching** is done via HTTP API to the local OpenCode server
2. **Session-level model selection** is handled through the ACP (Agent Client Protocol) for TUI/Desktop clients
3. **Per-request model selection** is done by passing model parameters to the session message API

**Key Finding:** There is **no global API endpoint** to change the model for a session. Model selection happens at different layers:
- ACP clients use `unstable_setSessionModel` RPC call
- Web UI manages model state locally and passes it per-request
- TUI uses command-line flags or local state

---

## 1. How Clients Get Available Models

### API Endpoint
**`GET /config/providers`** - Returns all configured AI providers and their models

### SDK Method
```typescript
// From @opencode-ai/sdk/v2
sdk.config.providers({ directory?: string })
```

### Response Structure
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
      // ... more metadata
    }>
  }>,
  default: Record<string, string>  // provider -> default model mapping
}
```

### Alternative Endpoint for All Providers
**`GET /provider`** - Returns all available providers (including unconfigured)

```typescript
{
  all: Array<Provider>,
  default: Record<string, string>,
  connected: Array<string>  // List of connected provider IDs
}
```

### Model Discovery Source
Models are fetched from **models.dev** (or `OPENCODE_MODELS_URL` env var):
```
https://models.dev/api.json
```

The server caches this and periodically refreshes (every 60 minutes).

---

## 2. How Model Selection Works

### ACP Protocol (TUI/Desktop Clients)

For clients using the Agent Client Protocol (like TUI), model selection is done via:

**Method:** `unstable_setSessionModel`
**Type:** `SetSessionModelRequest`

```typescript
// From @agentclientprotocol/sdk
interface SetSessionModelRequest {
  sessionId: string
  modelId: string  // Format: "provider/model" e.g., "anthropic/claude-sonnet-4-5"
}

// Response includes available variants
interface SetSessionModelResponse {
  _meta: {
    model: { providerID: string, modelID: string }
    variant?: string
    availableVariants: string[]
  }
}
```

**Implementation in OpenCode:**
```typescript
// packages/opencode/src/acp/agent.ts
async unstable_setSessionModel(params: SetSessionModelRequest) {
  const session = this.sessionManager.get(params.sessionId)
  const providers = await this.sdk.config.providers({ directory: session.cwd })
  
  const selection = parseModelSelection(params.modelId, providers)
  this.sessionManager.setModel(session.id, selection.model)
  this.sessionManager.setVariant(session.id, selection.variant)
  
  return { _meta: buildVariantMeta({ ... }) }
}
```

**Key Point:** The model is stored in the ACP session manager's in-memory state, NOT persisted to the server session.

---

### Web UI (Browser Client)

The Web UI handles model selection **locally** in the browser:

```typescript
// packages/app/src/context/local.tsx
const model = {
  // Get current model (computed from multiple sources)
  current: createMemo(() => {
    const a = agent.current()
    if (!a) return undefined
    const key = getFirstValidModel(
      () => ephemeral.model[a.name],      // 1. Ephemeral (per-agent selection)
      () => a.model,                       // 2. Agent's configured model
      fallbackModel                       // 3. Configured default or first available
    )
    return models.find(key)
  }),
  
  // Set model for current agent
  set(model: ModelKey | undefined, options?: { recent?: boolean }) {
    const currentAgent = agent.current()
    const next = model ?? fallbackModel()
    if (currentAgent) setEphemeral("model", currentAgent.name, next)
    if (options?.recent && model) models.recent.push(model)
  }
}
```

**Model Resolution Priority:**
1. **Ephemeral state** - Per-agent selection (stored in memory)
2. **Agent configuration** - Model specified in agent config
3. **User config** - `opencode.json` `model` field
4. **Recent models** - Recently used models
5. **Provider defaults** - First model from first connected provider

---

### Sending Messages with Model

When sending a message, the selected model is passed to the server:

```typescript
// packages/app/src/components/prompt-input/submit.ts
const currentModel = local.model.current()
const currentAgent = local.agent.current()

// Build request parts with model info
const parts = buildRequestParts({
  prompt: currentPrompt,
  images,
  comments,
  agent: currentAgent,
  model: currentModel,  // { providerID, modelID }
  mode,
})

// Send to session
await client.session.message({
  sessionID: session.id,
  parts,
  // Model is included in parts metadata
})
```

---

## 3. Session Creation and Model

### Creating a Session

Sessions are created via:

**`POST /session`**

```typescript
sdk.session.create({
  directory?: string
  parentID?: string      // For forking
  title?: string
  permission?: PermissionRuleset
})
```

**Note:** No model parameter is passed during session creation. Model selection happens per-message or via ACP protocol.

### Session Initialization

For ACP clients, during session initialization:

```typescript
async newSession(params: NewSessionRequest) {
  const model = await defaultModel(this.config, directory)
  
  // Create OpenCode session
  const state = await this.sessionManager.create(params.cwd, params.mcpServers, model)
  
  return {
    sessionId: state.id,
    models: {              // Available models returned to client
      availableModels: [...],
      currentModelId: `${model.providerID}/${model.modelID}`
    },
    modes: { ... },
    _meta: { ... }
  }
}
```

---

## 4. Configuration and Defaults

### Configuration File

Model configuration is stored in `opencode.json`:

```json
{
  "model": "anthropic/claude-sonnet-4-5",
  "small_model": "openai/gpt-4o-mini",
  "disabled_providers": ["groq"],
  "enabled_providers": ["anthropic", "openai"],
  "provider": {
    "anthropic": {
      "options": {
        "apiKey": "..."
      }
    }
  },
  "agent": {
    "build": {
      "model": "anthropic/claude-sonnet-4-5"
    }
  }
}
```

### Getting Default Model

```typescript
// packages/opencode/src/acp/agent.ts
async function defaultModel(config: ACPConfig, directory: string) {
  // 1. Use config from ACP config (passed at initialization)
  if (config.defaultModel) return config.defaultModel
  
  // 2. Fetch from server config
  const opencodeConfig = await Config.get()
  if (opencodeConfig.model) {
    const [providerID, modelID] = opencodeConfig.model.split("/")
    return { providerID, modelID }
  }
  
  // 3. Fall back to first available provider's first model
  const providers = await Provider.list()
  const firstProvider = Object.values(providers)[0]
  const firstModel = Object.values(firstProvider.models)[0]
  return { providerID: firstProvider.id, modelID: firstModel.id }
}
```

---

## 5. Complete API Flow Examples

### Flow 1: Web UI Model Selection

```typescript
// 1. Fetch available models
const { data } = await sdk.config.providers({ directory })
const providers = data?.providers || []

// 2. User selects model from UI
// 3. Store in local state
local.model.set({ providerID: "anthropic", modelID: "claude-sonnet-4-5" }, { recent: true })

// 4. When sending message, model is included
await sdk.session.message({
  sessionID: "session-id",
  parts: [{
    type: "text",
    text: "Hello",
    metadata: {
      providerID: "anthropic",
      modelID: "claude-sonnet-4-5",
      agent: "build"
    }
  }]
})
```

### Flow 2: ACP Client (TUI) Model Selection

```typescript
// 1. Client initializes ACP connection
const agent = await ACP.init({ sdk })

// 2. Create session (returns available models)
const session = await agent.newSession({ cwd, mcpServers })
console.log(session.models.availableModels)  // List of available models
console.log(session.models.currentModelId)   // Current model ID

// 3. Change model for session
await agent.unstable_setSessionModel({
  sessionId: session.sessionId,
  modelId: "openai/gpt-4o"
})

// 4. Send prompt (uses session's stored model)
await agent.prompt({
  sessionId: session.sessionId,
  prompt: [{ type: "text", text: "Hello" }]
})
```

---

## 6. Key Files Summary

| File | Purpose |
|------|---------|
| `packages/opencode/src/acp/agent.ts` | ACP protocol implementation, `unstable_setSessionModel` |
| `packages/opencode/src/acp/session.ts` | Session manager with `setModel()` method |
| `packages/opencode/src/acp/types.ts` | `ACPSessionState` with model field |
| `packages/opencode/src/server/routes/config.ts` | `/config/providers` endpoint |
| `packages/opencode/src/server/routes/provider.ts` | `/provider` endpoint |
| `packages/opencode/src/provider/models.ts` | Models.dev fetching and caching |
| `packages/opencode/src/provider/provider.ts` | Provider listing and model resolution |
| `packages/app/src/context/local.tsx` | Web UI local model state management |
| `packages/app/src/components/dialog-select-model.tsx` | Model selection UI component |
| `packages/sdk/js/src/v2/gen/sdk.gen.ts` | SDK client with session/config methods |

---

## 7. Protocol Documentation

### Model ID Format
Models are identified as: `provider/model`
- Examples: `anthropic/claude-sonnet-4-5`, `openai/gpt-4o`, `opencode/opencode-chat-v1`

### Endpoints Summary

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/config/providers` | Get configured providers and models |
| GET | `/provider` | Get all available providers |
| POST | `/session` | Create new session |
| PATCH | `/session/{id}` | Update session metadata (title only) |
| POST | `/session/{id}/message` | Send message with model metadata |

### ACP Protocol Methods

| Method | Request | Response |
|--------|---------|----------|
| `initialize` | InitializeRequest | InitializeResponse |
| `newSession` | NewSessionRequest | NewSessionResponse |
| `loadSession` | LoadSessionRequest | LoadSessionResponse |
| `unstable_setSessionModel` | SetSessionModelRequest | SetSessionModelResponse |
| `prompt` | PromptRequest | PromptResponse |

---

## Conclusion

**Per-Session Model Selection:** YES - Models are selected per-session for ACP clients

**API for Model Change:** 
- ACP: `unstable_setSessionModel` RPC method
- Web UI: Local state only, passed per-request

**Global vs Per-Session:** 
- Configuration (opencode.json) is global
- ACP session model is per-session in-memory state
- Web UI model selection is per-session in browser state

**Key Takeaway:** The model selection is **not persisted** to the server session object. It's either:
1. Stored in ACP session manager memory (TUI/Desktop)
2. Stored in browser local state (Web UI)
3. Passed with each message request
