# Permission System User Guide

## Overview

The Permission System provides a secure mechanism for AI agents in OpenSpace to request user approval before performing sensitive operations. When an agent needs to perform an action like reading files, executing commands, or accessing network resources, a modal dialog appears asking for explicit user consent.

This system ensures that users maintain full control over what the AI can access and modify in their environment.

## How It Works

### Architecture

The permission system consists of three main components:

1. **PermissionDialogManager** (TypeScript): Manages state, queue, and timeout logic
2. **PermissionDialog** (React): Renders the UI modal
3. **PermissionDialogContribution** (Theia): Integrates with Theia's lifecycle

### Request Flow

```
OpenCode Server → SSE → Backend → OpenCodeSyncService
  → Emits onPermissionRequested event
  → PermissionDialogContribution subscribes
  → PermissionDialogManager processes request
  → React UI displays modal
  → User grants/denies
  → Response sent back to OpenCode Server
```

## User Interface

### Dialog Components

When a permission request arrives, you'll see a modal dialog with:

- **Action Description**: What the agent wants to do (e.g., `file:read`, `terminal:execute`)
- **Metadata**: Contextual information (file paths, commands, URLs, reasons)
- **Timeout Countdown**: Shows time remaining before auto-deny (60 seconds)
- **Queue Indicator**: If multiple requests are pending, shows count (e.g., "2 more in queue")
- **Grant Button** (Green): Approve the permission
- **Deny Button** (Red): Reject the permission

### Example Dialog

```
╔════════════════════════════════════════════╗
║      🔒 Permission Required                ║
║                                            ║
║  Action: file:read                         ║
║                                            ║
║  Details:                                  ║
║  • path: /Users/you/project/config.json    ║
║  • reason: Need to read configuration      ║
║                                            ║
║  [ Grant ]          [ Deny ]               ║
║                                            ║
║  Auto-deny in 58s | 2 more in queue        ║
╚════════════════════════════════════════════╝
```

## Keyboard Shortcuts

The permission dialog supports keyboard navigation for quick responses:

| Key | Action | Description |
|-----|--------|-------------|
| **Enter** | Grant | Approve the permission request |
| **Escape** | Deny | Reject the permission request |

These shortcuts work when the permission dialog is focused (which happens automatically when it appears).

## Queue Processing

### FIFO Order

When multiple permission requests arrive simultaneously, they are queued and processed in **First-In-First-Out (FIFO)** order:

1. First request displays immediately
2. Additional requests are queued
3. Queue indicator shows: "X more in queue"
4. After you respond (grant/deny), the next request displays automatically
5. Process continues until queue is empty

### Example Queue Flow

```
Time 0s:  Request A arrives → Dialog shows Request A
Time 1s:  Request B arrives → Queued (1 in queue)
Time 2s:  Request C arrives → Queued (2 in queue)
Time 5s:  User grants Request A → Dialog shows Request B
Time 8s:  User denies Request B → Dialog shows Request C
Time 10s: User grants Request C → Queue empty, dialog closes
```

## Timeout Behavior

### 60-Second Auto-Deny

To prevent indefinite blocking, each permission request has a **60-second timeout**:

- Countdown timer displays in the dialog footer
- Updates every second
- If timeout expires before user responds:
  - Request is **automatically denied**
  - Next queued request (if any) displays immediately
  - Agent receives denial response

### Why Auto-Deny?

Auto-denial ensures:
- Agents don't hang indefinitely waiting for approval
- User is never blocked by forgotten permission dialogs
- System remains responsive even if user steps away

### Timeout Scenarios

| Scenario | Behavior |
|----------|----------|
| User responds in 30s | Normal grant/deny, timeout cleared |
| User doesn't respond | Auto-deny at 60s, next request shown |
| Multiple timeouts | Each request has independent 60s timer |

## Permission Types

Common permission actions you might encounter:

| Action | Description | Example Metadata |
|--------|-------------|------------------|
| `file:read` | Agent wants to read a file | `path: /path/to/file.txt` |
| `file:write` | Agent wants to write/create a file | `path: /path/to/output.txt` |
| `file:delete` | Agent wants to delete a file | `path: /path/to/old.txt` |
| `terminal:execute` | Agent wants to run a command | `command: npm install` |
| `network:fetch` | Agent wants to make HTTP request | `url: https://api.example.com` |
| `system:shutdown` | Agent wants to stop a service | `service: database` |

## Best Practices

### For Users

1. **Read Carefully**: Always check the action and metadata before granting
2. **Verify Paths**: Ensure file paths are expected and safe
3. **Review Commands**: For terminal execution, check the command isn't destructive
4. **Use Deny When Unsure**: You can always manually perform the action later
5. **Monitor Queue**: If many requests pile up, consider if the agent is behaving correctly

### Security Tips

- ❌ **NEVER grant** permissions for:
  - Deleting important files (`rm -rf`, etc.)
  - Running unknown scripts
  - Accessing sensitive credentials
  - Network requests to untrusted domains

- ✅ **Safe to grant** (usually):
  - Reading configuration files
  - Writing log files
  - Running package managers (`npm install`, `yarn add`)
  - Accessing known APIs

## Troubleshooting

### Dialog Not Appearing

**Symptoms**: Agent reports "waiting for permission" but no dialog shows

**Solutions**:
1. Check browser console for JavaScript errors
2. Verify `PermissionDialogContribution` is loaded (check Theia logs)
3. Ensure OpenCodeSyncService is connected
4. Try refreshing the page

### Dialog Stuck/Frozen

**Symptoms**: Dialog doesn't respond to clicks or keyboard

**Solutions**:
1. Check if timeout countdown is running (indicates dialog is active)
2. Try pressing `Escape` key multiple times
3. Check browser console for errors
4. Refresh the page if dialog persists

### Multiple Dialogs Overlapping

**Symptoms**: See more than one dialog at once

**Solutions**:
1. This shouldn't happen (queue system prevents it)
2. If it does, it's a bug - please report it
3. Close all dialogs and refresh the page

### Timeout Too Fast/Slow

**Symptoms**: 60 seconds feels too short or too long

**Current**: Timeout is hardcoded to 60 seconds

**Future**: Configuration options may be added in later versions

## Technical Details

### State Management

The `PermissionDialogManager` maintains:

```typescript
interface PermissionRequest {
  id: string;              // Unique request ID
  action: string;          // Permission action type
  metadata: object;        // Contextual information
  timestamp: number;       // When request arrived
  timeoutHandle?: number;  // Timeout timer ID
}
```

### Events

The manager emits these events:

- `stateChanged`: Dialog visibility or current request changed
- `requestProcessed`: Request was granted, denied, or timed out

### Integration Points

```typescript
// Subscribe to permission events
openCodeSyncService.onPermissionRequested(event => {
  permissionDialogManager.requestPermission(
    event.id,
    event.action,
    event.metadata
  );
});

// Handle responses
permissionDialogManager.onGrant(id => {
  openCodeSyncService.sendPermissionResponse(id, true);
});

permissionDialogManager.onDeny(id => {
  openCodeSyncService.sendPermissionResponse(id, false);
});
```

## Future Enhancements

Potential improvements for future versions:

1. **Configurable Timeout**: Let users set custom timeout duration
2. **Remember Decisions**: Option to "always allow" certain actions
3. **Batch Approval**: Approve multiple similar requests at once
4. **Detailed Logs**: View history of all permission requests
5. **Risk Indicators**: Visual warnings for high-risk actions
6. **Custom Actions**: Plugin system for custom permission types

## Related Documentation

- [OpenCode Protocol](../../extensions/openspace-core/src/common/opencode-protocol.ts)
- [TDD Workflow](../standards/CODING_STANDARDS.md#tdd)
- [Theia Architecture](https://theia-ide.org/docs/composing_applications/)

## Support

If you encounter issues with the permission system:

1. Check this guide first
2. Review browser console for errors
3. Check Theia backend logs
4. Report bugs with:
   - Steps to reproduce
   - Browser console output
   - Expected vs actual behavior
   - Agent action that triggered the request
