# OpenCode Parity Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Achieve full feature parity between the Theia OpenSpace chat widget and the OpenCode web client across 20 identified gaps in 5 phases.

**Architecture:** React 18 + TypeScript in Theia extension. Data flows SSE → Node proxy (`opencode-proxy.ts`) → JSON-RPC → browser sync service (`opencode-sync-service.ts`) → session service (`session-service.ts`) → React state → DOM. Changes span both `openspace-core` (data layer) and `openspace-chat` (UI layer) extensions.

**Tech Stack:** React 18, TypeScript, Theia framework, CSS custom properties, contenteditable prompt input, inversify DI.

**Build & Deploy:**
```bash
# After any change to openspace-core:
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
# After any change to openspace-chat:
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
# Webpack bundle:
yarn --cwd browser-app build
# Restart server:
lsof -ti :3000 | xargs kill -9 2>/dev/null; yarn --cwd browser-app start &>/tmp/theia-server.log &
# Wait ~10s, then navigate browser to http://localhost:3000
```

---

## Phase 1: Foundation (Streaming + Tool Cards)

### Task 1: G1 — Add `EventMessagePartDelta` type to SDK types

**Files:**
- Modify: `extensions/openspace-core/src/common/opencode-sdk-types.ts:354-360,602`

**Step 1: Add the type definition**

After `EventMessagePartUpdated` (line 360), add:

```typescript
export type EventMessagePartDelta = {
    type: "message.part.delta";
    properties: {
        sessionID: string;
        messageID: string;
        partID: string;
        field: string;
        delta: string;
    };
};
```

**Step 2: Add to Event union type**

On line 602, add `EventMessagePartDelta` to the `Event` union:

```typescript
export type Event = EventServerInstanceDisposed | EventInstallationUpdated | EventInstallationUpdateAvailable | EventLspClientDiagnostics | EventLspUpdated | EventMessageUpdated | EventMessageRemoved | EventMessagePartUpdated | EventMessagePartDelta | EventMessagePartRemoved | EventPermissionUpdated | EventPermissionReplied | EventSessionStatus | EventSessionIdle | EventSessionCompacted | EventFileEdited | EventTodoUpdated | EventCommandExecuted | EventSessionCreated | EventSessionUpdated | EventSessionDeleted | EventSessionDiff | EventSessionError | EventFileWatcherUpdated | EventVcsBranchUpdated | EventTuiPromptAppend | EventTuiCommandExecute | EventTuiToastShow | EventPtyCreated | EventPtyUpdated | EventPtyExited | EventPtyDeleted | EventServerConnected;
```

**Step 3: Build to verify types compile**

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
```

Expected: Clean compile, no errors.

---

### Task 2: G1 — Add `MessagePartDeltaNotification` to protocol

**Files:**
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts:219-225,253-270`

**Step 1: Add `onMessagePartDelta` to OpenCodeClient interface**

In the `OpenCodeClient` interface (line 219), add a new callback:

```typescript
export interface OpenCodeClient {
    onSessionEvent(event: SessionNotification): void;
    onMessageEvent(event: MessageNotification): void;
    onMessagePartDelta(event: MessagePartDeltaNotification): void;
    onFileEvent(event: FileNotification): void;
    onPermissionEvent(event: PermissionNotification): void;
    onAgentCommand(command: AgentCommand): void;
}
```

**Step 2: Add `MessagePartDeltaNotification` type**

After `MessageNotification` (around line 270):

```typescript
/**
 * Message part delta notification — per-token text append.
 * Separate from MessageNotification to avoid overloading the 'partial' type.
 */
export interface MessagePartDeltaNotification {
    readonly sessionID: string;
    readonly messageID: string;
    readonly partID: string;
    readonly field: string;
    readonly delta: string;
}
```

**Step 3: Build to verify**

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
```

Expected: Compile errors in `opencode-sync-service.ts` (missing `onMessagePartDelta` implementation). This is expected — we'll implement it in Task 4.

---

### Task 3: G1 — Handle `message.part.delta` in proxy

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy.ts:619-620,674,729-774`

**Step 1: Add `EventMessagePartDelta` to the SSE router type union**

On line 619-620, update the `message.*` branch to include the new type:

```typescript
} else if (eventType.startsWith('message.')) {
    this.forwardMessageEvent(innerEvent as SDKTypes.EventMessageUpdated | SDKTypes.EventMessagePartUpdated | SDKTypes.EventMessagePartDelta | SDKTypes.EventMessageRemoved | SDKTypes.EventMessagePartRemoved);
}
```

**Step 2: Update `forwardMessageEvent` signature**

On line 674:

```typescript
protected forwardMessageEvent(event: SDKTypes.EventMessageUpdated | SDKTypes.EventMessagePartUpdated | SDKTypes.EventMessagePartDelta | SDKTypes.EventMessageRemoved | SDKTypes.EventMessagePartRemoved): void {
```

**Step 3: Add `message.part.delta` handler inside `forwardMessageEvent`**

After the `message.part.updated` handler (after line 768) and before the `message.removed` handler (line 770), add:

```typescript
} else if (event.type === 'message.part.delta') {
    // Per-token text delta — forward directly without wrapping in MessageNotification
    const props = event.properties;

    // Skip deltas for user messages
    if (this.userMessageIds.has(props.messageID)) {
        this.logger.debug(`[OpenCodeProxy] Skipping message.part.delta for user message: ${props.messageID}`);
        return;
    }

    // Track the streaming message ID (same as message.part.updated)
    this.lastStreamingPartMessageId = props.messageID;

    this._client.onMessagePartDelta({
        sessionID: props.sessionID,
        messageID: props.messageID,
        partID: props.partID,
        field: props.field,
        delta: props.delta
    });

    this.logger.debug(`[OpenCodeProxy] Forwarded message.part.delta: part=${props.partID}, field=${props.field}, delta=${props.delta.length} chars`);

} else if (event.type === 'message.removed') {
```

**Step 4: Build to verify**

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
```

---

### Task 4: G1 — Handle delta in sync service + session service

**Files:**
- Modify: `extensions/openspace-core/src/browser/opencode-sync-service.ts` (add `onMessagePartDelta` method)
- Modify: `extensions/openspace-core/src/browser/session-service.ts` (add `applyPartDelta` method)

**Step 1: Add `onMessagePartDelta` to sync service**

In `OpenCodeSyncServiceImpl`, add:

```typescript
/**
 * Handle message.part.delta — per-token text append.
 * This is the high-frequency streaming event. It appends `delta` to
 * the specified `field` of the part identified by `partID`.
 */
onMessagePartDelta(event: MessagePartDeltaNotification): void {
    try {
        this.logger.debug(`[SyncService] Part delta: msg=${event.messageID}, part=${event.partID}, field=${event.field}, len=${event.delta.length}`);

        // Only process events for the currently active session
        if (this.sessionService.activeSession?.id !== event.sessionID) {
            return;
        }

        // Ensure streaming tracker exists (message.part.delta may arrive before message.created)
        if (!this.streamingMessages.has(event.messageID)) {
            this.streamingMessages.set(event.messageID, { text: '' });
            // Create a stub message so applyPartDelta has something to target
            this.sessionService.appendMessage({
                id: event.messageID,
                sessionID: event.sessionID,
                role: 'assistant',
                time: { created: Date.now() }
            } as any);
        }

        // Apply the delta directly to the part in session service
        this.sessionService.applyPartDelta(event.messageID, event.partID, event.field, event.delta);

        // Also track accumulated text for the streaming tracker
        if (event.field === 'text') {
            const stream = this.streamingMessages.get(event.messageID);
            if (stream) {
                stream.text += event.delta;
            }
        }
    } catch (error) {
        this.logger.error('[SyncService] Error in onMessagePartDelta:', error);
    }
}
```

Also add the import for `MessagePartDeltaNotification` at the top of the file (in the import from `../common/opencode-protocol`):

```typescript
import {
    OpenCodeClient,
    SessionNotification,
    MessageNotification,
    MessagePartDeltaNotification,
    FileNotification,
    PermissionNotification
} from '../common/opencode-protocol';
```

**Step 2: Add `applyPartDelta` to session service interface and implementation**

In the `SessionService` interface (around line 92), add:

```typescript
applyPartDelta(messageId: string, partId: string, field: string, delta: string): void;
```

In `SessionServiceImpl`, add the implementation:

```typescript
/**
 * Apply a field-level delta to a specific part in a message.
 * This is the high-frequency streaming path — called once per token.
 * 
 * Finds the part by partID and appends delta to the specified field.
 * If the part doesn't exist yet, creates a text part stub.
 * 
 * @param messageId - Message containing the part
 * @param partId - Part to update
 * @param field - Field name to append to (e.g., 'text', 'reasoning')
 * @param delta - String to append
 */
applyPartDelta(messageId: string, partId: string, field: string, delta: string): void {
    const index = this._messages.findIndex(m => m.id === messageId);
    if (index < 0) {
        this.logger.warn(`[SessionService] applyPartDelta: message not found: ${messageId}`);
        return;
    }

    // Track streaming state
    this._streamingMessageId = messageId;
    if (!this._isStreaming) {
        this._isStreaming = true;
        this.onIsStreamingChangedEmitter.fire(true);
    }

    const message = this._messages[index];
    const parts = [...(message.parts || [])];

    // Find existing part by ID
    const partIndex = parts.findIndex(p => (p as any).id === partId);
    if (partIndex >= 0) {
        // Append delta to existing part's field
        const part = { ...parts[partIndex] } as any;
        part[field] = (part[field] || '') + delta;
        parts[partIndex] = part;
    } else {
        // Part doesn't exist yet — create a stub
        // The field name tells us the type: 'text' → TextPart, 'reasoning' → ReasoningPart
        const newPart: any = {
            id: partId,
            sessionID: message.sessionID,
            messageID: messageId,
            type: field === 'reasoning' ? 'reasoning' : 'text',
            [field]: delta
        };
        parts.push(newPart);
    }

    // Update message in-place then fire change
    this._messages[index] = { ...message, parts };
    this.onMessagesChangedEmitter.fire([...this._messages]);
    this.onMessageStreamingEmitter.fire({ messageId, delta, isDone: false });
}
```

**Step 3: Build to verify**

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build
```

Expected: Clean compile.

---

### Task 5: G1 — Switch throttle to leading+trailing edge

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx:388-419`

**Step 1: Change the throttle logic**

Replace the current trailing-only throttle in the `onMessagesChanged` subscriber (lines 393-418):

```typescript
const messagesDisposable = sessionService.onMessagesChanged(msgs => {
    if (sessionService.isStreaming) {
        // During streaming: leading+trailing throttle at 100ms
        // First update fires immediately (leading edge), subsequent updates
        // are batched and flushed at the trailing edge.
        pendingMessages = msgs;
        if (!messageThrottleTimer) {
            // Leading edge: fire immediately
            setMessages(msgs);
            setStreamingMessageId(sessionService.streamingMessageId);
            // Start trailing edge timer
            messageThrottleTimer = setTimeout(() => {
                if (pendingMessages) {
                    setMessages(pendingMessages);
                    setStreamingMessageId(sessionService.streamingMessageId);
                    pendingMessages = null;
                }
                messageThrottleTimer = null;
            }, 100);
        }
    } else {
        // Not streaming: update immediately
        if (messageThrottleTimer) {
            clearTimeout(messageThrottleTimer);
            messageThrottleTimer = null;
        }
        pendingMessages = null;
        setMessages([...msgs]);
        setStreamingMessageId(sessionService.streamingMessageId);
    }
});
```

**Step 2: Build chat extension**

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
```

---

### Task 6: G3 — Remove StepsContainer, render tools inline

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx`

**Step 1: Remove `segmentParts`, `countSteps`, `StepsContainer`, and `Segment` type**

Delete these functions/components entirely (lines 356-471):
- `Segment` type (lines 357-359)
- `segmentParts()` function (lines 362-387)
- `countSteps()` function (lines 389-400)
- `StepsContainer` component (lines 407-471)

**Step 2: Update `MessageBubbleInner` to render grouped parts directly**

Replace the segment-based rendering in `MessageBubbleInner` (lines 527-580). Remove the `segments` useMemo and replace the content rendering:

```tsx
// Group parts for context tool grouping only (no steps segmentation)
const groupedParts = React.useMemo(() => groupParts(parts), [parts]);

return (
    <article ...>
        {/* ... header stays the same ... */}
        <div className="message-bubble-content">
            {groupedParts.map((group, gi) => {
                if (group.type === 'context-group') {
                    return <ContextToolGroup key={`ctx-group-${gi}`} parts={group.parts} />;
                }
                return renderPart(group.part, group.index);
            })}
            {/* Streaming cursor */}
            {isStreaming && <span className="message-streaming-cursor" aria-hidden="true">&#x258B;</span>}
        </div>
    </article>
);
```

**Step 3: Build**

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
```

---

### Task 7: G5 — Tool card design polish (icons, subtitle, chevron)

**Files:**
- Modify: `extensions/openspace-chat/src/browser/message-bubble.tsx` (ToolBlock component)

**Step 1: Add tool icon mapping and `getToolInfo` helper**

Add above `ToolBlock`:

```tsx
/** Map tool name → display info (icon SVG path, display name, subtitle extractor). */
function getToolInfo(part: any): { icon: string; name: string; subtitle: string } {
    const toolName: string = part.tool || 'tool';
    const state = part.state;
    const input = typeof state === 'object' && state !== null && 'input' in state ? state.input : undefined;

    // Icon SVG paths (24x24 viewBox, stroke-based)
    const icons: Record<string, string> = {
        console: '<polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>',
        glasses: '<circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-4 0"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.4-2-3-2"/>',
        search: '<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
        code: '<polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>',
        task: '<rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/>',
        window: '<rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/>',
        mcp: '<circle cx="12" cy="12" r="3"/><path d="M12 3v6"/><path d="M12 15v6"/><path d="m3 12 6 0"/><path d="m15 12 6 0"/>',
    };

    let iconKey = 'mcp';
    let displayName = toolName;
    let subtitle = '';

    if (BASH_TOOL_NAMES.test(toolName)) {
        iconKey = 'console';
        displayName = 'Shell';
        // Description from tool metadata (if available)
        const desc = typeof input === 'object' && input !== null ? (input as any).description : undefined;
        subtitle = desc || (typeof input === 'string' ? input : (typeof input === 'object' && input !== null ? (input as any).command || '' : ''));
    } else if (/^(read|Read)$/.test(toolName)) {
        iconKey = 'glasses';
        displayName = 'Read';
        subtitle = typeof input === 'object' && input !== null ? (input as any).filePath || (input as any).path || '' : '';
    } else if (/^(grep|Grep|glob|Glob|rg|ripgrep|search|find|list|list_files|ripgrep_search|ripgrep_advanced-search|ripgrep_count-matches|ripgrep_list-files)$/i.test(toolName)) {
        iconKey = 'search';
        displayName = toolName.charAt(0).toUpperCase() + toolName.slice(1).replace(/_/g, ' ');
        subtitle = typeof input === 'object' && input !== null ? (input as any).pattern || (input as any).query || '' : '';
    } else if (/^(edit|Edit|write|Write)$/.test(toolName)) {
        iconKey = 'code';
        displayName = toolName.charAt(0).toUpperCase() + toolName.slice(1);
        subtitle = typeof input === 'object' && input !== null ? (input as any).filePath || (input as any).path || '' : '';
    } else if (/^(task|Task)$/.test(toolName)) {
        iconKey = 'task';
        displayName = 'Task';
        subtitle = typeof input === 'object' && input !== null ? (input as any).description || '' : '';
    } else if (/^(webfetch|WebFetch|web_fetch)$/i.test(toolName)) {
        iconKey = 'window';
        displayName = 'Web Fetch';
        subtitle = typeof input === 'object' && input !== null ? (input as any).url || '' : '';
    } else if (/^(todowrite|TodoWrite|todo_write)$/i.test(toolName)) {
        iconKey = 'task';
        displayName = 'Todo';
    }

    const iconSvg = icons[iconKey] || icons.mcp;
    return { icon: iconSvg, name: displayName, subtitle };
}
```

**Step 2: Rewrite ToolBlock component**

Replace the entire `ToolBlock` component with a new version that matches OpenCode's BasicTool pattern:

```tsx
/** Collapsible tool card — matches OpenCode's BasicTool pattern. */
const ToolBlock: React.FC<{ part: any; index?: number }> = ({ part }) => {
    const [expanded, setExpanded] = React.useState(false);
    const state = part.state;
    const stateStr: string = typeof state === 'string' ? state :
        (state && typeof state === 'object' ? (state.status || state.type || 'completed') : 'completed');
    const isRunning = stateStr === 'running' || stateStr === 'pending';
    const isError = stateStr === 'error';
    const isBash = BASH_TOOL_NAMES.test(part.tool || '');

    const { icon: iconSvg, name: displayName, subtitle } = getToolInfo(part);

    // Extract input/output for expanded body
    const input = (typeof state === 'object' && state !== null && 'input' in state)
        ? (state as { input?: unknown }).input : undefined;
    const output = (typeof state === 'object' && state !== null && 'output' in state)
        ? state.output : (part.output ?? undefined);

    const hasBody = !!(input || output);

    // Bash: show command + output in body
    const bashCmd: string = isBash ? (
        typeof input === 'string' ? input :
        (input && typeof input === 'object' ? ((input as any).command ?? '') : '')
    ) : '';
    const bashOutput: string = isBash ? (
        typeof output === 'string' ? output :
        (output ? JSON.stringify(output, null, 2) : '')
    ) : '';

    return (
        <div
            className={`part-tool ${isBash ? 'part-tool-bash' : ''}`}
            data-expanded={expanded ? 'true' : 'false'}
            data-state={stateStr}
        >
            <div
                className="part-tool-header"
                onClick={() => !isRunning && (hasBody || isBash) && setExpanded(e => !e)}
                style={{ cursor: isRunning ? 'default' : ((hasBody || isBash) ? 'pointer' : 'default') }}
            >
                {/* Tool icon */}
                <span className="part-tool-icon" aria-hidden="true">
                    {isRunning ? (
                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13">
                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                        </svg>
                    ) : (
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13"
                            dangerouslySetInnerHTML={{ __html: iconSvg }}
                        />
                    )}
                </span>

                {/* Tool name + subtitle */}
                <span className={isRunning ? 'part-tool-name oc-shimmer' : 'part-tool-name'}>
                    {displayName}
                </span>
                {subtitle && (
                    <span className="part-tool-subtitle" title={subtitle}>
                        {subtitle}
                    </span>
                )}

                {/* Status indicators + chevron */}
                <span className="part-tool-trailing">
                    {isError && (
                        <svg className="part-tool-error-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12">
                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                        </svg>
                    )}
                    {(hasBody || isBash) && !isRunning && (
                        <svg className="part-tool-chevron" aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                            <path d="m9 18 6-6-6-6"/>
                        </svg>
                    )}
                </span>
            </div>

            {/* Expanded body */}
            {expanded && !isRunning && (
                <div className="part-tool-body">
                    {isBash ? (
                        <>
                            {bashCmd && <pre className="part-tool-io part-tool-input">{bashCmd}</pre>}
                            {bashOutput && <pre className="part-tool-io part-tool-output">{bashOutput}</pre>}
                        </>
                    ) : (
                        <>
                            {input && (
                                <pre className="part-tool-io part-tool-input">
                                    {typeof input === 'string' ? input : JSON.stringify(input, null, 2)}
                                </pre>
                            )}
                            {output && (
                                <pre className="part-tool-io part-tool-output">
                                    {typeof output === 'string' ? output : JSON.stringify(output, null, 2)}
                                </pre>
                            )}
                        </>
                    )}
                </div>
            )}
        </div>
    );
};
```

**Step 3: Build**

```bash
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build
```

---

### Task 8: G5 — Update tool card CSS

**Files:**
- Modify: `extensions/openspace-chat/src/browser/style/chat-widget.css`

**Step 1: Update `.part-tool` styles**

Find the existing `.part-tool` CSS rules and replace/update them. Key changes:

```css
/* ─── Tool card (BasicTool pattern) ─────────────────────────── */
.openspace-chat-widget .part-tool {
    border-radius: 6px;
    border: 1px solid var(--oc-border, #333);
    background: var(--oc-bg-raised, #1e1e1e);
    overflow: hidden;
    margin: 2px 0;
}

.openspace-chat-widget .part-tool[data-state="running"] {
    border-color: var(--oc-border-focus, #007acc44);
}

.openspace-chat-widget .part-tool[data-state="error"] {
    border-color: #f14c4c44;
}

.openspace-chat-widget .part-tool-header {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 6px 10px;
    font-size: 12px;
    min-height: 28px;
    user-select: none;
}

.openspace-chat-widget .part-tool-header:hover {
    background: var(--oc-bg-hover, #2a2d2e);
}

.openspace-chat-widget .part-tool-icon {
    display: flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
    opacity: 0.6;
    color: var(--oc-text-dim, #858585);
}

.openspace-chat-widget .part-tool-name {
    font-weight: 500;
    color: var(--oc-text, #ccc);
    white-space: nowrap;
    flex-shrink: 0;
}

.openspace-chat-widget .part-tool-subtitle {
    color: var(--oc-text-dim, #858585);
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    min-width: 0;
    flex: 1;
    font-family: var(--theia-code-font-family, monospace);
}

.openspace-chat-widget .part-tool-trailing {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-left: auto;
    flex-shrink: 0;
}

.openspace-chat-widget .part-tool-chevron {
    opacity: 0.4;
    transition: transform 0.15s ease;
    flex-shrink: 0;
}

.openspace-chat-widget .part-tool[data-expanded="true"] .part-tool-chevron {
    transform: rotate(90deg);
}

.openspace-chat-widget .part-tool-error-icon {
    color: #f14c4c;
}

.openspace-chat-widget .part-tool-body {
    border-top: 1px solid var(--oc-border, #333);
    padding: 8px 10px;
    max-height: 300px;
    overflow: auto;
}

.openspace-chat-widget .part-tool-io {
    margin: 0;
    padding: 0;
    font-size: 11px;
    font-family: var(--theia-code-font-family, monospace);
    white-space: pre-wrap;
    word-break: break-all;
    color: var(--oc-text-dim, #858585);
    line-height: 1.4;
}

.openspace-chat-widget .part-tool-output {
    margin-top: 6px;
    padding-top: 6px;
    border-top: 1px solid var(--oc-border, #333);
    max-height: 200px;
    overflow: auto;
}
```

**Step 2: Remove old steps-container CSS**

Delete/comment out all `.steps-container`, `.steps-header`, `.steps-label`, `.steps-body`, `.steps-chevron` rules since `StepsContainer` was removed.

---

### Task 9: G10 — Fix message spacing

**Files:**
- Modify: `extensions/openspace-chat/src/browser/style/message-timeline.css`

**Step 1: Update spacing variables**

Find and update the message gap CSS variables:

```css
/* Between turns (user→assistant or assistant→user): generous spacing */
--message-group-gap: 32px;
/* Between tool cards within a single message: tight */
--message-gap: 2px;
```

Ensure `.message-timeline` uses `gap: var(--message-group-gap)` and `.message-bubble-content` uses `gap: 4px`.

---

### Task 10: Phase 1 — Full build and visual verification

**Step 1: Full build**

```bash
rm -f extensions/openspace-core/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-core build && \
rm -f extensions/openspace-chat/tsconfig.tsbuildinfo && yarn --cwd extensions/openspace-chat build && \
yarn --cwd browser-app build
```

**Step 2: Start server**

```bash
lsof -ti :3000 | xargs kill -9 2>/dev/null
yarn --cwd browser-app start &>/tmp/theia-server.log &
# Wait 10s
```

**Step 3: Verify in browser**

Navigate to `http://localhost:3000`, open the chat, send a message, and verify:
- Streaming text appears smoothly (not chunky)
- Each tool appears as its own card with icon, name, subtitle, chevron
- No "N steps completed" grouping
- Proper spacing between messages

---

## Phase 2: Interactivity (Questions + Subtasks + Permissions)

### Task 11: G2 — Question event types and data flow

**Files:**
- Modify: `opencode-sdk-types.ts` — Add `EventQuestionAsked`, `EventQuestionReplied`, `EventQuestionRejected` types + add to Event union
- Modify: `opencode-protocol.ts` — Add `QuestionNotification` type, `onQuestionEvent` to `OpenCodeClient`
- Modify: `opencode-proxy.ts` — Handle `question.*` SSE events, forward via RPC
- Modify: `opencode-sync-service.ts` — Implement `onQuestionEvent`, route to session service
- Modify: `session-service.ts` — Add `pendingQuestion` state, `answerQuestion`/`rejectQuestion` methods, `onQuestionChanged` event

### Task 12: G2 — Question UI (QuestionDock component)

**Files:**
- Create: `extensions/openspace-chat/src/browser/question-dock.tsx`
- Modify: `chat-widget.tsx` — Render QuestionDock above PromptInput when question is pending
- Modify: `chat-widget.css` — QuestionDock styles

QuestionDock shows: option buttons (with labels + descriptions), custom text input field, dismiss button. When a question is pending, the normal prompt input is disabled.

### Task 13: G4 — Subtask/subagent rendering

**Files:**
- Modify: `message-bubble.tsx` — Add `TaskToolBlock` component that fetches child session data and renders child tools inline
- Modify: `session-service.ts` — Add `getChildSessionMessages(sessionId)` method
- Modify: `chat-widget.css` — Nested task card styles

### Task 14: G9 — Inline permission UI

**Files:**
- Modify: `message-bubble.tsx` — Add permission buttons under tool cards that need permission
- Modify: `session-service.ts` — Track pending permissions per tool call
- Modify: `opencode-sync-service.ts` — Surface permission events with callID matching
- Modify: `chat-widget.css` — Permission button styles

---

## Phase 3: Tool-Specific Renderers

### Task 15: G6 — Bash tool description display

**Files:**
- Modify: `message-bubble.tsx` — Update `getToolInfo` to extract `description` from bash tool metadata and show in subtitle

Already partially handled by Task 7's `getToolInfo`. The `description` field from the tool input metadata needs to be prioritized over the command text in the subtitle.

### Task 16: G7 — Edit/Write tool diff viewer

**Files:**
- Create or modify: `message-bubble.tsx` — Add `EditToolBlock` component with inline diff rendering
- Modify: `chat-widget.css` — Diff viewer styles (green/red lines, change count badge)

Shows filename + directory in header, DiffChanges badge (e.g., "+5 -2"), and inline diff when expanded.

### Task 17: G8 — Dynamic status text during streaming

**Files:**
- Modify: `chat-widget.tsx` (ChatFooter) — Map current streaming tool type to contextual status text
- Modify: `session-service.ts` — Expose `currentStreamingToolType` derived from latest tool part type

Status text mappings:
- Default/text → "Thinking"
- grep/glob/read → "Searching codebase"
- edit/write → "Making edits"
- bash → "Running commands"
- task → "Delegating"
- todowrite → "Planning"
- webfetch → "Searching web"

Throttled to change max every 2500ms.

---

## Phase 4: Prompt Input

### Task 18: G12 — Slash commands keyboard nav + dynamic commands

**Files:**
- Modify: `prompt-input.tsx` — Add keyboard navigation (ArrowUp/Down/Enter) for slash menu, fix regex to `^\/(\S*)$`

### Task 19: G11 — @ mentions dynamic agents + file search

**Files:**
- Modify: `prompt-input.tsx` — Fetch agent list from server instead of hardcoding, integrate file search with Theia workspace service or opencode API

### Task 20: G14 — Prompt history (up/down arrows)

**Files:**
- Modify: `prompt-input.tsx` — Add history array (100 entries), ArrowUp/Down at cursor boundaries navigates history, saves/restores current draft

### Task 21: G13 — Shell mode (!)

**Files:**
- Modify: `prompt-input.tsx` — Detect `!` at position 0, enter shell mode (monospace font, console icon), separate shell history, Escape exits

### Task 22: G15 — Paste handling

**Files:**
- Modify: `prompt-input.tsx` — Intercept all paste events, extract plain text, use `document.execCommand('insertText')` to avoid HTML injection

---

## Phase 5: Polish

### Task 23: G16 — TodoWrite rendering

**Files:**
- Modify: `message-bubble.tsx` — Add `TodoToolBlock` rendering checklist with completion count

### Task 24: G17 — Retry part rendering

**Files:**
- Modify: `message-bubble.tsx` — Show error message, countdown timer, attempt number for retry parts

### Task 25: G18 — Scroll-to-bottom button

**Files:**
- Modify: `message-timeline.tsx` — Add floating arrow button when scrolled up from bottom
- Modify: `message-timeline.css` — Button styles

### Task 26: G19 — Syntax highlighting in code blocks

**Files:**
- Modify: `markdown-renderer.tsx` — Add highlight.js or Prism integration for code blocks
- May need: `yarn add highlight.js` or equivalent

### Task 27: G20 — Session status indicators

**Files:**
- Modify: `chat-widget.tsx` — Add status dots to session list items (spinner=working, yellow=permissions, red=error, blue=unseen)
- Modify: `chat-widget.css` — Status indicator styles

---

## Verification Checklist

After each phase, verify:
1. `yarn --cwd extensions/openspace-core build` succeeds
2. `yarn --cwd extensions/openspace-chat build` succeeds
3. `yarn --cwd browser-app build` succeeds
4. Chat widget loads in browser
5. Phase-specific features work as described
6. No regressions in existing functionality
