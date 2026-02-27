# MCP Status Pill Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add a live MCP server status pill to the chat header bar that shows connected server count and a dropdown with per-server status dots.

**Architecture:** Wire a new `getMcpStatus(directory)` RPC through the existing proxy stack (RestApiFacade → OpenCodeProxy → OpenCodeService protocol), then fetch it in `chat-widget.tsx` on session change and pass it to `ChatHeaderBar` as a new prop. `ChatHeaderBar` renders a `McpStatusPill` button + `McpStatusDropdown` inline.

**Tech Stack:** TypeScript, React (via `@theia/core/shared/react`), existing CSS design tokens, Theia RPC/JsonRpc proxy pattern, OpenCode REST API (`GET /mcp?directory=...`)

---

### Task 1: Add `getMcpStatus` to RestApiFacade

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy/rest-api.ts`
- Test: `extensions/openspace-core/test/opencode-proxy.spec.ts`

**Background:** `RestApiFacade` (`rest-api.ts`) is a plain class that wraps HTTP calls to the OpenCode server. It already has `connectMcpServer(name)`. We add a `getMcpStatus(directory)` method that calls `GET /mcp?directory=<dir>` and returns the raw JSON. `McpStatusData` is already typed in `opencode-sdk-types.ts` around line 2951. The `this.http.get<T>(url)` helper is the existing pattern.

**Step 1: Write the failing test**

Open `extensions/openspace-core/test/opencode-proxy.spec.ts`. Find the "OpenCodeProxy — HTTP methods" describe block. Add this test inside it (after the existing `connectMcpServer` test if present, or after `searchFiles`):

```typescript
describe('getMcpStatus()', () => {
    it('makes GET /mcp with directory query param', async () => {
        const mockStatus = {
            'openspace-hub': { type: 'connected', tools: [] }
        };
        fetchMock.mockResponseOnce(JSON.stringify(mockStatus));
        const result = await proxy.getMcpStatus('/workspace/foo');
        expect(fetchMock).toHaveBeenCalledWith(
            expect.stringContaining('/mcp?directory='),
            expect.any(Object)
        );
        expect(result).toEqual(mockStatus);
    });

    it('returns undefined when fetch fails', async () => {
        fetchMock.mockRejectOnce(new Error('network'));
        const result = await proxy.getMcpStatus('/workspace/foo');
        expect(result).toBeUndefined();
    });
});
```

**Step 2: Run test to verify it fails**

```bash
npx mocha --grep "getMcpStatus" --reporter min
```
Expected: 2 failing — "getMcpStatus is not a function"

**Step 3: Add `getMcpStatus` to `RestApiFacade`**

In `rest-api.ts`, after the `connectMcpServer` method (around line 55), add:

```typescript
async getMcpStatus(directory: string): Promise<Record<string, unknown> | undefined> {
    try {
        return await this.http.get<Record<string, unknown>>(
            `/mcp?directory=${encodeURIComponent(directory)}`
        );
    } catch {
        return undefined;
    }
}
```

**Step 4: Run test to verify it passes**

```bash
npx mocha --grep "getMcpStatus" --reporter min
```
Expected: 2 passing

**Step 5: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy/rest-api.ts \
        extensions/openspace-core/test/opencode-proxy.spec.ts
git commit -m "feat: add getMcpStatus to RestApiFacade (GET /mcp)"
```

---

### Task 2: Wire `getMcpStatus` through OpenCodeProxy and OpenCodeService protocol

**Files:**
- Modify: `extensions/openspace-core/src/node/opencode-proxy/opencode-proxy.ts`
- Modify: `extensions/openspace-core/src/common/opencode-protocol.ts`

**Background:** `OpenCodeProxy` delegates to `RestApiFacade`. `opencode-protocol.ts` declares the `OpenCodeService` interface that the Theia RPC proxy uses to generate a browser stub. Any method on the interface is automatically proxied over JSON-RPC from browser to backend.

**Step 1: Add method to `OpenCodeProxy`**

In `opencode-proxy.ts`, after the `getMcpConfig` method (around line 200), add:

```typescript
async getMcpStatus(directory: string): Promise<Record<string, unknown> | undefined> {
    return this.restApi.getMcpStatus(directory);
}
```

**Step 2: Add method to the `OpenCodeService` interface**

In `opencode-protocol.ts`, after the `getMcpConfig` line (around line 282), add:

```typescript
getMcpStatus(directory: string): Promise<Record<string, unknown> | undefined>;
```

**Step 3: Run full unit test suite to ensure nothing broke**

```bash
npx mocha --reporter min
```
Expected: 1312+ passing, 0 failing (same baseline)

**Step 4: Commit**

```bash
git add extensions/openspace-core/src/node/opencode-proxy/opencode-proxy.ts \
        extensions/openspace-core/src/common/opencode-protocol.ts
git commit -m "feat: wire getMcpStatus through OpenCodeProxy and OpenCodeService protocol"
```

---

### Task 3: Add `getMcpStatus` to SessionService browser API

**Files:**
- Modify: `extensions/openspace-core/src/browser/session-service/session-service.ts`

**Background:** `SessionService` is the browser-side façade the chat widget calls. It already has `getMcpConfig()` as a private method (lines 108-120). We add a public `getMcpStatus()` that resolves the active project worktree path and calls the RPC.

**Step 1: Add the method**

After the `getMcpConfig()` private method, add a new **public** method:

```typescript
async getMcpStatus(): Promise<Record<string, unknown> | undefined> {
    try {
        const wt = this.lifecycle.activeProject?.worktree;
        if (!wt) { return undefined; }
        return await this.openCodeService.getMcpStatus(wt);
    } catch {
        return undefined;
    }
}
```

**Step 2: Run tests**

```bash
npx mocha --reporter min
```
Expected: same baseline passing count, 0 failing

**Step 3: Commit**

```bash
git add extensions/openspace-core/src/browser/session-service/session-service.ts
git commit -m "feat: expose getMcpStatus on SessionService browser API"
```

---

### Task 4: Add MCP status state to `chat-widget.tsx`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget/chat-widget.tsx`

**Background:** `ChatComponent` uses `React.useState` for session state and `React.useEffect` to react to session changes. Pattern to follow: the `contextUsage` state which is also fetched from the session service on session change. We add `mcpStatus` state and fetch it when the active session changes.

**Step 1: Add state and effect**

Find the `contextUsage` state declaration (around line 60-80 in chat-widget.tsx). Immediately after it, add:

```typescript
const [mcpStatus, setMcpStatus] = React.useState<Record<string, unknown> | undefined>(undefined);
```

Find the `useEffect` that fetches/resets `contextUsage` when `activeSession?.id` changes. Add a parallel effect:

```typescript
React.useEffect(() => {
    setMcpStatus(undefined);
    if (activeSession) {
        sessionService.getMcpStatus().then(setMcpStatus).catch(() => setMcpStatus(undefined));
    }
}, [activeSession?.id]);
```

**Step 2: Pass `mcpStatus` to `ChatHeaderBar`**

Find the `<ChatHeaderBar ... />` JSX render (search for `ChatHeaderBar` in the render). Add the prop:

```tsx
mcpStatus={mcpStatus}
```

**Step 3: Update the mock factory in all spec files**

The mock factory for `SessionService` in spec files must include `getMcpStatus`. Find all spec files that call `createMockSessionService()` or define the mock inline:

```bash
grep -rl "getMcpStatus\|createMockSessionService\|sessionService.*mock" extensions/openspace-chat/test/
```

Add `getMcpStatus: async () => undefined` to each mock object.

**Step 4: Run tests**

```bash
npx mocha --reporter min
```
Expected: same baseline, 0 failing

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget/chat-widget.tsx \
        extensions/openspace-chat/test/
git commit -m "feat: fetch MCP status in chat-widget and pass to ChatHeaderBar"
```

---

### Task 5: Add `McpStatusPill` and `McpStatusDropdown` to `ChatHeaderBar`

**Files:**
- Modify: `extensions/openspace-chat/src/browser/chat-widget/chat-header-bar.tsx`
- Modify: `extensions/openspace-chat/src/browser/style/chat-widget.css`
- Test: `extensions/openspace-chat/test/chat-header-bar.spec.tsx` (new or existing)

**Background:** `ChatHeaderBar` already renders the session dropdown and `ModelSelector` using `React.useState` for dropdown visibility. We follow the same click-outside pattern for `showMcpDropdown`. The prop interface `ChatHeaderBarProps` needs `mcpStatus?: Record<string, unknown>`.

**Step 1: Write failing tests**

Create or open `extensions/openspace-chat/test/mcp-status-pill.spec.tsx`:

```typescript
import * as React from '@theia/core/shared/react';
import { render, fireEvent } from '@testing-library/react';
import { ChatHeaderBar } from '../src/browser/chat-widget/chat-header-bar';

// Minimal mock for required props — copy the pattern from existing header bar tests
const minimalProps = {
    activeSession: undefined,
    sessions: [],
    onNewSession: () => {},
    onDeleteSession: () => {},
    // ... (copy all required props from existing spec file)
    mcpStatus: {
        'openspace-hub': { type: 'connected' },
        'tavily': { type: 'connected' },
        'broken-server': { type: 'failed', error: 'timeout' },
    }
};

describe('McpStatusPill', () => {
    it('renders .mcp-status-pill when mcpStatus is provided', () => {
        const { container } = render(<ChatHeaderBar {...minimalProps} />);
        expect(container.querySelector('.mcp-status-pill')).toBeTruthy();
    });

    it('shows connected server count in the pill', () => {
        const { container } = render(<ChatHeaderBar {...minimalProps} />);
        const pill = container.querySelector('.mcp-status-pill')!;
        expect(pill.textContent).toContain('2'); // 2 connected out of 3
    });

    it('does NOT render .mcp-status-pill when mcpStatus is undefined', () => {
        const props = { ...minimalProps, mcpStatus: undefined };
        const { container } = render(<ChatHeaderBar {...props} />);
        expect(container.querySelector('.mcp-status-pill')).toBeNull();
    });

    it('opens .mcp-status-dropdown on pill click', () => {
        const { container } = render(<ChatHeaderBar {...minimalProps} />);
        const pill = container.querySelector('.mcp-status-pill')!;
        fireEvent.click(pill);
        expect(container.querySelector('.mcp-status-dropdown')).toBeTruthy();
    });

    it('lists each server by name in the dropdown', () => {
        const { container } = render(<ChatHeaderBar {...minimalProps} />);
        fireEvent.click(container.querySelector('.mcp-status-pill')!);
        const dropdown = container.querySelector('.mcp-status-dropdown')!;
        expect(dropdown.textContent).toContain('openspace-hub');
        expect(dropdown.textContent).toContain('tavily');
        expect(dropdown.textContent).toContain('broken-server');
    });
});
```

**Step 2: Run to verify they fail**

```bash
npx mocha --grep "McpStatusPill" --reporter min
```
Expected: 5 failing

**Step 3: Update `ChatHeaderBarProps` interface**

In `chat-header-bar.tsx`, find the `ChatHeaderBarProps` interface (or type) and add:

```typescript
mcpStatus?: Record<string, unknown>;
```

**Step 4: Add `showMcpDropdown` state and click-outside handler**

Inside the `ChatHeaderBar` component function, after the existing `showSessionList` state, add:

```typescript
const [showMcpDropdown, setShowMcpDropdown] = React.useState(false);
const mcpDropdownRef = React.useRef<HTMLDivElement>(null);

React.useEffect(() => {
    if (!showMcpDropdown) return;
    const handleOutsideClick = (e: MouseEvent) => {
        if (!mcpDropdownRef.current?.contains(e.target as Node)) {
            setShowMcpDropdown(false);
        }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
}, [showMcpDropdown]);
```

**Step 5: Add helper to compute pill summary**

Add this helper inside (or just above) the component:

```typescript
function getMcpSummary(status: Record<string, unknown>) {
    const entries = Object.entries(status);
    const connected = entries.filter(([, v]) => (v as { type: string }).type === 'connected').length;
    const hasError = entries.some(([, v]) => {
        const t = (v as { type: string }).type;
        return t === 'failed' || t === 'error';
    });
    const pillColor = hasError ? '#f44336' : connected === entries.length ? '#4caf50' : '#ff9800';
    return { connected, total: entries.length, pillColor };
}
```

**Step 6: Render `McpStatusPill` and `McpStatusDropdown` in JSX**

In the `ChatHeaderBar` render, locate the summary diff badge (the `+0 -0` element). Insert the pill **after** it and **before** `<ModelSelector>`:

```tsx
{props.mcpStatus && (() => {
    const { connected, total, pillColor } = getMcpSummary(props.mcpStatus!);
    return (
        <div ref={mcpDropdownRef} style={{ position: 'relative' }}>
            <button
                className="mcp-status-pill"
                style={{ borderColor: pillColor }}
                title={`MCP servers: ${connected}/${total} connected`}
                onClick={() => setShowMcpDropdown(v => !v)}
            >
                <span className="mcp-status-pill-icon">⬡</span>
                <span className="mcp-status-pill-count">{connected}</span>
            </button>
            {showMcpDropdown && (
                <div className="mcp-status-dropdown">
                    {Object.entries(props.mcpStatus!).map(([name, val]) => {
                        const s = val as { type: string };
                        const dot = s.type === 'connected' ? '#4caf50'
                            : (s.type === 'failed' || s.type === 'error') ? '#f44336'
                            : '#ff9800';
                        return (
                            <div key={name} className="mcp-status-row">
                                <span className="mcp-status-dot" style={{ background: dot }} />
                                <span className="mcp-status-name">{name}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
})()}
```

**Step 7: Add CSS**

In `chat-widget.css`, append:

```css
/* MCP Status Pill */
.mcp-status-pill {
    display: flex;
    align-items: center;
    gap: 3px;
    padding: 0 6px;
    height: 22px;
    font-size: 11px;
    color: var(--oc-text-dim, #858585);
    background: transparent;
    border: 1px solid var(--oc-border, #333);
    border-radius: 4px;
    cursor: pointer;
    white-space: nowrap;
    flex-shrink: 0;
}
.mcp-status-pill:hover {
    background: var(--oc-bg-hover, #2a2d2e);
}
.mcp-status-pill-icon {
    font-size: 10px;
    line-height: 1;
}
.mcp-status-pill-count {
    font-variant-numeric: tabular-nums;
}

/* MCP Status Dropdown */
.mcp-status-dropdown {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    background: var(--oc-bg-raised, #252526);
    border: 1px solid var(--oc-border, #333);
    border-radius: 4px;
    min-width: 180px;
    max-height: 300px;
    overflow-y: auto;
    z-index: 100;
    padding: 4px 0;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
}
.mcp-status-row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 12px;
    font-size: 12px;
    color: var(--oc-text, #ccc);
}
.mcp-status-row:hover {
    background: var(--oc-bg-hover, #2a2d2e);
}
.mcp-status-dot {
    width: 7px;
    height: 7px;
    border-radius: 50%;
    flex-shrink: 0;
}
.mcp-status-name {
    font-family: monospace;
    font-size: 11px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
}
```

**Step 8: Run tests**

```bash
npx mocha --grep "McpStatusPill" --reporter min
```
Expected: 5 passing

**Step 9: Commit**

```bash
git add extensions/openspace-chat/src/browser/chat-widget/chat-header-bar.tsx \
        extensions/openspace-chat/src/browser/style/chat-widget.css \
        extensions/openspace-chat/test/mcp-status-pill.spec.tsx
git commit -m "feat: add McpStatusPill and McpStatusDropdown to ChatHeaderBar"
```

---

### Task 6: Build and verify in browser

**Background:** Browser extensions require a webpack rebuild after TypeScript changes. See patterns.md "Webpack Bundle Rebuild Required after Browser Extension Changes".

**Step 1: Build the chat extension**

```bash
yarn --cwd extensions/openspace-chat build
```
Expected: no TypeScript errors

**Step 2: Build the core extension (for proxy changes)**

```bash
yarn --cwd extensions/openspace-core build
```
Expected: no TypeScript errors

**Step 3: Rebuild webpack bundle**

```bash
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```
Expected: compilation success, no errors

**Step 4: Verify the bundle contains the new code**

```bash
rg "mcp-status-pill" browser-app/lib/frontend/
```
Expected: at least one match. If zero matches, the cache is stale — run:
```bash
rm -rf browser-app/.webpack-cache
yarn --cwd browser-app webpack --config webpack.config.js --mode development
```

**Step 5: Hard-refresh the browser**

Cmd+Shift+R in the Theia tab at `http://localhost:3000`.

**Step 6: Verify in the UI**

The chat header should now show a small pill (like `⬡ 10`) between the `+0 -0` diff badge and the model selector. Clicking it should reveal a dropdown with each MCP server name and a color dot.

**Step 7: Run full test suite**

```bash
npx mocha --reporter min
```
Expected: 1312+ passing, 0 failing

**Step 8: Commit final**

```bash
git commit --allow-empty -m "chore: webpack bundle rebuilt with MCP status pill"
```
(or skip if there's nothing to stage — the build output is not committed)
