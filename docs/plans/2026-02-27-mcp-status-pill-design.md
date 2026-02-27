# Design: MCP Status Pill in Chat Header

**Date:** 2026-02-27  
**Status:** Approved

## Problem

The chat widget gives the user no visibility into which MCP servers the agent has access to. The agent can only answer by describing its own tools in prose — there is no persistent UI indicator.

## Solution

A `McpStatusPill` component in the chat header bar that shows a count of connected MCP servers and, on click, expands into a dropdown listing each server with its connection status.

## Data Source

Live status from OpenCode: `GET /mcp?directory=<dir>` returns `McpStatusData` — a map of `{ [serverName]: McpStatus }`.

`McpStatus` is a union: `McpStatusConnected | McpStatusFailed | McpStatusDisabled | McpStatusNeedsAuth | McpStatusNeedsClientRegistration` (defined in `opencode-sdk-types.ts`).

## Architecture

### Layer 1: Backend RPC

**New method in `OpenCodeService` interface** (`opencode-protocol.ts`):
```typescript
getMcpStatus(directory: string): Promise<McpStatusData | undefined>;
```

**New wrapper in `RestApiFacade`** (`rest-api.ts`):
```typescript
async getMcpStatus(directory: string): Promise<McpStatusData | undefined> {
    const result = await this.http.get<McpStatusData>(`/mcp?directory=${encodeURIComponent(directory)}`);
    return result ?? undefined;
}
```

**New delegate in `OpenCodeProxy`** (`opencode-proxy.ts`):
```typescript
async getMcpStatus(directory: string): Promise<McpStatusData | undefined> {
    return this.restApi.getMcpStatus(directory);
}
```

### Layer 2: Session Service

`SessionService` exposes a method `getMcpStatus(): Promise<McpStatusData | undefined>` that resolves the active project directory and calls the RPC.

### Layer 3: Chat Widget State

`chat-widget.tsx` fetches MCP status on session change and stores in `useState<McpStatusData | undefined>`. Fetches once per session (no polling in v1).

```typescript
const [mcpStatus, setMcpStatus] = React.useState<McpStatusData | undefined>(undefined);

React.useEffect(() => {
    sessionService.getMcpStatus().then(setMcpStatus).catch(() => setMcpStatus(undefined));
}, [activeSession?.id]);
```

Passes `mcpStatus` as a prop to `ChatHeaderBar`.

### Layer 4: UI Components

**`McpStatusPill`** (new component, inline in `chat-header-bar.tsx`):

- A `button.mcp-status-pill` in the header bar, placed between the diff badge and the `ModelSelector`
- Shows: small hexagon/plug icon + count of connected servers
- Pill border color: green if all connected, yellow if any degraded, red if all failed
- On click: toggles `showMcpDropdown` state

**`McpStatusDropdown`** (new component, inline):

- Absolutely-positioned `div.mcp-status-dropdown`, same z-index/pattern as session list dropdown
- Each row: colored dot + server name
- Dot colors: `#4caf50` (connected), `#f44336` (failed), `#ff9800` (needsAuth/disabled/needsClientRegistration)
- Closes on click-outside (same `useEffect` + `.closest()` pattern as session dropdown)

## CSS

All new styles added to `chat-widget.css` using existing design tokens:

```css
.mcp-status-pill {
  /* same ghost-button style as other header pills */
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  padding: 0 6px;
  height: 22px;
  font-size: 11px;
  color: var(--oc-text-dim);
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: 4px;
}

.mcp-status-dropdown {
  /* same absolute-positioned dropdown as session-list-dropdown */
  position: absolute;
  top: calc(100% + 4px);
  background: var(--oc-bg-raised);
  border: 1px solid var(--oc-border);
  border-radius: 4px;
  min-width: 200px;
  z-index: 100;
  padding: 4px 0;
}
```

## File Changes

| File | Change |
|---|---|
| `extensions/openspace-core/src/common/opencode-protocol.ts` | Add `getMcpStatus()` to `OpenCodeService` interface |
| `extensions/openspace-core/src/node/opencode-proxy/rest-api.ts` | Add `getMcpStatus()` REST wrapper |
| `extensions/openspace-core/src/node/opencode-proxy/opencode-proxy.ts` | Add `getMcpStatus()` delegate |
| `extensions/openspace-core/src/browser/session-service/session-service.ts` | Add `getMcpStatus()` method |
| `extensions/openspace-chat/src/browser/chat-widget/chat-widget.tsx` | Fetch status, pass to header |
| `extensions/openspace-chat/src/browser/chat-widget/chat-header-bar.tsx` | Add `McpStatusPill` + `McpStatusDropdown` |
| `extensions/openspace-chat/src/browser/style/chat-widget.css` | Add pill and dropdown styles |

## Out of Scope (v1)

- Polling / live refresh (future: subscribe to session status events)
- Tool count per server
- Reconnect button in dropdown
- Auth flow from dropdown
