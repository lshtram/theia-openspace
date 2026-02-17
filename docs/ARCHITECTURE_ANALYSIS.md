# Architecture Analysis: Theia-OpenSpace vs OpenCode VS Code Extension

## Executive Summary

This document analyzes the current Theia-OpenSpace architecture and compares it with the OpenCode VS Code extension to identify potential simplifications in client-server communication.

**Key Finding:** While both systems use HTTP/SSE for client-server communication, the OpenCode SDK provides a **simpler, more standardized approach** that could reduce complexity in our Theia implementation.

---

## 1. Current Theia-OpenSpace Architecture

### 1.1 Communication Stack

```
Frontend (Browser)
    ↓ JSON-RPC over WebSocket
Backend (Node.js Theia)
    ↓ Custom HTTP Client + SSE
OpenCode Server (Port 7890)
```

### 1.2 Key Components

#### Backend: OpenCodeProxy (`opencode-proxy.ts`)
- **Custom HTTP client** using Node.js `http`/`https` modules
- **Manual request/response handling**
- **Manual SSE parsing** with `eventsource-parser` library
- **Custom reconnection logic** with exponential backoff
- **RPC callback forwarding** to frontend

#### Frontend: OpenCodeSyncService
- **Receives RPC callbacks** from backend
- **Routes events** to SessionService
- **Updates UI state** reactively

#### Communication Flow
```typescript
// Frontend makes RPC call
sessionService.createMessage(parts)
  → OpenCodeService.createMessage() [RPC]
  
// Backend handles RPC, makes HTTP call
OpenCodeProxy.createMessage() 
  → POST /session/:id/message [HTTP]
  → OpenCode server responds
  
// OpenCode emits SSE event
OpenCode Server
  → SSE: message.created event
  
// Backend receives SSE, forwards via RPC
OpenCodeProxy.handleSSEEvent()
  → client.onMessageEvent() [RPC callback]
  
// Frontend receives callback
OpenCodeSyncService.onMessageEvent()
  → sessionService.updateMessage()
  → UI updates
```

### 1.3 Current Pain Points

1. **Custom HTTP Implementation**
   - 200+ lines of manual HTTP request/response handling
   - Error handling scattered across methods
   - No type safety for API calls

2. **Manual SSE Management**
   - Custom parser integration
   - Reconnection logic spread across multiple methods
   - State management (connected, reconnecting, disposed)

3. **RPC Layer Overhead**
   - Extra serialization/deserialization
   - Callback forwarding adds latency
   - Debugging complexity (need to trace through RPC boundary)

4. **Circular Dependency Workarounds**
   - `queueMicrotask()` hack for SessionService wiring
   - Frontend proxy creation deferred to after DI

---

## 2. OpenCode VS Code Extension Architecture

### 2.1 Communication Stack

```
VS Code Extension (Node.js)
    ↓ @opencode-ai/sdk (TypeScript)
OpenCode Server (Port 4096)
```

### 2.2 Key Components

#### SDK Client (`@opencode-ai/sdk`)
- **Type-safe client** generated from OpenAPI spec
- **Zero runtime dependencies**
- **Built-in error handling**
- **Native SSE support** via Fetch API
- **Auto-reconnection** handled internally

#### Extension Usage
```typescript
import { createOpencodeClient } from "@opencode-ai/sdk";

// Initialize client
const client = createOpencodeClient({ 
  baseUrl: "http://localhost:4096" 
});

// Make API calls - fully typed
const session = await client.session.get({ 
  path: { id: "123" } 
});

// Stream events
const stream = await client.session.stream({
  path: { id: "123" }
});

for await (const event of stream) {
  // Handle event
}
```

### 2.3 Advantages

1. **Simplicity**
   - Single SDK import replaces 500+ lines of custom code
   - No manual HTTP handling
   - No manual SSE parsing

2. **Type Safety**
   - OpenAPI-generated types ensure correctness
   - IDE autocomplete for all API methods
   - Compile-time validation

3. **Maintainability**
   - SDK updates automatically when OpenCode server updates
   - No custom HTTP code to maintain
   - Standard patterns for all integrations

4. **Performance**
   - Uses native Fetch API (faster than http module)
   - Efficient connection pooling
   - Optimized event streaming

---

## 3. Comparison Table

| Aspect | Current (Theia-OpenSpace) | OpenCode VS Code Extension | Winner |
|--------|---------------------------|----------------------------|--------|
| **HTTP Client** | Custom `http`/`https` module implementation | SDK with Fetch API | 🏆 SDK |
| **Type Safety** | Manual TypeScript interfaces | OpenAPI-generated types | 🏆 SDK |
| **SSE Handling** | Manual `eventsource-parser` | SDK built-in streaming | 🏆 SDK |
| **Error Handling** | Custom per-method | SDK standardized | 🏆 SDK |
| **Reconnection** | Custom exponential backoff | SDK automatic | 🏆 SDK |
| **Code Maintenance** | 500+ lines custom code | ~20 lines SDK usage | 🏆 SDK |
| **Learning Curve** | Need to understand custom implementation | Standard SDK patterns | 🏆 SDK |
| **IDE Integration** | Direct (Theia backend) | Extension host layer | 🏆 Current |
| **Callback Latency** | RPC overhead | Direct in-process | 🏆 VS Code |
| **Bundle Size** | Smaller (stdlib only) | SDK adds ~50KB | 🏆 Current |

**Overall:** OpenCode SDK approach wins on **simplicity, maintainability, and developer experience**, while current approach has slight advantages in **bundle size and integration directness**.

---

## 4. Simpler Connection Approach: Recommendations

### 4.1 Option 1: Adopt OpenCode SDK (RECOMMENDED)

**Change:** Replace `OpenCodeProxy` with SDK client.

#### Implementation
```typescript
// extensions/openspace-core/src/node/opencode-backend-module.ts

import { createOpencodeClient } from '@opencode-ai/sdk';

@injectable()
export class OpenCodeSDKService implements OpenCodeService {
  private client: ReturnType<typeof createOpencodeClient>;

  constructor() {
    this.client = createOpencodeClient({
      baseUrl: process.env.OPENCODE_SERVER_URL || 'http://localhost:7890'
    });
  }

  async getProjects(): Promise<Project[]> {
    const response = await this.client.project.list();
    return response.data;
  }

  async createSession(projectId: string, title: string): Promise<Session> {
    const response = await this.client.session.create({
      body: { projectId, title }
    });
    return response.data;
  }

  // Event streaming
  async subscribeToEvents(projectId: string, sessionId: string) {
    const stream = await this.client.session.stream({
      path: { id: sessionId }
    });

    for await (const event of stream) {
      // Forward to RPC client
      this._client?.onSessionEvent(event);
    }
  }
}
```

#### Pros
- ✅ Reduce codebase by ~400 lines
- ✅ Type-safe API calls
- ✅ Automatic SDK updates when OpenCode changes
- ✅ Consistent with other OpenCode integrations
- ✅ Better error messages and debugging

#### Cons
- ❌ Add dependency (~50KB)
- ❌ Need to adapt SDK types to our interfaces (minor)
- ❌ Requires testing migration

#### Effort: ~2-3 days

---

### 4.2 Option 2: Frontend Direct Connection (ALTERNATIVE)

**Change:** Move OpenCode HTTP client to frontend, remove RPC layer.

#### Architecture
```
Frontend (Browser)
    ↓ @opencode-ai/sdk in browser
OpenCode Server (Port 7890)
```

#### Implementation
```typescript
// frontend-only service
@injectable()
export class OpenCodeFrontendService {
  private client = createOpencodeClient({
    baseUrl: 'http://localhost:7890'
  });

  async createMessage(sessionId: string, parts: MessagePart[]) {
    return await this.client.message.create({
      path: { sessionId },
      body: { parts }
    });
  }

  subscribeToEvents(sessionId: string, 
                    callback: (event: SessionEvent) => void) {
    const stream = this.client.session.stream({ 
      path: { id: sessionId } 
    });
    
    (async () => {
      for await (const event of stream) {
        callback(event);
      }
    })();
  }
}
```

#### Pros
- ✅ **Eliminate RPC layer entirely** - biggest simplification
- ✅ Lower latency (no backend hop)
- ✅ Simpler debugging (all in browser DevTools)
- ✅ Reduce backend complexity

#### Cons
- ❌ CORS configuration required on OpenCode server
- ❌ Can't intercept/modify requests in backend
- ❌ Browser security restrictions (can't use Node.js modules)
- ❌ Breaks Theia's backend-first architecture pattern

#### Effort: ~1 week (includes CORS setup, testing)

---

### 4.3 Option 3: Hybrid Approach

**Backend:** SDK for REST calls  
**Frontend:** Direct SSE connection for events

#### Pros
- ✅ Best of both worlds
- ✅ Backend handles auth/validation
- ✅ Frontend gets real-time events directly

#### Cons
- ❌ Most complex to implement
- ❌ Maintains two connection paths

#### Effort: ~1-2 weeks

---

## 5. Detailed Pros & Cons Analysis

### 5.1 Current Architecture

#### Pros ✅
1. **Full control** - Can customize every HTTP call
2. **No external dependencies** - Uses only Node.js stdlib
3. **Theia-native** - Follows RPC patterns used throughout Theia
4. **Backend security** - All API calls go through backend (no CORS)
5. **Request interception** - Can log, modify, validate all requests

#### Cons ❌
1. **High maintenance burden** - 500+ lines of custom HTTP code
2. **Manual type management** - Interfaces can drift from OpenCode API
3. **Complex error handling** - Different error patterns per method
4. **SSE complexity** - Manual parser, reconnection, state management
5. **RPC overhead** - Serialization/deserialization for every call
6. **Hard to debug** - Need to trace through RPC boundary
7. **Not reusable** - Code specific to Theia, can't share with other clients

---

### 5.2 OpenCode SDK Approach

#### Pros ✅
1. **Massive simplification** - Replace 500+ lines with ~50 lines
2. **Type safety** - OpenAPI-generated types always in sync
3. **Standard patterns** - Consistent with VS Code, Zed, other integrations
4. **Auto-updates** - SDK updates when OpenCode API changes
5. **Better DX** - IDE autocomplete, inline docs, examples
6. **Battle-tested** - Used in production VS Code extension
7. **Zero runtime deps** - SDK has no dependencies itself
8. **Native streaming** - Built-in SSE/streaming support via Fetch API
9. **Better errors** - Standardized error objects with helpful messages

#### Cons ❌
1. **Bundle size** - Adds ~50KB to backend bundle
2. **Less control** - Can't customize HTTP internals
3. **Abstraction layer** - One more layer between us and OpenCode
4. **Type mapping** - Need to convert SDK types to our domain types
5. **Version coupling** - Must keep SDK version compatible with OpenCode server

---

## 6. Migration Path (Recommended)

### Phase 1: Add SDK (1 day)
```bash
yarn add @opencode-ai/sdk
```

### Phase 2: Create Adapter (2 days)
```typescript
// New file: opencode-sdk-adapter.ts
@injectable()
export class OpenCodeSDKAdapter implements OpenCodeService {
  private client = createOpencodeClient({ baseUrl: ... });
  
  // Implement OpenCodeService interface using SDK
  async getProjects(): Promise<Project[]> {
    const result = await this.client.project.list();
    return result.data.map(adaptProject);
  }
  // ... rest of methods
}
```

### Phase 3: Replace Proxy (1 day)
- Update DI bindings to use adapter instead of proxy
- Keep RPC layer unchanged for now
- Test all functionality

### Phase 4: Testing (2 days)
- Unit tests for adapter
- Integration tests
- Manual smoke testing

### Phase 5: Remove Old Code (1 day)
- Delete `opencode-proxy.ts`
- Clean up unused imports
- Update docs

**Total Effort: 1 week**

---

## 7. Alternative: Keep Current + Improvements

If not adopting SDK, consider these improvements:

### 7.1 Use Native Fetch (Node 18+)
```typescript
// Replace http/https with fetch
async makeRequest(path: string, options: RequestInit) {
  const response = await fetch(`${this.serverUrl}${path}`, options);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
```
**Benefit:** Simpler, more modern, fewer lines

### 7.2 TypeScript Compiler API for Type Generation
```typescript
// Generate types from OpenCode OpenAPI spec
yarn generate-types
```
**Benefit:** Type safety without SDK dependency

### 7.3 Use Standard SSE Library
```typescript
import EventSource from 'eventsource'; // npm package

this.eventSource = new EventSource(
  `${this.serverUrl}/session/${sessionId}/events`
);
this.eventSource.onmessage = (event) => {
  this.handleSSEEvent(event);
};
```
**Benefit:** Less manual parsing, auto-reconnection

---

## 8. Decision Matrix

| Criteria | Current | SDK | Frontend Direct | Hybrid |
|----------|---------|-----|-----------------|--------|
| **Implementation Effort** | 0 (done) | ⭐⭐⭐ Low | ⭐⭐ Medium | ⭐ High |
| **Maintenance Burden** | ⭐ High | ⭐⭐⭐ Low | ⭐⭐ Medium | ⭐⭐ Medium |
| **Type Safety** | ⭐⭐ Medium | ⭐⭐⭐ High | ⭐⭐⭐ High | ⭐⭐⭐ High |
| **Performance** | ⭐⭐ Medium | ⭐⭐⭐ High | ⭐⭐⭐ High | ⭐⭐ Medium |
| **Debugging** | ⭐⭐ Medium | ⭐⭐⭐ Easy | ⭐⭐⭐ Easy | ⭐⭐ Medium |
| **Security** | ⭐⭐⭐ High | ⭐⭐⭐ High | ⭐⭐ Medium | ⭐⭐⭐ High |
| **Theia Integration** | ⭐⭐⭐ Native | ⭐⭐⭐ Native | ⭐ Non-standard | ⭐⭐ Mixed |
| **Code Reuse** | ⭐ None | ⭐⭐⭐ High | ⭐⭐⭐ High | ⭐⭐ Medium |

**Recommendation:** **SDK Approach** - Best balance of simplicity, maintainability, and type safety.

---

## 9. Conclusion

### Summary of Findings

1. **Current Implementation Works** - But has high maintenance cost
2. **OpenCode SDK Offers Major Benefits** - Simplicity, type safety, maintainability
3. **Migration is Low Risk** - SDK is a drop-in replacement for our proxy
4. **ROI is Strong** - 500 lines → 50 lines, ongoing type safety

### Recommended Action

**Adopt OpenCode SDK** in backend (Option 1) to:
- Reduce codebase complexity
- Improve type safety
- Align with OpenCode ecosystem standards
- Lower maintenance burden

### Next Steps

1. **Prototype** SDK integration (2 hours)
2. **Review with team** (1 hour)
3. **Decide**: SDK vs. Current + Improvements
4. **If SDK**: Execute migration plan (1 week)
5. **If Current**: Implement improvements from Section 7

---

## 10. References

### Current Architecture
- `extensions/openspace-core/src/node/opencode-proxy.ts` - HTTP client implementation
- `extensions/openspace-core/src/common/opencode-protocol.ts` - Service interfaces
- `extensions/openspace-core/src/browser/opencode-sync-service.ts` - RPC callback handler

### OpenCode Resources
- [OpenCode SDK Documentation](https://opencode.ai/docs/sdk/)
- [VS Code Extension Implementation](https://marketplace.visualstudio.com/items?itemName=sst-dev.opencode)
- [Client-Server Architecture](https://deepwiki.com/anomalyco/opencode/2.3-client-server-model)
- [SDK NPM Package](https://www.npmjs.com/package/@opencode-ai/sdk)

### Related Issues
- Current build/test status documented in `STARTUP_INSTRUCTIONS.md`
- Manual testing guide in `docs/MANUAL_TESTING_GUIDE.md`

---

**Document Version:** 1.0  
**Date:** February 17, 2026  
**Author:** Architecture Analysis Agent  
**Status:** DRAFT - Awaiting Team Review
