# Contract: Task 1.1 — Define Common RPC Protocols

## Contract ID
`contract-1.1-rpc-protocols`

## Task
**WORKPLAN.md Task 1.1** — Define common RPC protocols

## Source of Truth
- WORKPLAN.md §1.1
- TECHSPEC-THEIA-OPENSPACE.md §3.1.1 (RPC Protocol)
- Analyst requirements document (ses_398fff2c7ffeYJm1ewi8sjvkDd)

## Deliverables

Create **4 TypeScript interface files** in `extensions/openspace-core/src/common/`:

### 1. `opencode-protocol.ts`
Core types matching opencode REST API + RPC interfaces.

**Must include:**
- `Project` interface (id, name, path)
- `Session` interface (id, projectId, title, createdAt, updatedAt, directory, parentID)
- `Message` interface (id, sessionId, role, parts, metadata)
- `MessagePart` discriminated union (text, tool_use, tool_result, file, image)
- `MessageWithParts` interface
- `FileStatus` interface (path, status)
- `FileContent` interface (type, content)
- `Provider` interface
- `Agent` interface
- `AppConfig` interface
- `openCodeServicePath` constant (`'/services/opencode'`)
- `OpenCodeService` Symbol
- `OpenCodeClient` Symbol
- `OpenCodeService` interface with all RPC methods
- `OpenCodeClient` interface with callback methods

### 2. `session-protocol.ts`
Session management event types for SSE forwarding.

**Must include:**
- `SessionEventType` union type
- `SessionEvent` interface
- `MessageEventType` union type
- `MessageEvent` interface
- `FileEventType` union type
- `FileEvent` interface
- `PermissionEventType` / `PermissionEvent` interfaces
- `AgentCommand` interface

### 3. `command-manifest.ts`
Manifest types for Hub command caching.

**Must include:**
- `CommandManifest` interface
- `CommandDefinition` interface
- `CommandArgumentSchema` interface
- `ArgumentProperty` interface
- `CommandResult` interface
- `AgentCommandRequest` interface
- `HubState` interface

### 4. `pane-protocol.ts`
Pane info types for PaneService.

**Must include:**
- `PaneService` Symbol
- `OpenContentRequest` interface
- `PaneLayout` interface
- `PaneInfo` interface
- `PaneGeometry` interface
- `TabInfo` interface
- `ContentInfo` interface
- `StreamingUpdate` interface
- `PaneService` interface (methods + events)

## Constraints

1. **Type-only** — No implementation code, only interfaces, types, constants, and Symbol declarations
2. **Compile cleanly** — Must pass `yarn build` without type errors
3. **Use Theia imports** — Import `Event` from `@theia/core/lib/common/event`, `RpcServer` from `@theia/core/lib/common/messaging/proxy-factory`
4. **Match opencode API** — Types must correspond to REST endpoints in `/Users/Shared/dev/opencode/specs/project.md`
5. **No external HTTP calls** — These are pure type definitions

## Validation

After implementation, run:
```bash
yarn build
```

Must exit 0 with no TypeScript errors.

## Notes

- Pre-existing LSP errors in Theia's `node_modules` (decorator signatures, type mismatches) are NOT caused by these changes — ignore them
- The `extensions/openspace-core/src/common/` directory exists and is empty — create files there directly
