# Architecture Diagrams: Theia-OpenSpace

## Current Architecture (Detailed)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Frontend)                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  UI Layer (React Components)                                        │    │
│  │  - ChatPanel: Message display, input, session selector             │    │
│  │  - PermissionDialog: Tool use approval UI                          │    │
│  │  - FileStatusBar: File operation indicators                        │    │
│  └───────────────────────────────┬──────────────────────────────────────┘    │
│                                   │                                          │
│                                   ↓ State Subscriptions                      │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  SessionService (Frontend State Management)                        │    │
│  │  • activeProject: Project | undefined                              │    │
│  │  • activeSession: Session | undefined                              │    │
│  │  • messages: Map<string, Message>                                  │    │
│  │  • streamingMessages: Map<string, partial text>                    │    │
│  │  • Emitters: onSessionChanged, onMessageReceived, etc.             │    │
│  └───────────────────────────────┬──────────────────────────────────────┘    │
│                                   │                                          │
│                                   ↓ Service Calls                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  OpenCodeService (RPC Proxy - Dynamic)                             │    │
│  │  Created by: ServiceConnectionProvider.createProxy()               │    │
│  │  • getProjects() → RPC call                                        │    │
│  │  • createSession() → RPC call                                      │    │
│  │  • createMessage() → RPC call                                      │    │
│  └───────────────────────────────┬──────────────────────────────────────┘    │
│                                   │                                          │
│                                   ↓ RPC Callbacks                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  OpenCodeSyncService (RPC Callback Handler)                        │    │
│  │  Implements: OpenCodeClient interface                              │    │
│  │  • onSessionEvent(SessionNotification)                             │    │
│  │  • onMessageEvent(MessageNotification)                             │    │
│  │  • onPermissionEvent(PermissionNotification)                       │    │
│  │  • onAgentCommand(AgentCommand) → executes via CommandRegistry     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  BridgeContribution (Command Discovery & Execution)                │    │
│  │  • Collects all openspace.* commands on startup                    │    │
│  │  • POST CommandManifest to Hub (/openspace/manifest)               │    │
│  │  • Executes agent commands received via OpenCodeSyncService        │    │
│  └────────────────────────────────────────────────────────────────────┘    │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ JSON-RPC over WebSocket
                                    │ Path: /services/opencode
                                    │
┌───────────────────────────────────┴───────────────────────────────────────────┐
│                        BACKEND (Node.js Server)                               │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  Theia RPC Handler                                                  │    │
│  │  • Routes frontend calls to OpenCodeProxy methods                   │    │
│  │  • Serializes/deserializes messages across RPC boundary             │    │
│  └────────────────────────────────┬────────────────────────────────────┘    │
│                                    │                                          │
│                                    ↓                                          │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  OpenCodeProxy (Custom HTTP Client + SSE Handler)                   │    │
│  │  File: extensions/openspace-core/src/node/opencode-proxy.ts         │    │
│  │                                                                      │    │
│  │  Dependencies:                                                       │    │
│  │  • import * as http from 'http'                                     │    │
│  │  • import * as https from 'https'                                   │    │
│  │  • import { createParser } from 'eventsource-parser'                │    │
│  │                                                                      │    │
│  │  State Management:                                                  │    │
│  │  • sseRequest: http.ClientRequest                                   │    │
│  │  • sseConnected: boolean                                            │    │
│  │  • reconnectAttempts: number                                        │    │
│  │  • currentProjectId: string                                         │    │
│  │  • currentSessionId: string                                         │    │
│  │                                                                      │    │
│  │  Key Methods:                                                       │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │ REST API Calls (Manual HTTP)                                │   │    │
│  │  │ • getProjects() → GET /project                              │   │    │
│  │  │ • createSession() → POST /session                           │   │    │
│  │  │ • createMessage() → POST /session/:id/message               │   │    │
│  │  │ • getFile() → GET /file?path=...                            │   │    │
│  │  │                                                              │   │    │
│  │  │ Each method:                                                 │   │    │
│  │  │  1. Constructs URL and options                              │   │    │
│  │  │  2. Calls makeRequest(url, options)                         │   │    │
│  │  │  3. Parses JSON response                                    │   │    │
│  │  │  4. Converts to domain types                                │   │    │
│  │  │  5. Returns Promise<Result>                                 │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │ makeRequest(url, options) - Generic HTTP Helper              │   │    │
│  │  │                                                              │   │    │
│  │  │ 1. Parse URL to determine http vs https                     │   │    │
│  │  │ 2. Create ClientRequest with headers                        │   │    │
│  │  │ 3. Handle request errors (ECONNREFUSED, etc.)               │   │    │
│  │  │ 4. Accumulate response chunks                               │   │    │
│  │  │ 5. Parse JSON when complete                                 │   │    │
│  │  │ 6. Return { data, statusCode } or throw error               │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  │                                                                      │    │
│  │  ┌─────────────────────────────────────────────────────────────┐   │    │
│  │  │ SSE Connection Management                                    │   │    │
│  │  │                                                              │   │    │
│  │  │ connectSSE(projectId, sessionId):                           │   │    │
│  │  │  1. Disconnect existing connection if any                   │   │    │
│  │  │  2. Create GET /session/:id/events request                  │   │    │
│  │  │  3. Set up eventsource-parser callback:                     │   │    │
│  │  │     parser = createParser((event: ParseEvent) => {          │   │    │
│  │  │       if (event.type === 'event') {                         │   │    │
│  │  │         this.handleSSEEvent(event.data)                     │   │    │
│  │  │       }                                                      │   │    │
│  │  │     })                                                       │   │    │
│  │  │  4. Pipe response chunks to parser                          │   │    │
│  │  │  5. Handle connection errors → scheduleReconnect()          │   │    │
│  │  │                                                              │   │    │
│  │  │ handleSSEEvent(data: string):                               │   │    │
│  │  │  1. Parse JSON to get { type, payload }                     │   │    │
│  │  │  2. Route by prefix:                                        │   │    │
│  │  │     - "session.*" → forwardSessionEvent()                   │   │    │
│  │  │     - "message.*" → forwardMessageEvent()                   │   │    │
│  │  │     - "file.*" → forwardFileEvent()                         │   │    │
│  │  │     - "permission.*" → forwardPermissionEvent()             │   │    │
│  │  │  3. Call client RPC callback with event                     │   │    │
│  │  │                                                              │   │    │
│  │  │ scheduleReconnect():                                         │   │    │
│  │  │  1. Calculate delay: min(initialDelay * 2^attempts, max)   │   │    │
│  │  │  2. setTimeout(() => connectSSE(...), delay)                │   │    │
│  │  │  3. Increment reconnectAttempts                             │   │    │
│  │  │  4. Reset to 0 on successful connection                     │   │    │
│  │  └─────────────────────────────────────────────────────────────┘   │    │
│  └───────────────────────────────┬─────────────────────────────────────┘    │
│                                   │                                          │
│                                   │ HTTP REST + SSE                          │
│                                   │                                          │
│  ┌───────────────────────────────┴─────────────────────────────────────┐    │
│  │  OpenSpaceHub (Express HTTP Server)                                 │    │
│  │  File: extensions/openspace-core/src/node/hub.ts                    │    │
│  │                                                                      │    │
│  │  Endpoints:                                                         │    │
│  │  • POST /openspace/manifest                                         │    │
│  │    → Receives CommandManifest from frontend                         │    │
│  │    → Stores in memory for prompt generation                         │    │
│  │                                                                      │    │
│  │  • GET /openspace/instructions                                      │    │
│  │    → Generates system prompt for agent                              │    │
│  │    → Includes available commands, current state                     │    │
│  │    → Format: %%OS{"cmd":"id","args":{}}%%                           │    │
│  │                                                                      │    │
│  │  • POST /openspace/state                                            │    │
│  │    → Receives IDE state (open files, dirty flags)                   │    │
│  │    → Used for context-aware assistance                              │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ HTTP REST + SSE
                                    │
┌───────────────────────────────────┴───────────────────────────────────────────┐
│                    OPENCODE AGENT (External Server)                           │
│                                                                               │
│  Port: 7890 (configurable via OPENCODE_SERVER_URL)                           │
│                                                                               │
│  REST API Endpoints:                                                         │
│  • GET    /project                      → List projects                      │
│  • POST   /project/init                 → Initialize project                 │
│  • GET    /session?projectId=...        → List sessions                      │
│  • POST   /session                      → Create session                     │
│  • GET    /session/:id                  → Get session details                │
│  • DELETE /session/:id                  → Delete session                     │
│  • GET    /session/:id/message          → List messages                      │
│  • POST   /session/:id/message          → Send message                       │
│  • GET    /file?path=...&projectId=...  → Get file content                   │
│  • GET    /agent                        → Get agent config                   │
│  • GET    /provider                     → Get provider config                │
│                                                                               │
│  SSE Endpoint:                                                                │
│  • GET    /session/:id/events           → Server-Sent Events stream          │
│                                                                               │
│  Event Types:                                                                 │
│  - session.created, session.updated, session.deleted                          │
│  - message.created, message.partial, message.completed                        │
│  - file.created, file.updated, file.deleted                                   │
│  - permission.requested, permission.granted, permission.denied                │
│                                                                               │
│  Agent Processing:                                                            │
│  1. Receives user message                                                     │
│  2. Loads system prompt from /openspace/instructions                          │
│  3. Calls LLM provider (Claude, GPT, etc.)                                    │
│  4. Parses %%OS{...}%% commands from response                                 │
│  5. Emits agent commands via SSE                                              │
│  6. Streams response text incrementally (message.partial events)              │
│  7. Finalizes message (message.completed event)                               │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## OpenCode VS Code Extension Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     VS CODE EXTENSION (Node.js)                              │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Webview UI (React)                                                 │    │
│  │  • Chat sidebar with message history                               │    │
│  │  • Input field for user prompts                                    │    │
│  │  • Status indicators                                                │    │
│  └───────────────────────────────┬──────────────────────────────────────┘    │
│                                   │                                          │
│                                   ↓ postMessage to Extension Host            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Extension Host (Node.js)                                           │    │
│  │                                                                     │    │
│  │  import { createOpencodeClient } from '@opencode-ai/sdk';          │    │
│  │                                                                     │    │
│  │  const client = createOpencodeClient({                             │    │
│  │    baseUrl: config.get('opencode.server.baseUrl')                  │    │
│  │  });                                                                │    │
│  │                                                                     │    │
│  │  // Send message                                                   │    │
│  │  async function sendMessage(text: string) {                        │    │
│  │    const response = await client.message.create({                  │    │
│  │      path: { sessionId: currentSession.id },                       │    │
│  │      body: {                                                        │    │
│  │        role: 'user',                                                │    │
│  │        parts: [{ type: 'text', text }]                             │    │
│  │      }                                                              │    │
│  │    });                                                              │    │
│  │    return response.data;                                           │    │
│  │  }                                                                  │    │
│  │                                                                     │    │
│  │  // Stream events                                                  │    │
│  │  async function subscribeToEvents() {                              │    │
│  │    const stream = await client.session.stream({                    │    │
│  │      path: { id: currentSession.id }                               │    │
│  │    });                                                              │    │
│  │                                                                     │    │
│  │    for await (const event of stream) {                             │    │
│  │      // Update webview UI                                          │    │
│  │      webview.postMessage(event);                                   │    │
│  │    }                                                                │    │
│  │  }                                                                  │    │
│  └───────────────────────────────┬──────────────────────────────────────┘    │
│                                   │                                          │
│                                   │ @opencode-ai/sdk                         │
│                                   │ (Type-safe HTTP client)                  │
│                                   │                                          │
│  ┌───────────────────────────────┴──────────────────────────────────────┐   │
│  │  SDK Internals                                                        │   │
│  │  • Uses global fetch() API                                           │   │
│  │  • OpenAPI-generated TypeScript types                                │   │
│  │  • Automatic JSON serialization/deserialization                      │   │
│  │  • Built-in error handling                                           │   │
│  │  • SSE streaming via fetch() + ReadableStream                        │   │
│  │  • Zero runtime dependencies                                         │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ HTTP/HTTPS + SSE
                                    │
┌───────────────────────────────────┴───────────────────────────────────────────┐
│                    OPENCODE SERVER (Local or Remote)                          │
│                                                                               │
│  Port: 4096 (default, configurable)                                          │
│  Implementation: Hono/Bun HTTP server                                         │
│                                                                               │
│  Same REST API + SSE as described above                                       │
│  • OpenAPI 3.1 spec available at /doc                                         │
│  • CORS enabled for localhost and *.opencode.ai                               │
│  • Optional HTTP basic auth via OPENCODE_SERVER_PASSWORD                      │
│  • mDNS for local network discovery                                           │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Key Difference:** No RPC layer - Extension directly uses SDK to talk to server.

---

## Proposed Simplified Architecture (Option 1: SDK Backend)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Frontend)                                 │
│  Same as current - No changes needed                                        │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ JSON-RPC (unchanged)
                                    │
┌───────────────────────────────────┴───────────────────────────────────────────┐
│                        BACKEND (Node.js Server)                               │
│                                                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐    │
│  │  OpenCodeSDKAdapter (NEW - replaces OpenCodeProxy)                  │    │
│  │  File: extensions/openspace-core/src/node/opencode-sdk-adapter.ts   │    │
│  │                                                                      │    │
│  │  import { createOpencodeClient } from '@opencode-ai/sdk';           │    │
│  │                                                                      │    │
│  │  @injectable()                                                       │    │
│  │  export class OpenCodeSDKAdapter implements OpenCodeService {       │    │
│  │    private client = createOpencodeClient({                          │    │
│  │      baseUrl: process.env.OPENCODE_SERVER_URL || DEFAULT            │    │
│  │    });                                                               │    │
│  │                                                                      │    │
│  │    async getProjects(): Promise<Project[]> {                        │    │
│  │      const result = await this.client.project.list();               │    │
│  │      return result.data.map(adaptProject);                          │    │
│  │    }                                                                 │    │
│  │                                                                      │    │
│  │    async createSession(projectId, title): Promise<Session> {        │    │
│  │      const result = await this.client.session.create({              │    │
│  │        body: { projectId, title }                                   │    │
│  │      });                                                             │    │
│  │      return adaptSession(result.data);                              │    │
│  │    }                                                                 │    │
│  │                                                                      │    │
│  │    async subscribeToEvents(projectId, sessionId) {                  │    │
│  │      const stream = await this.client.session.stream({              │    │
│  │        path: { id: sessionId }                                      │    │
│  │      });                                                             │    │
│  │                                                                      │    │
│  │      for await (const event of stream) {                            │    │
│  │        // Forward to RPC client                                     │    │
│  │        this._client?.onSessionEvent(adaptEvent(event));             │    │
│  │      }                                                               │    │
│  │    }                                                                 │    │
│  │  }                                                                   │    │
│  │                                                                      │    │
│  │  Code Reduction: ~400 lines → ~100 lines                            │    │
│  │  Type Safety: Manual → OpenAPI-generated                            │    │
│  │  Error Handling: Custom → SDK standardized                          │    │
│  └──────────────────────────────────────────────────────────────────────┘    │
│                                                                               │
│  Hub remains unchanged                                                       │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ HTTP (handled by SDK)
                                    │
┌───────────────────────────────────┴───────────────────────────────────────────┐
│                           OPENCODE SERVER                                     │
│  Same as current                                                              │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- 75% less code in backend HTTP layer
- Type-safe API calls
- Automatic SDK updates
- Better error messages
- No frontend changes

---

## Proposed Simplified Architecture (Option 2: Frontend Direct)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BROWSER (Frontend)                                 │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  UI Layer - No changes                                              │    │
│  └───────────────────────────────┬──────────────────────────────────────┘    │
│                                   │                                          │
│  ┌───────────────────────────────┴──────────────────────────────────────┐   │
│  │  OpenCodeFrontendService (NEW - replaces SessionService calls)       │   │
│  │                                                                       │   │
│  │  import { createOpencodeClient } from '@opencode-ai/sdk/browser';    │   │
│  │                                                                       │   │
│  │  @injectable()                                                        │   │
│  │  export class OpenCodeFrontendService {                              │   │
│  │    private client = createOpencodeClient({                           │   │
│  │      baseUrl: 'http://localhost:7890'                                │   │
│  │    });                                                                │   │
│  │                                                                       │   │
│  │    async getProjects() {                                             │   │
│  │      const result = await this.client.project.list();                │   │
│  │      return result.data;                                             │   │
│  │    }                                                                  │   │
│  │                                                                       │   │
│  │    subscribeToEvents(sessionId, callback) {                          │   │
│  │      (async () => {                                                  │   │
│  │        const stream = await this.client.session.stream({             │   │
│  │          path: { id: sessionId }                                     │   │
│  │        });                                                            │   │
│  │        for await (const event of stream) {                           │   │
│  │          callback(event);                                            │   │
│  │        }                                                              │   │
│  │      })();                                                            │   │
│  │    }                                                                  │   │
│  │  }                                                                    │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└──────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ HTTP directly (no RPC)
                                    │ Requires CORS configuration
                                    │
┌───────────────────────────────────┴───────────────────────────────────────────┐
│                        BACKEND (Node.js Server)                               │
│                                                                               │
│  OpenCodeProxy - REMOVED                                                     │
│  RPC Handler - REMOVED                                                       │
│  Hub - KEPT (for /openspace/* endpoints)                                     │
└───────────────────────────────────┬───────────────────────────────────────────┘
                                    │
                                    │ (Backend only handles Hub endpoints)
                                    │
┌───────────────────────────────────┴───────────────────────────────────────────┐
│                           OPENCODE SERVER                                     │
│  Requires CORS configuration to allow browser origin                         │
│  Access-Control-Allow-Origin: http://localhost:3000                           │
└───────────────────────────────────────────────────────────────────────────────┘
```

**Benefits:**
- Eliminate entire RPC layer
- Lower latency (no backend hop)
- Simpler debugging (all in browser DevTools)

**Drawbacks:**
- CORS complexity
- Breaks Theia patterns
- Less backend control

---

## Message Flow Comparison

### Current Implementation

```
User types "Hello"
   ↓
UI Component captures input
   ↓
SessionService.sendMessage(parts)
   ↓
OpenCodeService.createMessage() [RPC call - serialization]
   ↓ WebSocket
Backend RPC Handler receives call [deserialization]
   ↓
OpenCodeProxy.createMessage()
   ↓
Construct HTTP request manually
   ↓
http.request() to OpenCode
   ↓ Network
OpenCode Server receives POST /session/:id/message
   ↓
Agent processes message
   ↓
OpenCode emits SSE message.created
   ↓ SSE connection
OpenCodeProxy receives SSE data
   ↓
eventsource-parser parses event
   ↓
handleSSEEvent() routes by type
   ↓
client.onMessageEvent() [RPC callback - serialization]
   ↓ WebSocket
Frontend OpenCodeSyncService.onMessageEvent() [deserialization]
   ↓
SessionService.updateMessage()
   ↓
UI updates via observable

Total hops: 12
Total serialization/deserialization: 4
```

### With SDK Backend (Option 1)

```
User types "Hello"
   ↓
UI Component captures input
   ↓
SessionService.sendMessage(parts)
   ↓
OpenCodeService.createMessage() [RPC call]
   ↓ WebSocket
Backend RPC Handler
   ↓
OpenCodeSDKAdapter.createMessage()
   ↓
client.message.create() [SDK handles HTTP]
   ↓ Network (fetch API)
OpenCode Server receives POST /session/:id/message
   ↓
Agent processes message
   ↓
OpenCode emits SSE message.created
   ↓ SSE connection (SDK handles)
SDK streams event
   ↓
Adapter forwards to RPC client [RPC callback]
   ↓ WebSocket
Frontend OpenCodeSyncService.onMessageEvent()
   ↓
SessionService.updateMessage()
   ↓
UI updates

Total hops: 9 (-3)
SDK handles: HTTP construction, error handling, SSE parsing
```

### With Frontend Direct (Option 2)

```
User types "Hello"
   ↓
UI Component captures input
   ↓
OpenCodeFrontendService.createMessage()
   ↓
client.message.create() [SDK in browser]
   ↓ Network (fetch API)
OpenCode Server receives POST /session/:id/message
   ↓
Agent processes message
   ↓
OpenCode emits SSE message.created
   ↓ SSE connection (SDK in browser)
SDK streams event
   ↓
Callback to UI handler
   ↓
UI updates

Total hops: 5 (-7)
No RPC serialization
```

---

## Code Complexity Comparison

### Current Implementation
```
File: opencode-proxy.ts
Lines: ~600
- makeRequest(): 60 lines
- getProjects(): 30 lines
- createSession(): 30 lines
- createMessage(): 30 lines
- connectSSE(): 80 lines
- handleSSEEvent(): 100 lines
- scheduleReconnect(): 40 lines
- ... 10 more REST methods
```

### With SDK Backend
```
File: opencode-sdk-adapter.ts
Lines: ~150
- getProjects(): 5 lines (await client.project.list())
- createSession(): 5 lines (await client.session.create())
- createMessage(): 5 lines (await client.message.create())
- subscribeToEvents(): 10 lines (for await event loop)
- Type adapters: 50 lines
```

**Code Reduction: 75%**

---

## Summary

| Metric | Current | SDK Backend | Frontend Direct |
|--------|---------|-------------|-----------------|
| **Total Lines** | ~600 | ~150 | ~100 |
| **HTTP Code** | Manual | SDK | SDK |
| **SSE Code** | Manual | SDK | SDK |
| **RPC Hops** | 12 | 9 | 5 |
| **Type Safety** | Manual | ✅ OpenAPI | ✅ OpenAPI |
| **Maintainability** | Low | High | Medium |
| **CORS Required** | No | No | Yes |
| **Theia-native** | Yes | Yes | No |

**Recommendation:** **SDK Backend** offers the best balance of simplicity, type safety, and compatibility with Theia architecture.
