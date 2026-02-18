# SSE Event Forwarding Usage Example

## Overview
This document demonstrates how to use the SSE Event Forwarding feature implemented in Task 1.3.

## Basic Usage

### 1. Set Up Client Callbacks

First, implement the `OpenCodeClient` interface to receive events:

```typescript
import { OpenCodeClient, SessionNotification, MessageNotification, FileNotification, PermissionNotification } from '../common/opencode-protocol';

class MyOpenCodeClient implements OpenCodeClient {
    onSessionEvent(event: SessionNotification): void {
        console.log('Session event received:', event.type, event.sessionId);
        
        switch (event.type) {
            case 'created':
                console.log('New session created:', event.data);
                break;
            case 'updated':
                console.log('Session updated:', event.data);
                break;
            case 'deleted':
                console.log('Session deleted');
                break;
            case 'init_started':
                console.log('Session initialization started');
                break;
            case 'init_completed':
                console.log('Session initialization completed');
                break;
            // ... handle other session event types
        }
    }

    onMessageEvent(event: MessageNotification): void {
        console.log('Message event received:', event.type, event.messageId);
        
        switch (event.type) {
            case 'created':
                console.log('New message created:', event.data);
                break;
            case 'partial':
                console.log('Message part received (streaming):', event.data);
                // Update UI with streaming content
                break;
            case 'completed':
                console.log('Message completed:', event.data);
                break;
        }
    }

    onFileEvent(event: FileNotification): void {
        console.log('File event received:', event.type, event.path);
        
        switch (event.type) {
            case 'changed':
                console.log('File changed:', event.path);
                // Refresh file tree or editor
                break;
            case 'saved':
                console.log('File saved:', event.path);
                break;
            case 'reset':
                console.log('File reset:', event.path);
                break;
        }
    }

    onPermissionEvent(event: PermissionNotification): void {
        console.log('Permission event received:', event.type, event.permissionId);
        
        switch (event.type) {
            case 'requested':
                console.log('Permission requested:', event.permission);
                // Show permission dialog to user
                this.showPermissionDialog(event.permission);
                break;
            case 'granted':
                console.log('Permission granted:', event.permissionId);
                break;
            case 'denied':
                console.log('Permission denied:', event.permissionId);
                break;
        }
    }

    private showPermissionDialog(permission: any): void {
        // Implementation to show permission UI
    }
}
```

### 2. Connect SSE Stream

After creating a session, connect to its SSE stream:

```typescript
// Assuming you have an OpenCodeProxy instance
const proxy: OpenCodeProxy = ... // obtained via dependency injection

// Create and register client
const client = new MyOpenCodeClient();
proxy.setClient(client);

// Create a session
const session = await proxy.createSession(projectId, { title: 'My Session' });

// Connect to SSE stream for real-time events
proxy.connectSSE(projectId, session.id);

// Now all events from this session will be forwarded to your client
```

### 3. Handle Session Switching

When switching to a different session:

```typescript
async function switchSession(newProjectId: string, newSessionId: string): Promise<void> {
    // The old connection will be automatically closed
    proxy.connectSSE(newProjectId, newSessionId);
    
    // Events from the new session will now be received
}
```

### 4. Disconnect When Done

```typescript
// When user closes session or navigates away
proxy.disconnectSSE();

// Or on cleanup
proxy.dispose(); // Also disconnects SSE
```

## Advanced Usage

### Handling Connection State

Track connection state for UI feedback:

```typescript
class ConnectionAwareClient implements OpenCodeClient {
    private isConnected: boolean = false;

    onSessionEvent(event: SessionNotification): void {
        // If we're receiving events, connection is active
        this.isConnected = true;
        this.updateConnectionIndicator('connected');
        
        // ... handle event
    }

    // Similar for other event types
    
    onMessageEvent(event: MessageNotification): void { /* ... */ }
    onFileEvent(event: FileNotification): void { /* ... */ }
    onPermissionEvent(event: PermissionNotification): void { /* ... */ }

    handleConnectionLost(): void {
        this.isConnected = false;
        this.updateConnectionIndicator('reconnecting');
        
        // The proxy will automatically reconnect
        // Events will resume when connection is restored
    }

    private updateConnectionIndicator(status: 'connected' | 'reconnecting' | 'disconnected'): void {
        // Update UI to show connection status
    }
}
```

### Refetch State After Reconnection

Since events during disconnection are lost, refetch state when connection is restored:

```typescript
class SmartClient implements OpenCodeClient {
    private lastEventTime: number = Date.now();
    private reconnectThreshold: number = 5000; // 5 seconds

    onSessionEvent(event: SessionNotification): void {
        const now = Date.now();
        const timeSinceLastEvent = now - this.lastEventTime;
        
        if (timeSinceLastEvent > this.reconnectThreshold) {
            // Likely reconnected after disconnect, refetch state
            this.refetchSessionState();
        }
        
        this.lastEventTime = now;
        
        // ... handle event
    }

    // Similar for other event types
    
    onMessageEvent(event: MessageNotification): void { /* ... */ }
    onFileEvent(event: FileNotification): void { /* ... */ }
    onPermissionEvent(event: PermissionNotification): void { /* ... */ }

    private async refetchSessionState(): Promise<void> {
        // Refetch messages, file status, etc.
        const messages = await proxy.getMessages(projectId, sessionId);
        const fileStatus = await proxy.getFileStatus(projectId, sessionId);
        
        // Update UI with fresh state
    }
}
```

### Permission Auto-Accept Rules

Implement auto-accept logic for trusted operations:

```typescript
class PermissionHandler implements OpenCodeClient {
    private autoAcceptRules: Set<string> = new Set(['read', 'list']);

    onPermissionEvent(event: PermissionNotification): void {
        if (event.type === 'requested' && event.permission) {
            const permissionType = event.permission.type;
            
            if (this.autoAcceptRules.has(permissionType)) {
                // Auto-accept
                this.grantPermission(event.permissionId);
            } else {
                // Show dialog
                this.showPermissionDialog(event.permission);
            }
        }
    }

    // Other required methods
    onSessionEvent(event: SessionNotification): void { /* ... */ }
    onMessageEvent(event: MessageNotification): void { /* ... */ }
    onFileEvent(event: FileNotification): void { /* ... */ }

    private async grantPermission(permissionId: string): Promise<void> {
        await proxy.grantPermission(projectId, sessionId, permissionId);
    }

    private showPermissionDialog(permission: any): void {
        // Show UI for user approval
    }
}
```

## Error Handling Best Practices

### Graceful Degradation

```typescript
class RobustClient implements OpenCodeClient {
    onSessionEvent(event: SessionNotification): void {
        try {
            this.handleSessionEvent(event);
        } catch (error) {
            console.error('Error handling session event:', error);
            // Don't crash, just log
        }
    }

    onMessageEvent(event: MessageNotification): void {
        try {
            this.handleMessageEvent(event);
        } catch (error) {
            console.error('Error handling message event:', error);
        }
    }

    // Similar for other event types
    
    onFileEvent(event: FileNotification): void { /* ... */ }
    onPermissionEvent(event: PermissionNotification): void { /* ... */ }

    private handleSessionEvent(event: SessionNotification): void {
        // Implementation
    }

    private handleMessageEvent(event: MessageNotification): void {
        // Implementation
    }
}
```

## Debugging

Enable debug logging to track SSE events:

```typescript
// In your logger configuration
logger.setLogLevel('debug');

// You'll see logs like:
// [OpenCodeProxy] Connecting SSE for project proj-1, session sess-1
// [OpenCodeProxy] SSE connected to http://localhost:8080/project/proj-1/session/sess-1/events
// [OpenCodeProxy] SSE event: session.created
// [OpenCodeProxy] Forwarded session event: created
// [OpenCodeProxy] SSE event: message.streaming
// [OpenCodeProxy] Forwarded message event: partial
```

## Integration with Theia

### In a Theia Frontend Service

```typescript
import { injectable, inject } from '@theia/core/shared/inversify';
import { OpenCodeService, OpenCodeClient } from '@openspace/core/common/opencode-protocol';

@injectable()
export class SessionSyncService implements OpenCodeClient {
    
    @inject(OpenCodeService)
    protected readonly openCodeService!: OpenCodeService;

    async initialize(): Promise<void> {
        // Register as client
        this.openCodeService.setClient(this);
        
        // Connect to active session (if any)
        const activeSession = this.getActiveSession();
        if (activeSession) {
            this.openCodeService.connectSSE(activeSession.projectId, activeSession.id);
        }
    }

    onSessionEvent(event: SessionNotification): void {
        // Update session state
        this.updateSessionState(event);
    }

    onMessageEvent(event: MessageNotification): void {
        // Update message list
        this.updateMessages(event);
    }

    onFileEvent(event: FileNotification): void {
        // Refresh file tree
        this.refreshFileTree(event);
    }

    onPermissionEvent(event: PermissionNotification): void {
        // Show permission dialog
        this.handlePermission(event);
    }

    // Implementation methods
    private updateSessionState(event: SessionNotification): void { /* ... */ }
    private updateMessages(event: MessageNotification): void { /* ... */ }
    private refreshFileTree(event: FileNotification): void { /* ... */ }
    private handlePermission(event: PermissionNotification): void { /* ... */ }
    private getActiveSession(): any { /* ... */ }
}
```

## Performance Considerations

1. **Event Throttling**: For high-frequency events (like message.streaming), consider throttling UI updates:

```typescript
import { debounce } from 'lodash';

class ThrottledClient implements OpenCodeClient {
    private updateUI = debounce(() => {
        // Update UI
    }, 100); // Update at most every 100ms

    onMessageEvent(event: MessageNotification): void {
        if (event.type === 'partial') {
            // Store data but throttle UI update
            this.storePartialMessage(event);
            this.updateUI();
        } else {
            // For created/completed, update immediately
            this.handleNonStreamingMessage(event);
        }
    }

    // Other required methods
    onSessionEvent(event: SessionNotification): void { /* ... */ }
    onFileEvent(event: FileNotification): void { /* ... */ }
    onPermissionEvent(event: PermissionNotification): void { /* ... */ }

    private storePartialMessage(event: MessageNotification): void { /* ... */ }
    private handleNonStreamingMessage(event: MessageNotification): void { /* ... */ }
}
```

2. **Memory Management**: Clean up event handlers on dispose:

```typescript
class ManagedClient implements OpenCodeClient {
    private disposed: boolean = false;

    onSessionEvent(event: SessionNotification): void {
        if (this.disposed) return;
        // Handle event
    }

    // Similar for other events
    
    onMessageEvent(event: MessageNotification): void { /* ... */ }
    onFileEvent(event: FileNotification): void { /* ... */ }
    onPermissionEvent(event: PermissionNotification): void { /* ... */ }

    dispose(): void {
        this.disposed = true;
        // Clean up resources
    }
}
```

## Troubleshooting

### Connection Fails Immediately

**Symptoms**: Connection closes immediately after opening
**Causes**:
- OpenCode server not running
- Incorrect server URL
- Session doesn't exist

**Solution**:
- Verify server is running: `curl http://localhost:8080/health`
- Check server URL in configuration
- Verify session exists: `GET /project/{pid}/session/{sid}`

### No Events Received

**Symptoms**: Connected but no events forwarded
**Causes**:
- Client not set
- No activity in session
- Event type mismatch

**Solution**:
- Verify client is set: `proxy.setClient(client)`
- Trigger an action (send message, edit file)
- Check logs for unknown event types

### Reconnection Loop

**Symptoms**: Constant reconnection attempts
**Causes**:
- Server returning 4xx/5xx errors
- Invalid session ID
- Network issues

**Solution**:
- Check server logs for errors
- Verify session is active (not deleted)
- Check network connectivity

## Summary

The SSE Event Forwarding feature provides real-time updates from the OpenCode server to the Theia frontend. Key points:

- ✅ Automatic reconnection with exponential backoff
- ✅ Type-safe event handling
- ✅ Graceful error handling
- ✅ Lifecycle management
- ✅ Easy integration with Theia services

For more details, see:
- Contract: `.opencode/context/active_tasks/contract-1.3-sse-forwarding.md`
- Result: `.opencode/context/active_tasks/result-1.3-sse-forwarding.md`
- Implementation: `extensions/openspace-core/src/node/opencode-proxy.ts`
