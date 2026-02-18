# SDK Type Extraction Guide

## Overview

This project uses TypeScript type definitions from the official `@opencode-ai/sdk` package to ensure type safety and API compatibility. Due to an ESM/CJS incompatibility (SDK is ESM-only, Theia requires CJS), we **extract SDK types into our codebase** rather than importing them directly at runtime.

**Hybrid Approach**: We use SDK types for compile-time checking, but maintain our own HTTP/SSE client implementation.

## Architecture

```
┌─────────────────────────────────────────┐
│ @opencode-ai/sdk (npm package)          │
│ - ESM-only                              │
│ - Type definitions: dist/gen/types.gen.d.ts │
└─────────────────────────────────────────┘
                 ▼ Extract (npm script)
┌─────────────────────────────────────────┐
│ opencode-sdk-types.ts (copied types)    │
│ - 3,380 lines of type definitions       │
│ - No runtime code                       │
└─────────────────────────────────────────┘
                 ▼ Import
┌─────────────────────────────────────────┐
│ opencode-protocol.ts (type bridge)      │
│ - Re-export SDK types with our names    │
│ - Add hybrid types (Message + parts)    │
│ - Add API response wrappers             │
└─────────────────────────────────────────┘
                 ▼ Use
┌─────────────────────────────────────────┐
│ Application code                        │
│ - session-service.ts                    │
│ - opencode-proxy.ts                     │
│ - opencode-sync-service.ts              │
└─────────────────────────────────────────┘
```

## Files

### 1. `opencode-sdk-types.ts` (Generated)
- **Location**: `extensions/openspace-core/src/common/opencode-sdk-types.ts`
- **Size**: ~3,380 lines
- **Content**: Extracted from `node_modules/@opencode-ai/sdk/dist/gen/types.gen.d.ts`
- **Purpose**: Source of truth for OpenCode API types
- **DO NOT EDIT MANUALLY**: Regenerate using `npm run extract-sdk-types`

### 2. `opencode-protocol.ts` (Type Bridge)
- **Location**: `extensions/openspace-core/src/common/opencode-protocol.ts`
- **Purpose**: 
  - Re-export SDK types with backward-compatible names
  - Add hybrid types (e.g., `Message` with optional `parts` field)
  - Add Theia RPC interfaces (`OpenCodeService`, `OpenCodeClient`)
  - Add SSE event types (`SessionNotification`, `MessageNotification`, etc.)

### 3. Application Code
- **session-service.ts**: Uses `Session`, `Message`, `MessagePartInput` types
- **opencode-proxy.ts**: HTTP client typed with SDK types
- **opencode-sync-service.ts**: SSE event handlers typed with SDK types

## Updating SDK Types

### When to Update
- SDK package version changes (currently `1.2.6`)
- API schema changes upstream
- New Part types added (e.g., new tool types)

### Update Process

1. **Update SDK version** in `package.json`:
   ```bash
   cd extensions/openspace-core
   yarn add --dev --exact @opencode-ai/sdk@1.2.7
   ```

2. **Extract types**:
   ```bash
   npm run extract-sdk-types
   ```

3. **Verify extraction**:
   - Check `opencode-sdk-types.ts` for changes
   - Review added/removed types
   - Update `opencode-protocol.ts` if new types need to be re-exported

4. **Run build**:
   ```bash
   yarn build:extensions
   ```

5. **Fix breaking changes** (if any):
   - Field renames (e.g., `projectId` → `projectID`)
   - Type structure changes
   - New required fields

6. **Run tests**:
   ```bash
   yarn test
   ```

## Key Type Mappings

### SDK → Our Aliases

| SDK Type | Our Alias | Notes |
|----------|-----------|-------|
| `SDKTypes.Session` | `Session` | Uses `projectID`, `time.created/updated` (numbers) |
| `SDKTypes.UserMessage \| SDKTypes.AssistantMessage` | `Message` | Hybrid: adds optional `parts` field |
| `SDKTypes.Part` | `MessagePart` | Union of 12+ part types |
| `SDKTypes.TextPartInput` | `MessagePartInput` | For creating new messages (no IDs) |
| `SDKTypes.Provider` | `Provider` | Provider metadata |
| `SDKTypes.Model` | (via ProviderWithModels) | Model metadata |

### Field Name Changes (Old → New)

| Old Field | New Field | Type Change |
|-----------|-----------|-------------|
| `projectId` | `projectID` | - |
| `sessionId` | `sessionID` | - |
| `createdAt` | `time.created` | `string` → `number` (ms timestamp) |
| `updatedAt` | `time.updated` | `string` → `number` (ms timestamp) |
| `message.parts` | Separate management | SDK separates parts from messages |

### Part Types (SDK has 12+)

**Input types** (for creating messages):
- `TextPartInput` - Plain text
- `FilePartInput` - File reference

**Full types** (with IDs, from server):
- `TextPart` - Plain text with metadata
- `FilePart` - File reference with metadata
- `ToolPart` - Tool invocation
- `AgentPart` - Agent mention
- `StepStartPart` - Step beginning
- `StepFinishPart` - Step completion
- `SnapshotPart` - State snapshot
- `PatchPart` - Code diff
- `ReasoningPart` - Chain-of-thought
- `RetryPart` - Retry marker
- `CompactionPart` - Compaction marker
- `SubtaskPart` - Subtask reference

## Hybrid Types

### Message Type
SDK separates `UserMessage` and `AssistantMessage`, and parts are managed separately. Our architecture expects `parts` inline:

```typescript
// SDK types (separate)
type UserMessage = {
  id: string;
  sessionID: string;
  role: "user";
  time: { created: number };
  agent: string;
  model: { providerID: string; modelID: string };
  // No parts field!
};

// Our hybrid type
type Message = (SDKTypes.UserMessage | SDKTypes.AssistantMessage) & {
  readonly parts?: MessagePart[];  // Added for convenience
};
```

### MessageWithParts
API responses return `{ info: Message, parts: Part[] }`. We wrap this:

```typescript
interface MessageWithParts {
  readonly info: Message;
  readonly parts: MessagePart[];
}
```

## Common Issues

### Issue: Type mismatch when creating messages
**Problem**: `MessagePart` types require IDs, but we're creating new messages without IDs.

**Solution**: Use `MessagePartInput` types instead:
```typescript
// ❌ Wrong
const parts: MessagePart[] = [{ type: 'text', text: 'foo' }];

// ✅ Correct
const parts: MessagePartInput[] = [{ type: 'text', text: 'foo' }];
```

### Issue: Field name errors (`projectId` vs `projectID`)
**Problem**: Accessing old field names that were renamed in SDK.

**Solution**: Use SDK field names:
```typescript
// ❌ Wrong
session.projectId

// ✅ Correct
session.projectID
```

### Issue: Date/time type mismatches
**Problem**: SDK uses number timestamps, we used ISO strings.

**Solution**: Convert timestamps:
```typescript
// ❌ Wrong
const date = new Date(session.createdAt);

// ✅ Correct
const date = new Date(session.time.created);  // Already a number (ms)
```

## Testing

### Unit Tests
Test files use SDK types via `opencode-protocol.ts`. Update mock data to match SDK structure:

```typescript
// Mock session (SDK format)
const mockSession = {
  id: 'sess-1',
  projectID: 'proj-1',  // Not projectId
  title: 'Test Session',
  time: {
    created: Date.now(),  // Number, not string
    updated: Date.now()
  },
  directory: '/test',
  version: 1,
  agent: 'test-agent',
  model: { providerID: 'test', modelID: 'test-model' }
};
```

### E2E Tests
E2E tests use real OpenCode API responses, which are already SDK-compliant.

## Migration History

- **Phase 2A** (Dec 2024): Hand-written types (~263 lines) in `opencode-protocol.ts`
- **Phase 2B.1** (Jan 2025): Extract SDK types to `opencode-sdk-types.ts`
- **Phase 2B.2** (Jan 2025): Create type bridge with SDK aliases
- **Phase 2B.3** (Jan 2025): Update all consumers to SDK field names
- **Phase 2B.4** (Jan 2025): Remove hand-written types, reduce `opencode-protocol.ts` from 306 → 279 lines

## Future Improvements

1. **Full SDK adoption**: Once Theia supports ESM, remove type extraction and import SDK directly
2. **Runtime client**: Consider using SDK's HTTP client if/when CJS support is added
3. **Automatic sync**: Set up CI check to detect SDK type drift
4. **Type guards**: Add runtime type guards for SDK Part union types

## References

- SDK Repository: https://github.com/opencode-ai/sdk
- SDK Documentation: https://docs.opencode.ai/sdk
- API Documentation: https://docs.opencode.ai/api
- Phase 2B Contract: `.opencode/context/active_tasks/phase-2b-sdk-adoption/contract.md`
