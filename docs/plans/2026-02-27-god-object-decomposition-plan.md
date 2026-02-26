# God Object Decomposition — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Decompose 7 god-object files into ~30 focused modules, each under 400 lines, improving modularity and maintainability.

**Architecture:** Sub-directory per god object. Original file becomes thin facade. No barrel files. Direct imports. Backend uses `@injectable()` services; frontend uses custom hooks and sub-components. See `docs/plans/2026-02-27-god-object-decomposition-design.md` for full design.

**Tech Stack:** TypeScript, Inversify DI, React (via `@theia/core/shared/react`), Zod, Express, MCP SDK

**Worktree:** `.worktrees/god-object-decomposition/` (branch: `refactor/god-object-decomposition`)

**Build command:** `yarn --cwd .worktrees/god-object-decomposition/browser-app webpack --config webpack.config.js --mode development`

**Test command:** `yarn --cwd .worktrees/god-object-decomposition test` (unit tests)

---

## Phase 1: hub-mcp/ (easiest — warm-up)

### Task 1.1: Create hub-mcp directory and shared types

**Files:**
- Create: `extensions/openspace-core/src/node/hub-mcp/types.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/` (directory)

**Step 1: Create the directory**

```bash
mkdir -p .worktrees/god-object-decomposition/extensions/openspace-core/src/node/hub-mcp
```

**Step 2: Extract shared types to `types.ts`**

Move these from `hub-mcp.ts` into `hub-mcp/types.ts`:
- `CommandBridgeResult` type (lines 50-59)
- `BridgeCallback` type (line 64)
- `IMcpServer` interface (lines 37-45)
- `ToolResult` helper type (the return shape `{ content: [{ type: 'text', text: string }], isError?: boolean }`)

```typescript
// hub-mcp/types.ts
import { z } from 'zod';

export interface IMcpServer {
    tool(
        name: string,
        description: string,
        schema: Record<string, z.ZodType>,
        handler: (args: unknown) => Promise<unknown>
    ): void;
}

export interface CommandBridgeResult {
    success: boolean;
    output?: unknown;
    error?: string;
}

export type BridgeCallback = (command: {
    cmd: string;
    args: unknown;
    requestId?: string;
    sessionId?: string;
}) => void;

export interface ToolResult {
    content: Array<{ type: 'text'; text: string }>;
    isError?: boolean;
}

export interface BridgeDeps {
    executeViaBridge: (cmd: string, args: unknown) => Promise<unknown>;
}

export interface FileDeps extends BridgeDeps {
    workspaceRoot: string;
    artifactStore: { write(path: string, content: string, meta?: unknown): Promise<void> };
    patchEngine: {
        getVersion(path: string): Promise<{ version: number; hash: string } | undefined>;
        apply(path: string, patch: unknown): Promise<{ version: number; hash: string }>;
    };
}
```

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp/
git commit -m "refactor(hub-mcp): create hub-mcp directory with shared types"
```

### Task 1.2: Extract bridge-forwarding tool handlers

**Files:**
- Create: `extensions/openspace-core/src/node/hub-mcp/pane-tools.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/editor-tools.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/terminal-tools.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/presentation-tools.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/whiteboard-tools.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/voice-tools.ts`

**Step 1: Extract each tool group**

Each file follows this pattern (using pane-tools as example):

```typescript
// hub-mcp/pane-tools.ts
import { z } from 'zod';
import { TOOL } from '../../common/tool-names';
import type { IMcpServer, BridgeDeps } from './types';

export function registerPaneTools(server: IMcpServer, deps: BridgeDeps): void {
    // Copy the 4 server.tool() calls from registerPaneTools (lines 172-211)
    // Replace `this.executeViaBridge(...)` with `deps.executeViaBridge(...)`
}
```

Repeat for all 6 bridge-forwarding groups. Each is a straightforward copy-paste replacing `this.executeViaBridge` with `deps.executeViaBridge`.

**Step 2: Run TypeScript compilation to verify**

```bash
yarn --cwd .worktrees/god-object-decomposition tsc --noEmit -p extensions/openspace-core/tsconfig.json
```
Expected: no errors in the new files (they aren't imported yet, but should type-check)

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp/
git commit -m "refactor(hub-mcp): extract 6 bridge-forwarding tool handler modules"
```

### Task 1.3: Extract file tools and utility functions

**Files:**
- Create: `extensions/openspace-core/src/node/hub-mcp/file-tools.ts`
- Create: `extensions/openspace-core/src/node/hub-mcp/file-utils.ts`

**Step 1: Extract `listDirectory` and `searchFiles` to `file-utils.ts`**

These are pure utility functions (lines 840-933) with no class coupling — they only use `fs` and `path`.

```typescript
// hub-mcp/file-utils.ts
import * as path from 'path';
import * as fs from 'fs';

export function listDirectory(dirPath: string, recursive: boolean, base?: string): string[] {
    // Copy lines 840-861 verbatim
}

export function searchFiles(dirPath: string, pattern: string, globFilter?: string): string[] {
    // Copy lines 863-933 verbatim
}
```

**Step 2: Extract `registerFileTools` to `file-tools.ts`**

```typescript
// hub-mcp/file-tools.ts
import * as fs from 'fs';
import * as path from 'path';
import { z } from 'zod';
import { TOOL } from '../../common/tool-names';
import { isSensitiveFile } from '../../common/sensitive-files';
import { resolveSafePath } from '../path-utils';
import type { IMcpServer, FileDeps } from './types';
import { listDirectory, searchFiles } from './file-utils';

export function registerFileTools(server: IMcpServer, deps: FileDeps): void {
    // Copy 7 server.tool() calls from registerFileTools (lines 337-532)
    // Replace this.workspaceRoot with deps.workspaceRoot
    // Replace this.artifactStore with deps.artifactStore
    // Replace this.patchEngine with deps.patchEngine
    // Replace this.listDirectory with listDirectory
    // Replace this.searchFiles with searchFiles
}
```

**Step 3: Run TypeScript compilation**

```bash
yarn --cwd .worktrees/god-object-decomposition tsc --noEmit -p extensions/openspace-core/tsconfig.json
```

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/node/hub-mcp/
git commit -m "refactor(hub-mcp): extract file tools and utility functions"
```

### Task 1.4: Rewrite hub-mcp.ts as thin facade

**Files:**
- Move: `extensions/openspace-core/src/node/hub-mcp.ts` → `extensions/openspace-core/src/node/hub-mcp/hub-mcp.ts`
- Modify: all importers of the old `hub-mcp.ts`

**Step 1: Find all importers of hub-mcp**

```bash
rg "from.*['\"].*hub-mcp['\"]" .worktrees/god-object-decomposition/extensions/ --files-with-matches
```

**Step 2: Rewrite `hub-mcp.ts` as facade**

The facade keeps:
- `OpenSpaceMcpServer` class with constructor, `close`, `setBridgeCallback`, `resolveCommand`, `mount`, `handleMcpRequest`
- `executeViaBridge` private method (the bridge infrastructure stays here as it manages `pendingCommands`)
- All fields: `pendingCommands`, `bridgeCallback`, `workspaceRoot`, `artifactStore`, `patchEngine`, `commandTimeoutMs`

The facade delegates tool registration:
```typescript
import { registerPaneTools } from './pane-tools';
import { registerEditorTools } from './editor-tools';
import { registerTerminalTools } from './terminal-tools';
import { registerFileTools } from './file-tools';
import { registerPresentationTools } from './presentation-tools';
import { registerWhiteboardTools } from './whiteboard-tools';
import { registerVoiceTools } from './voice-tools';
import type { BridgeDeps, FileDeps } from './types';

// In registerToolsOn:
private registerToolsOn(server: IMcpServer): void {
    const bridgeDeps: BridgeDeps = {
        executeViaBridge: (cmd, args) => this.executeViaBridge(cmd, args)
    };
    const fileDeps: FileDeps = {
        ...bridgeDeps,
        workspaceRoot: this.workspaceRoot,
        artifactStore: this.artifactStore,
        patchEngine: this.patchEngine
    };
    registerPaneTools(server, bridgeDeps);
    registerEditorTools(server, bridgeDeps);
    registerTerminalTools(server, bridgeDeps);
    registerFileTools(server, fileDeps);
    registerPresentationTools(server, bridgeDeps);
    registerWhiteboardTools(server, bridgeDeps);
    registerVoiceTools(server, bridgeDeps);
}
```

**Step 3: Update all import paths**

Change `from '../node/hub-mcp'` or `from './hub-mcp'` to `from './hub-mcp/hub-mcp'` (or `'../node/hub-mcp/hub-mcp'`).

**Step 4: Run TypeScript compilation**

```bash
yarn --cwd .worktrees/god-object-decomposition tsc --noEmit -p extensions/openspace-core/tsconfig.json
```

**Step 5: Build and verify**

```bash
yarn --cwd .worktrees/god-object-decomposition/browser-app webpack --config webpack.config.js --mode development
```

**Step 6: Verify line counts**

```bash
wc -l .worktrees/god-object-decomposition/extensions/openspace-core/src/node/hub-mcp/*.ts
```
Expected: facade < 200 lines, all modules < 400 lines.

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor(hub-mcp): complete decomposition into 9 focused modules"
```

---

## Phase 2: opencode-proxy/ (clear boundaries)

### Task 2.1: Create opencode-proxy directory and extract node-utils

**Files:**
- Create: `extensions/openspace-core/src/node/opencode-proxy/` (directory)
- Create: `extensions/openspace-core/src/node/opencode-proxy/node-utils.ts`

**Step 1: Create directory**

```bash
mkdir -p .worktrees/god-object-decomposition/extensions/openspace-core/src/node/opencode-proxy
```

**Step 2: Extract `validatePath` and `executeShellCommand` to `node-utils.ts`**

These are stateless functions (lines 1228-1329). They only use `fs`, `path`, `childProcess`. No class state.

```typescript
// opencode-proxy/node-utils.ts
import * as path from 'path';
import * as fs from 'fs';
import * as childProcess from 'child_process';

export async function validatePath(
    filePath: string,
    workspaceRoot: string
): Promise<{ valid: boolean; resolvedPath?: string; error?: string }> {
    // Copy lines 1228-1267
}

export async function executeShellCommand(
    command: string,
    cwd: string
): Promise<{ stdout: string; stderr: string; exitCode: number; error?: string }> {
    // Copy lines 1275-1329
}
```

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy/
git commit -m "refactor(proxy): extract node-utils (validatePath, executeShellCommand)"
```

### Task 2.2: Extract HttpClient

**Files:**
- Create: `extensions/openspace-core/src/node/opencode-proxy/http-client.ts`

**Step 1: Extract HTTP infrastructure methods**

Extract `buildUrl`, `rawRequest`, `requestJson`, `get`, `post`, `delete`, `patch` (lines 149-310) into an `@injectable()` HttpClient class.

```typescript
// opencode-proxy/http-client.ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import * as http from 'http';
import * as https from 'https';

export const OpenCodeServerUrl = Symbol('OpenCodeServerUrl');

@injectable()
export class HttpClient {
    @inject(ILogger) protected readonly logger!: ILogger;
    @inject(OpenCodeServerUrl) protected readonly serverUrl!: string;

    buildUrl(endpoint: string, queryParams?: Record<string, string | undefined>): string { ... }
    async rawRequest(url: string, method: string, headers: Record<string, string>, body?: string, timeoutMs?: number): Promise<{ statusCode: number; body: string }> { ... }
    async requestJson<T>(options: { url: string; type: string; data?: string; headers?: Record<string, string>; timeoutMs?: number }): Promise<T> { ... }
    async get<T>(endpoint: string, queryParams?: Record<string, string | undefined>): Promise<T> { ... }
    async post<T>(endpoint: string, body?: unknown, queryParams?: Record<string, string | undefined>, timeoutMs?: number): Promise<T> { ... }
    async delete(endpoint: string, queryParams?: Record<string, string | undefined>): Promise<void> { ... }
    async patch<T>(endpoint: string, body?: unknown): Promise<T> { ... }
}
```

**Cleanup during extraction:** Normalize `delete()` to go through `requestJson` like `post`/`patch` do (currently it calls `rawRequest` directly). Normalize `getDiff()` similarly when it moves to RestApi.

**Step 2: Run TypeScript compilation**

**Step 3: Commit**

```bash
git commit -m "refactor(proxy): extract HttpClient with normalized request pipeline"
```

### Task 2.3: Extract RestApiFacade

**Files:**
- Create: `extensions/openspace-core/src/node/opencode-proxy/rest-api.ts`

**Step 1: Extract all 30+ REST wrapper methods**

These are thin delegations (lines 312-593 + 1207-1222). They all call `this.get/post/patch/delete/rawRequest`. After extraction, they call `this.httpClient.get/post/...`.

```typescript
// opencode-proxy/rest-api.ts
import { injectable, inject } from '@theia/core/shared/inversify';
import { HttpClient } from './http-client';
import { /* all protocol types */ } from '../../common/opencode-protocol';
import * as SDKTypes from '../../common/opencode-sdk-types';

@injectable()
export class RestApiFacade {
    @inject(HttpClient) protected readonly httpClient!: HttpClient;

    // 30+ methods, each 2-5 lines, delegating to httpClient
    async getSessions(_projectId: string, options?: { ... }): Promise<Session[]> {
        return this.httpClient.get<Session[]>('/session', { ... });
    }
    // ... etc
}
```

**Step 2: Run TypeScript compilation**

**Step 3: Commit**

```bash
git commit -m "refactor(proxy): extract RestApiFacade (30+ REST wrapper methods)"
```

### Task 2.4: Extract SSE connection and event routing

**Files:**
- Create: `extensions/openspace-core/src/node/opencode-proxy/sse-connection.ts`
- Create: `extensions/openspace-core/src/node/opencode-proxy/sse-event-router.ts`

**Step 1: Extract SseConnectionManager**

Owns: `sseRequest`, `sseConnected`, `sseReconnectTimer`, `reconnectAttempts`, `maxReconnectDelay`, `initialReconnectDelay`, `currentDirectory`, `isDisposed`.
Methods: `connectToProject`, `disconnectSSE`, `establishSSEConnection`, `scheduleReconnect`.

Needs a reference to the event router (to forward parsed events) and the RPC client (for `onSSEReconnect`).

```typescript
@injectable()
export class SseConnectionManager {
    @inject(ILogger) protected readonly logger!: ILogger;
    @inject(HttpClient) protected readonly httpClient!: HttpClient;

    private sseRequest: http.ClientRequest | undefined;
    private sseConnected = false;
    // ... other SSE state fields

    // Injected via setter to break circular ref
    private eventRouter!: SseEventRouter;
    private clientProvider!: () => OpenCodeClient | undefined;

    setEventRouter(router: SseEventRouter): void { this.eventRouter = router; }
    setClientProvider(provider: () => OpenCodeClient | undefined): void { this.clientProvider = provider; }

    async connectToProject(directory: string): Promise<void> { ... }
    disconnectSSE(): void { ... }
    protected establishSSEConnection(): void { ... }
    protected scheduleReconnect(): void { ... }
}
```

**Step 2: Extract SseEventRouter**

Owns: `lastStreamingPartMessageId`, `userMessageIds`.
Methods: `handleSSEEvent`, `forwardSessionEvent`, `forwardMessageEvent`, `forwardFileEvent`, `forwardPermissionEvent`, `forwardQuestionEvent`, `forwardTodoEvent`.

```typescript
@injectable()
export class SseEventRouter {
    @inject(ILogger) protected readonly logger!: ILogger;

    private lastStreamingPartMessageId: string | undefined;
    private userMessageIds = new Set<string>();

    private clientProvider!: () => OpenCodeClient | undefined;

    setClientProvider(provider: () => OpenCodeClient | undefined): void { this.clientProvider = provider; }
    clearUserMessageIds(): void { this.userMessageIds.clear(); }
    addUserMessageId(id: string): void { this.userMessageIds.add(id); }

    handleSSEEvent(event: ParsedEvent): void { ... }
    // ... 6 forwarder methods
}
```

**Step 3: Run TypeScript compilation**

**Step 4: Commit**

```bash
git commit -m "refactor(proxy): extract SseConnectionManager and SseEventRouter"
```

### Task 2.5: Rewrite opencode-proxy.ts as facade

**Files:**
- Move: `extensions/openspace-core/src/node/opencode-proxy.ts` → `extensions/openspace-core/src/node/opencode-proxy/opencode-proxy.ts`
- Modify: all importers

**Step 1: Find all importers**

```bash
rg "from.*['\"].*opencode-proxy['\"]" .worktrees/god-object-decomposition/extensions/ --files-with-matches
```

**Step 2: Rewrite facade**

The facade class keeps:
- `@injectable()` decorator
- `implements OpenCodeService`
- `setClient` / `dispose` / `client` getter
- Delegates everything else to sub-services

```typescript
@injectable()
export class OpenCodeProxy implements OpenCodeService {
    @inject(HttpClient) protected readonly httpClient!: HttpClient;
    @inject(RestApiFacade) protected readonly restApi!: RestApiFacade;
    @inject(SseConnectionManager) protected readonly sseConnection!: SseConnectionManager;
    @inject(SseEventRouter) protected readonly sseEventRouter!: SseEventRouter;

    protected _client: OpenCodeClient | undefined;

    @postConstruct()
    init(): void {
        // Wire circular refs
        this.sseConnection.setEventRouter(this.sseEventRouter);
        this.sseConnection.setClientProvider(() => this._client);
        this.sseEventRouter.setClientProvider(() => this._client);
    }

    setClient(client: OpenCodeClient | undefined): void { ... }
    dispose(): void { this.sseConnection.disconnectSSE(); }

    // Delegate REST methods to restApi
    async getSessions(...args): Promise<Session[]> { return this.restApi.getSessions(...args); }
    // ... etc for all 30+ methods

    // Delegate SSE
    async connectToProject(dir: string): Promise<void> { return this.sseConnection.connectToProject(dir); }

    // Delegate utils
    async validatePath(...args) { return validatePath(...args); }
    async executeShellCommand(...args) { return executeShellCommand(...args); }
}
```

**Step 3: Update DI module** (`openspace-core-backend-module.ts`)

Add bindings for `HttpClient`, `RestApiFacade`, `SseConnectionManager`, `SseEventRouter`. Keep `OpenCodeProxy` binding.

**Step 4: Update all import paths**

**Step 5: Run TypeScript compilation**

**Step 6: Build and verify**

**Step 7: Verify line counts**

```bash
wc -l .worktrees/god-object-decomposition/extensions/openspace-core/src/node/opencode-proxy/*.ts
```
Expected: facade < 200 lines, all modules < 400 lines.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor(proxy): complete decomposition into 6 focused modules"
```

---

## Phase 3: session-service/ (hardest backend)

### Task 3.1: Create session-service directory and extract interaction handlers

**Files:**
- Create: `extensions/openspace-core/src/browser/session-service/` (directory)
- Create: `extensions/openspace-core/src/browser/session-service/interaction-handlers.ts`

**Step 1: Create directory**

```bash
mkdir -p .worktrees/god-object-decomposition/extensions/openspace-core/src/browser/session-service
```

**Step 2: Extract interaction handlers**

Easiest cluster — minimal coupling. Owns: `_pendingQuestions`, `_pendingPermissions`, `_todos`, 3 emitters, ~8 methods.

```typescript
// session-service/interaction-handlers.ts
@injectable()
export class InteractionService {
    @inject(OpenCodeService) protected readonly openCodeService!: OpenCodeService;

    private _pendingQuestions: SDKTypes.QuestionRequest[] = [];
    private _pendingPermissions: PermissionNotification[] = [];
    private _todos: Array<{ id: string; description: string; status: string }> = [];

    private onQuestionChangedEmitter = new Emitter<SDKTypes.QuestionRequest[]>();
    private onPermissionChangedEmitter = new Emitter<PermissionNotification[]>();
    private onTodosChangedEmitter = new Emitter<Array<{ id: string; description: string; status: string }>>();

    readonly onQuestionChanged = this.onQuestionChangedEmitter.event;
    readonly onPermissionChanged = this.onPermissionChangedEmitter.event;
    readonly onTodosChanged = this.onTodosChangedEmitter.event;

    get pendingQuestions() { return this._pendingQuestions; }
    get pendingPermissions() { return this._pendingPermissions; }
    get todos() { return this._todos; }

    addPendingQuestion(question: SDKTypes.QuestionRequest): void { ... }
    removePendingQuestion(requestId: string): void { ... }
    async answerQuestion(requestId: string, answers: SDKTypes.QuestionAnswer[]): Promise<void> { ... }
    async rejectQuestion(requestId: string): Promise<void> { ... }
    updateTodos(todos: Array<{ id: string; description: string; status: string }>): void { ... }
    addPendingPermission(permission: PermissionNotification): void { ... }
    removePendingPermission(permissionId: string): void { ... }
    async replyPermission(requestId: string, reply: 'once' | 'always' | 'reject'): Promise<void> { ... }
    async loadPendingQuestions(sessionId: string): Promise<void> { ... }
    clearAll(): void { ... }

    dispose(): void { ... }
}
```

**Step 3: Commit**

```bash
git commit -m "refactor(session): extract InteractionService (questions, permissions, todos)"
```

### Task 3.2: Extract model preference service

**Files:**
- Create: `extensions/openspace-core/src/browser/session-service/model-preference.ts`

**Step 1: Extract ModelService**

Smallest cluster — ~40 lines. Owns: `_activeModel`, 1 emitter, 2 methods.

```typescript
@injectable()
export class ModelPreferenceService {
    private _activeModel: string | undefined;
    private onActiveModelChangedEmitter = new Emitter<string | undefined>();
    readonly onActiveModelChanged = this.onActiveModelChangedEmitter.event;

    @inject(OpenCodeService) protected readonly openCodeService!: OpenCodeService;

    get activeModel() { return this._activeModel; }

    setActiveModel(model: string): void { ... }
    async getAvailableModels(): Promise<ProviderWithModels[]> { ... }

    dispose(): void { this.onActiveModelChangedEmitter.dispose(); }
}
```

**Step 2: Commit**

```bash
git commit -m "refactor(session): extract ModelPreferenceService"
```

### Task 3.3: Extract streaming state service

**Files:**
- Create: `extensions/openspace-core/src/browser/session-service/streaming-state.ts`

**Step 1: Extract StreamingStateService**

Owns: `_isStreaming`, `_streamingMessageId`, `_currentStreamingStatus`, `_lastStatusChangeTime`, `_statusChangeTimeout`, `_streamingDoneTimer`, `STREAMING_DONE_DELAY_MS`.
Emitters: `onIsStreamingChanged`, `onStreamingStatusChanged`, `onMessageStreaming`.
Methods: `updateStreamingMessage`, `updateStreamingMessageParts`, `applyPartDelta`, `clearStreamingPartText`, `computeStreamingStatus`, `toolNameToCategory`, `updateStreamingStatus`, `resetStreamingStatus`.

**Key coupling:** These methods currently mutate `_messages[]` directly. After extraction, they call `messageStore.appendToContent(msgId, delta)` and `messageStore.updateParts(msgId, parts)`.

The StreamingStateService needs a reference to a `MessageStoreService` interface. Use setter injection to break the potential circular ref.

```typescript
@injectable()
export class StreamingStateService {
    @inject(ILogger) protected readonly logger!: ILogger;

    private messageStore!: MessageStoreService;
    setMessageStore(store: MessageStoreService): void { this.messageStore = store; }

    private _isStreaming = false;
    private _streamingMessageId: string | undefined;
    // ... other streaming fields

    private onIsStreamingChangedEmitter = new Emitter<boolean>();
    private onStreamingStatusChangedEmitter = new Emitter<string>();
    private onMessageStreamingEmitter = new Emitter<StreamingUpdate>();

    // ... methods that delegate message mutations to messageStore
}
```

**Step 2: Commit**

```bash
git commit -m "refactor(session): extract StreamingStateService"
```

### Task 3.4: Extract message store service

**Files:**
- Create: `extensions/openspace-core/src/browser/session-service/message-store.ts`

**Step 1: Extract MessageStoreService**

Owns: `_messages`, `_messageLoadCursor`, `_hasOlderMessages`.
Emitter: `onMessagesChanged`.
Methods: `loadMessages`, `reloadMessages`, `getMessagesForPreview`, `loadOlderMessages`, `appendMessage`, `replaceMessage`, `fetchMessageFromBackend`, `notifyMessageRemoved`, `notifyPartRemoved`.

Also provides the mutation interface for StreamingStateService:
- `getMessages(): Message[]`
- `setMessages(msgs: Message[]): void`
- `findMessage(id: string): Message | undefined`
- `fireMessagesChanged(): void`

```typescript
@injectable()
export class MessageStoreService {
    @inject(OpenCodeService) protected readonly openCodeService!: OpenCodeService;
    @inject(ILogger) protected readonly logger!: ILogger;

    private _messages: Message[] = [];
    private _messageLoadCursor: string | undefined;
    private _hasOlderMessages = true;

    private onMessagesChangedEmitter = new Emitter<Message[]>();
    readonly onMessagesChanged = this.onMessagesChangedEmitter.event;

    get messages() { return this._messages; }
    get hasOlderMessages() { return this._hasOlderMessages; }

    // ... all message CRUD methods
    // Mutation interface for StreamingStateService:
    findMessage(id: string): Message | undefined { ... }
    fireMessagesChanged(): void { this.onMessagesChangedEmitter.fire(this._messages); }
}
```

**Step 2: Commit**

```bash
git commit -m "refactor(session): extract MessageStoreService"
```

### Task 3.5: Extract session lifecycle service

**Files:**
- Create: `extensions/openspace-core/src/browser/session-service/session-lifecycle.ts`

**Step 1: Extract SessionLifecycleService**

Owns: `_activeProject`, `_activeSession`, `_sessionStatuses`, `_sessionErrors`, `_sessionLoadLimit`, `_sessionCursor`, `_hasMoreSessions`, `sessionLoadAbortController`.
Emitters: `onActiveProjectChanged`, `onActiveSessionChanged`, `onSessionStatusChanged`.
Methods: All session CRUD methods.

This is the largest extraction. It depends on:
- `MessageStoreService` (clear messages on switch, load messages for new session)
- `StreamingStateService` (reset streaming on session switch)
- `InteractionService` (clear questions/permissions on session switch, load questions)
- `ModelPreferenceService` (set model from session metadata)

All cross-references use setter injection.

**Step 2: Commit**

```bash
git commit -m "refactor(session): extract SessionLifecycleService"
```

### Task 3.6: Rewrite session-service.ts as facade

**Files:**
- Move: `extensions/openspace-core/src/browser/session-service.ts` → `extensions/openspace-core/src/browser/session-service/session-service.ts`
- Modify: all importers
- Modify: `openspace-core-frontend-module.ts` (add sub-service bindings)

**Step 1: Find all importers**

```bash
rg "from.*['\"].*session-service['\"]" .worktrees/god-object-decomposition/extensions/ --files-with-matches
```

**Step 2: Rewrite facade**

The SessionService interface stays the same (all 42+ public methods). The facade:
1. Injects all 5 sub-services
2. Wires circular refs in `@postConstruct`
3. Delegates every method to the appropriate sub-service
4. Keeps `sendMessage` as the orchestration method (it touches all clusters)
5. Keeps the `init()` bootstrap logic (it coordinates project/session/hub initialization)

**Step 3: Update DI module**

Add 5 new bindings. Wire setter injection via `FrontendApplicationContribution.onStart`.

**Step 4: Update all import paths**

**Step 5: Run TypeScript compilation and build**

**Step 6: Run unit tests**

```bash
yarn --cwd .worktrees/god-object-decomposition test
```

**Step 7: Verify line counts**

Expected: facade ~300 lines, all sub-services < 400 lines.

**Step 8: Commit**

```bash
git add -A
git commit -m "refactor(session): complete decomposition into 6 focused modules"
```

---

## Phase 4: Chat Frontend Decomposition

### Task 4.1: Extract ChatHeaderBar from chat-widget

**Files:**
- Create: `extensions/openspace-chat/src/browser/chat-widget/` (directory)
- Create: `extensions/openspace-chat/src/browser/chat-widget/chat-header-bar.tsx`

**Step 1: Move ChatHeaderBar**

`ChatHeaderBar` (lines 193-535, 342 lines) is a self-contained component with its own state, effects, and callbacks. It has 22 props.

Move it to `chat-widget/chat-header-bar.tsx` with its `ChatHeaderBarProps` interface.

**Step 2: Commit**

```bash
git commit -m "refactor(chat): extract ChatHeaderBar to own file"
```

### Task 4.2: Extract session subscription hooks from chat-widget

**Files:**
- Create: `extensions/openspace-chat/src/browser/chat-widget/use-session-subscriptions.ts`

**Step 1: Extract the mega-effect (lines 666-803)**

This 137-line useEffect subscribes to 8+ events. Split into a custom hook that returns all the reactive state:

```typescript
export function useSessionSubscriptions(sessionService: SessionService): {
    messages: Message[];
    messagesRef: React.MutableRefObject<Message[]>;
    isStreaming: boolean;
    streamingStatus: string;
    streamingMessageId: string | undefined;
    sessionBusy: boolean;
    retryStatus: RetryStatus | undefined;
    pendingQuestions: SDKTypes.QuestionRequest[];
    pendingPermissions: PermissionNotification[];
    sessionLoadError: string | undefined;
    sessionError: string | undefined;
} { ... }
```

**Step 2: Commit**

```bash
git commit -m "refactor(chat): extract useSessionSubscriptions hook"
```

### Task 4.3: Extract session action callbacks from chat-widget

**Files:**
- Create: `extensions/openspace-chat/src/browser/chat-widget/use-session-actions.ts`

**Step 1: Extract 10+ session-related callbacks**

`handleNewSession`, `handleSessionSwitch`, `handleDeleteSession`, `handleForkSession`, `handleRenameSession`, `handleNavigateToParent`, `handleRevertSession`, `handleCompactSession`, `handleShareSession`, `handleUnshareSession`.

```typescript
export function useSessionActions(sessionService: SessionService, messageService: MessageService): {
    handleNewSession: () => Promise<void>;
    handleSessionSwitch: (sessionId: string) => Promise<void>;
    // ... etc
} { ... }
```

**Step 2: Commit**

```bash
git commit -m "refactor(chat): extract useSessionActions hook"
```

### Task 4.4: Extract message queue hook from chat-widget

**Files:**
- Create: `extensions/openspace-chat/src/browser/chat-widget/use-message-queue.ts`

**Step 1: Extract queue logic**

`queuedCount`, `messageQueueRef`, `isSendingRef`, `sendPartsNow`, `drainQueue`, `handleSend`, and the drain-on-streaming-end effect.

**Step 2: Commit**

```bash
git commit -m "refactor(chat): extract useMessageQueue hook"
```

### Task 4.5: Rewrite chat-widget.tsx as main component

**Files:**
- Move: `extensions/openspace-chat/src/browser/chat-widget.tsx` → `extensions/openspace-chat/src/browser/chat-widget/chat-widget.tsx`
- Modify: all importers

**Step 1: Rewrite ChatComponent**

The main component now composes hooks and sub-components. Target: ~250 lines.

**Step 2: Update all import paths**

**Step 3: Build and verify**

**Step 4: Commit**

```bash
git add -A
git commit -m "refactor(chat): complete chat-widget decomposition into 6 modules"
```

### Task 4.6: Decompose message-bubble.tsx

**Files:**
- Create: `extensions/openspace-chat/src/browser/message-bubble/` (directory)
- Create: `extensions/openspace-chat/src/browser/message-bubble/tool-block.tsx`
- Create: `extensions/openspace-chat/src/browser/message-bubble/task-tool-block.tsx`
- Create: `extensions/openspace-chat/src/browser/message-bubble/todo-tool-block.tsx`
- Create: `extensions/openspace-chat/src/browser/message-bubble/context-tool-group.tsx`
- Create: `extensions/openspace-chat/src/browser/message-bubble/turn-group.tsx`
- Create: `extensions/openspace-chat/src/browser/message-bubble/part-renderers.tsx`
- Create: `extensions/openspace-chat/src/browser/message-bubble/tool-constants.ts`
- Create: `extensions/openspace-chat/src/browser/message-bubble/message-utils.ts`
- Move: main file to `message-bubble/message-bubble.tsx`

**Step 1: Extract tool-constants.ts** — all regex patterns (lines 64-83) and ToolIcons (lines 154-162)

**Step 2: Extract message-utils.ts** — `formatElapsed`, `formatTimestamp`, `groupParts`, `getToolInfo`, `isFilePath`

**Step 3: Extract each component** — ToolBlock (292 lines), TaskToolBlock (173 lines), TodoToolBlock, ContextToolGroup, TurnGroup (108 lines), part renderers

**Step 4: Rewrite message-bubble.tsx** — now just MessageBubbleInner + renderPart dispatcher. Target: ~400 lines.

**Step 5: Update import paths, build, verify line counts**

**Step 6: Commit**

```bash
git add -A
git commit -m "refactor(chat): decompose message-bubble into 10 focused modules"
```

### Task 4.7: Decompose prompt-input.tsx

**Files:**
- Create: `extensions/openspace-chat/src/browser/prompt-input/use-typeahead.ts`
- Create: `extensions/openspace-chat/src/browser/prompt-input/use-slash-commands.ts`
- Create: `extensions/openspace-chat/src/browser/prompt-input/use-input-history.ts`
- Create: `extensions/openspace-chat/src/browser/prompt-input/use-attachments.ts`

**Step 1: Extract useTypeahead** — ~200 lines of state + effects for @mention system

**Step 2: Extract useSlashCommands** — ~100 lines for slash command menu

**Step 3: Extract useInputHistory** — ~150 lines for prompt history navigation

**Step 4: Extract useAttachments** — ~100 lines for file/image attachment management

**Step 5: Rewrite prompt-input.tsx** — composes 4 hooks + renders editor, menus, toolbar. Target: ~400 lines.

**Step 6: Build and verify**

**Step 7: Commit**

```bash
git add -A
git commit -m "refactor(chat): decompose prompt-input into 5 focused modules"
```

---

## Phase 5: Verification

### Task 5.1: Full build and test

**Step 1: TypeScript compilation (all extensions)**

```bash
yarn --cwd .worktrees/god-object-decomposition tsc --noEmit -p extensions/openspace-core/tsconfig.json
yarn --cwd .worktrees/god-object-decomposition tsc --noEmit -p extensions/openspace-chat/tsconfig.json
```

**Step 2: Webpack build**

```bash
yarn --cwd .worktrees/god-object-decomposition/browser-app webpack --config webpack.config.js --mode development
```

**Step 3: Unit tests**

```bash
yarn --cwd .worktrees/god-object-decomposition test
```

**Step 4: Line count verification**

```bash
wc -l .worktrees/god-object-decomposition/extensions/openspace-core/src/node/hub-mcp/*.ts
wc -l .worktrees/god-object-decomposition/extensions/openspace-core/src/node/opencode-proxy/*.ts
wc -l .worktrees/god-object-decomposition/extensions/openspace-core/src/browser/session-service/*.ts
wc -l .worktrees/god-object-decomposition/extensions/openspace-chat/src/browser/chat-widget/*.ts*
wc -l .worktrees/god-object-decomposition/extensions/openspace-chat/src/browser/message-bubble/*.ts*
wc -l .worktrees/god-object-decomposition/extensions/openspace-chat/src/browser/prompt-input/*.ts*
```

All files must be under 400 lines.

**Step 5: E2E smoke test** (one spec file to verify nothing is broken)

```bash
yarn --cwd .worktrees/god-object-decomposition/browser-app e2e-test --spec tests/e2e/chat.spec.ts
```

### Task 5.2: Final commit and summary

```bash
git log --oneline refactor/god-object-decomposition ^master
```

Review all commits, ensure clean history, no accidental deletions.
