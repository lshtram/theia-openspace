# Implementation Guide: Migrating to OpenCode SDK

## Overview

This guide provides step-by-step instructions for migrating from the custom HTTP client implementation to the OpenCode SDK in the backend.

## Prerequisites

- Node.js >= 18.0.0
- Yarn >= 1.7.0
- Current build passes: `yarn build`
- Current tests pass: `yarn test`

## Migration Strategy

**Approach:** Incremental migration with backward compatibility

1. Add SDK as dependency
2. Create adapter alongside existing proxy
3. Switch DI binding to use adapter
4. Test thoroughly
5. Remove old proxy code
6. Update documentation

**Timeline:** 1 week for full migration

---

## Phase 1: Add SDK Dependency (Day 1, Morning)

### 1.1 Install SDK

```bash
cd /path/to/theia-openspace
yarn add @opencode-ai/sdk
```

### 1.2 Verify Installation

```bash
# Check package.json
grep "@opencode-ai/sdk" package.json

# Build to ensure no conflicts
yarn build:extensions
```

### 1.3 Explore SDK Types

Create a test file to explore the SDK:

```typescript
// /tmp/sdk-exploration.ts
import { createOpencodeClient } from '@opencode-ai/sdk';

const client = createOpencodeClient({
  baseUrl: 'http://localhost:7890'
});

// Check available methods
console.log(Object.keys(client));
// Expected: ['project', 'session', 'message', 'file', 'agent', 'provider', 'health']

// Check project methods
console.log(Object.keys(client.project));
// Expected: ['list', 'get', 'init', ...]

// Check types
type ProjectListResponse = Awaited<ReturnType<typeof client.project.list>>;
```

Run with:
```bash
npx ts-node /tmp/sdk-exploration.ts
```

---

## Phase 2: Create SDK Adapter (Day 1, Afternoon - Day 2)

### 2.1 Create Adapter File

**File:** `extensions/openspace-core/src/node/opencode-sdk-adapter.ts`

```typescript
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// [... license header ...]
// *****************************************************************************

import { inject, injectable, postConstruct } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import { createOpencodeClient } from '@opencode-ai/sdk';
import {
    OpenCodeService,
    OpenCodeClient,
    Project,
    Session,
    Message,
    MessageWithParts,
    MessagePart,
    FileStatus,
    FileContent,
    Agent,
    Provider,
    AppConfig,
    SessionNotification,
    MessageNotification,
    FileNotification,
    PermissionNotification
} from '../common/opencode-protocol';
import { OpenCodeServerUrl, DEFAULT_OPENCODE_URL } from './opencode-proxy';

/**
 * OpenCodeSDKAdapter - Backend adapter using @opencode-ai/sdk.
 * Implements the OpenCodeService interface using the official SDK.
 */
@injectable()
export class OpenCodeSDKAdapter implements OpenCodeService {

    @inject(ILogger)
    protected readonly logger!: ILogger;

    @inject(OpenCodeServerUrl)
    protected readonly serverUrl!: string;

    protected _client: OpenCodeClient | undefined = undefined;
    protected sdkClient: ReturnType<typeof createOpencodeClient> | undefined;
    protected isDisposed: boolean = false;
    protected eventStreamAbortController: AbortController | undefined;

    @postConstruct()
    init(): void {
        this.logger.info(`[OpenCodeSDKAdapter] Initializing with server URL: ${this.serverUrl}`);
        
        try {
            this.sdkClient = createOpencodeClient({
                baseUrl: this.serverUrl,
                // Optional: customize fetch behavior
                fetch: globalThis.fetch,
            });
            this.logger.info('[OpenCodeSDKAdapter] SDK client created successfully');
        } catch (error) {
            this.logger.error('[OpenCodeSDKAdapter] Failed to create SDK client:', error);
        }
    }

    /**
     * Set the RPC client for callbacks.
     */
    setClient(client: OpenCodeClient): void {
        this._client = client;
        this.logger.info('[OpenCodeSDKAdapter] RPC client set');
    }

    /**
     * Projects
     */
    async getProjects(): Promise<Project[]> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        try {
            const response = await this.sdkClient.project.list();
            return response.data || [];
        } catch (error) {
            this.logger.error('[OpenCodeSDKAdapter] getProjects failed:', error);
            return [];
        }
    }

    async initProject(path: string, name: string): Promise<Project> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.project.init({
            body: { path, name }
        });
        return response.data;
    }

    /**
     * Sessions
     */
    async getSessions(projectId: string): Promise<Session[]> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.session.list({
            query: { projectId }
        });
        return response.data || [];
    }

    async getSession(sessionId: string): Promise<Session> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.session.get({
            path: { id: sessionId }
        });
        return response.data;
    }

    async createSession(projectId: string, title: string, parentID?: string): Promise<Session> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.session.create({
            body: { projectId, title, parentID }
        });
        return response.data;
    }

    async deleteSession(sessionId: string): Promise<void> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        await this.sdkClient.session.delete({
            path: { id: sessionId }
        });
    }

    async initSession(projectId: string, sessionId: string): Promise<void> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        this.logger.info(`[OpenCodeSDKAdapter] Initializing session ${sessionId} for project ${projectId}`);
        
        // Start event stream in background
        this.startEventStream(sessionId);
    }

    /**
     * Messages
     */
    async getMessages(sessionId: string): Promise<MessageWithParts[]> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.message.list({
            path: { sessionId }
        });
        return response.data || [];
    }

    async createMessage(sessionId: string, parts: MessagePart[]): Promise<Message> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.message.create({
            path: { sessionId },
            body: { role: 'user', parts }
        });
        return response.data;
    }

    /**
     * Files
     */
    async findFiles(projectId: string, pattern: string): Promise<string[]> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        // Note: SDK may not have this endpoint - check documentation
        // Placeholder implementation
        this.logger.warn('[OpenCodeSDKAdapter] findFiles not yet implemented in SDK');
        return [];
    }

    async getFile(projectId: string, path: string): Promise<FileContent> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.file.get({
            query: { projectId, path }
        });
        return response.data;
    }

    async getFileStatus(projectId: string, path: string): Promise<FileStatus> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.file.status({
            query: { projectId, path }
        });
        return response.data;
    }

    /**
     * Config
     */
    async getAgent(): Promise<Agent> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.config.agent();
        return response.data;
    }

    async getProvider(): Promise<Provider> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.config.provider();
        return response.data;
    }

    async getConfig(): Promise<AppConfig> {
        if (!this.sdkClient) {
            throw new Error('SDK client not initialized');
        }

        const response = await this.sdkClient.config.get();
        return response.data;
    }

    /**
     * Event Streaming (SSE)
     */
    private async startEventStream(sessionId: string): Promise<void> {
        if (!this.sdkClient || !this._client) {
            this.logger.warn('[OpenCodeSDKAdapter] Cannot start event stream - missing client');
            return;
        }

        // Cancel previous stream if exists
        if (this.eventStreamAbortController) {
            this.eventStreamAbortController.abort();
        }

        this.eventStreamAbortController = new AbortController();

        try {
            const stream = await this.sdkClient.session.stream({
                path: { id: sessionId },
                // signal: this.eventStreamAbortController.signal // if SDK supports abort
            });

            this.logger.info(`[OpenCodeSDKAdapter] Event stream started for session ${sessionId}`);

            // Process events asynchronously
            (async () => {
                try {
                    for await (const event of stream) {
                        if (this.isDisposed) {
                            break;
                        }

                        this.handleEvent(event);
                    }
                } catch (error) {
                    if (!this.isDisposed) {
                        this.logger.error('[OpenCodeSDKAdapter] Event stream error:', error);
                        // Auto-reconnect after delay
                        setTimeout(() => this.startEventStream(sessionId), 5000);
                    }
                }
            })();

        } catch (error) {
            this.logger.error('[OpenCodeSDKAdapter] Failed to start event stream:', error);
            // Retry after delay
            if (!this.isDisposed) {
                setTimeout(() => this.startEventStream(sessionId), 5000);
            }
        }
    }

    private handleEvent(event: any): void {
        if (!this._client) {
            return;
        }

        // Route events by type
        const eventType = event.type || event.event;

        if (eventType?.startsWith('session.')) {
            this._client.onSessionEvent(event as SessionNotification);
        } else if (eventType?.startsWith('message.')) {
            this._client.onMessageEvent(event as MessageNotification);
        } else if (eventType?.startsWith('file.')) {
            this._client.onFileEvent(event as FileNotification);
        } else if (eventType?.startsWith('permission.')) {
            this._client.onPermissionEvent(event as PermissionNotification);
        } else {
            this.logger.warn(`[OpenCodeSDKAdapter] Unknown event type: ${eventType}`);
        }
    }

    /**
     * Cleanup
     */
    dispose(): void {
        this.logger.info('[OpenCodeSDKAdapter] Disposing');
        this.isDisposed = true;

        if (this.eventStreamAbortController) {
            this.eventStreamAbortController.abort();
        }
    }
}
```

### 2.2 Update Exports

**File:** `extensions/openspace-core/src/node/openspace-core-backend-module.ts`

```typescript
// Add import
import { OpenCodeSDKAdapter } from './opencode-sdk-adapter';

// Keep both for now (testing)
// Later we'll remove OpenCodeProxy binding

// Comment out old binding temporarily
// bind(OpenCodeService).to(OpenCodeProxy).inSingletonScope();

// Add new binding
bind(OpenCodeService).to(OpenCodeSDKAdapter).inSingletonScope();
```

---

## Phase 3: Testing (Day 3-4)

### 3.1 Unit Tests

**File:** `extensions/openspace-core/src/node/opencode-sdk-adapter.spec.ts`

```typescript
import { expect } from 'chai';
import { Container } from '@theia/core/shared/inversify';
import { ILogger } from '@theia/core/lib/common/logger';
import { OpenCodeSDKAdapter } from './opencode-sdk-adapter';
import { OpenCodeServerUrl } from './opencode-proxy';

describe('OpenCodeSDKAdapter', () => {
    let adapter: OpenCodeSDKAdapter;
    let container: Container;

    beforeEach(() => {
        container = new Container();
        container.bind(OpenCodeServerUrl).toConstantValue('http://localhost:7890');
        container.bind(ILogger).toConstantValue({
            info: () => {},
            warn: () => {},
            error: () => {},
        } as any);
        container.bind(OpenCodeSDKAdapter).toSelf().inSingletonScope();
        
        adapter = container.get(OpenCodeSDKAdapter);
    });

    it('should initialize successfully', () => {
        expect(adapter).to.exist;
    });

    it('should have sdkClient after init', () => {
        // @ts-ignore - access private for testing
        expect(adapter.sdkClient).to.exist;
    });

    // Add more tests for each method
    // Note: These require mocking or a running OpenCode server
});
```

### 3.2 Integration Tests

```bash
# Start OpenCode server (if available)
# opencode serve --port 7890

# Run tests
yarn test:unit

# Check specific test file
yarn test extensions/openspace-core/src/node/opencode-sdk-adapter.spec.ts
```

### 3.3 Manual Testing

```bash
# Build
yarn build:extensions
yarn build:browser

# Start application
yarn start:browser

# Open browser: http://localhost:3000

# Test checklist:
# [ ] Application loads
# [ ] Can see projects
# [ ] Can create session
# [ ] Can send message
# [ ] Receives streaming response
# [ ] Chat history displays correctly
# [ ] No errors in console
# [ ] SSE connection stable (check Network tab)
```

### 3.4 Compare Logs

**Old Implementation:**
```
[OpenCodeProxy] Initialized with server URL: http://localhost:7890
[OpenCodeProxy] Making request: GET /project
[OpenCodeProxy] Response received: 200
[OpenCodeProxy] SSE connection established
```

**New Implementation:**
```
[OpenCodeSDKAdapter] Initializing with server URL: http://localhost:7890
[OpenCodeSDKAdapter] SDK client created successfully
[OpenCodeSDKAdapter] Event stream started for session xyz
```

Look for:
- ✅ No errors during startup
- ✅ Successful API calls
- ✅ Event stream connections
- ✅ Message streaming working

---

## Phase 4: Cleanup (Day 5)

### 4.1 Remove Old Proxy (After Full Testing)

```bash
# Backup first
cp extensions/openspace-core/src/node/opencode-proxy.ts /tmp/opencode-proxy.ts.backup

# Remove file
rm extensions/openspace-core/src/node/opencode-proxy.ts
rm extensions/openspace-core/src/node/opencode-proxy.spec.ts # if exists
```

### 4.2 Update Imports

Search and replace across codebase:
```bash
# Find any remaining imports
grep -r "opencode-proxy" extensions/openspace-core/src

# Update to use adapter (if any direct imports exist)
```

### 4.3 Update Documentation

Update these files:
- `README.md` - Mention SDK usage
- `docs/ARCHITECTURE.md` - Update diagrams
- `STARTUP_INSTRUCTIONS.md` - Update if needed
- `package.json` - Ensure @opencode-ai/sdk is listed

### 4.4 Final Build and Test

```bash
yarn clean
yarn install
yarn build
yarn test
```

---

## Phase 5: Verification (Day 5)

### 5.1 Code Review Checklist

- [ ] SDK dependency added to package.json
- [ ] Adapter implements all OpenCodeService methods
- [ ] Event streaming works correctly
- [ ] Error handling is appropriate
- [ ] Logging is consistent
- [ ] Tests pass
- [ ] No TypeScript errors
- [ ] Documentation updated

### 5.2 Performance Check

```bash
# Measure startup time
time yarn start:browser

# Compare with old implementation (from logs)
# Old: ~3-5 seconds
# New: Should be similar or faster
```

### 5.3 Bundle Size Check

```bash
# Check browser-app bundle size
ls -lh browser-app/lib/

# SDK adds ~50KB - acceptable tradeoff
```

---

## Troubleshooting

### Issue: SDK Client Not Initialized

**Symptom:** `Error: SDK client not initialized`

**Solution:**
1. Check that `@postConstruct init()` is being called
2. Verify DI bindings are correct
3. Add debug logging to init method

### Issue: Type Mismatches

**Symptom:** TypeScript errors about incompatible types

**Solution:**
1. SDK types may differ slightly from our interfaces
2. Add type adapters/converters as needed
3. Check SDK version compatibility

```typescript
// Example adapter
function adaptProject(sdkProject: any): Project {
    return {
        id: sdkProject.id,
        name: sdkProject.name,
        path: sdkProject.path,
    };
}
```

### Issue: Event Stream Disconnects

**Symptom:** Events stop arriving after a while

**Solution:**
1. Check SDK auto-reconnection behavior
2. Add manual reconnection logic if needed
3. Monitor network tab for connection status

### Issue: CORS Errors (if testing frontend direct)

**Symptom:** `CORS policy: No 'Access-Control-Allow-Origin' header`

**Solution:**
1. This is expected - SDK backend avoids CORS
2. If doing frontend direct, configure OpenCode server CORS
3. Or stick with backend SDK approach

---

## Rollback Plan

If critical issues arise:

### Quick Rollback

```bash
# 1. Restore old proxy
cp /tmp/opencode-proxy.ts.backup extensions/openspace-core/src/node/opencode-proxy.ts

# 2. Update DI binding
# In openspace-core-backend-module.ts:
bind(OpenCodeService).to(OpenCodeProxy).inSingletonScope();
// Remove: bind(OpenCodeService).to(OpenCodeSDKAdapter).inSingletonScope();

# 3. Rebuild
yarn build:extensions
yarn build:browser

# 4. Test
yarn start:browser
```

### Keep Both (Fallback Strategy)

```typescript
// In backend module:
const USE_SDK = process.env.OPENCODE_USE_SDK === 'true';

if (USE_SDK) {
    bind(OpenCodeService).to(OpenCodeSDKAdapter).inSingletonScope();
} else {
    bind(OpenCodeService).to(OpenCodeProxy).inSingletonScope();
}
```

This allows toggling via environment variable.

---

## Success Criteria

The migration is successful when:

- ✅ All tests pass
- ✅ Application starts without errors
- ✅ Can perform all operations (create session, send message, etc.)
- ✅ Event streaming works reliably
- ✅ No performance regression
- ✅ Code is cleaner and more maintainable
- ✅ Documentation is updated

---

## Estimated Time Breakdown

| Phase | Task | Time |
|-------|------|------|
| 1 | Install SDK and explore | 2 hours |
| 2 | Create adapter | 1 day |
| 2 | Wire up DI bindings | 2 hours |
| 3 | Write unit tests | 4 hours |
| 3 | Integration testing | 4 hours |
| 3 | Manual testing | 4 hours |
| 4 | Remove old code | 2 hours |
| 4 | Update documentation | 2 hours |
| 5 | Final verification | 2 hours |
| **Total** | | **5 days** |

With buffer: **1 week**

---

## Next Steps After Migration

1. **Monitor in Production**
   - Watch for any issues
   - Collect performance metrics
   - Gather user feedback

2. **Optimize Further**
   - Cache frequently accessed data
   - Implement request deduplication
   - Add connection pooling if needed

3. **Extend Functionality**
   - Add more OpenCode features
   - Improve error messages
   - Add retry logic for transient failures

4. **Documentation**
   - Write developer guide
   - Create architecture diagrams
   - Document best practices

---

## Resources

- [OpenCode SDK Documentation](https://opencode.ai/docs/sdk/)
- [OpenCode Server API](https://opencode.ai/docs/server/)
- [Theia DI Documentation](https://theia-ide.org/docs/dependency_injection/)
- Current implementation: `extensions/openspace-core/src/node/opencode-proxy.ts`

---

**Document Version:** 1.0  
**Last Updated:** February 17, 2026  
**Status:** Ready for Implementation
