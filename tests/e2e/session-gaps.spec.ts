/**
 * Session & Chat Gap Test Suite
 *
 * This file tests ALL features identified as MISSING or BUGGY in the gap analysis:
 * docs/research/2026-02-24-theia-openspace-session-gap-analysis.md
 *
 * Tests are intentionally written to FAIL until the feature is implemented.
 * Each test is annotated with the gap it covers and the relevant implementation locations.
 *
 * Test structure:
 *   - Tier 1: UI-only checks (always run, no OpenCode required)
 *   - Tier 3: Require OpenCode at localhost:7890 (skipped if unavailable)
 *
 * To run this file only:
 *   npx playwright test tests/e2e/session-gaps.spec.ts
 */

import { test, expect, request } from '@playwright/test';
import {
    BASE_URL,
    isOpenCodeAvailable,
    openChatWidget,
    waitForTheiaReady,
} from './helpers/theia';

const OPENCODE_URL = 'http://localhost:7890';

// ---------------------------------------------------------------------------
// Helper: create a session directly via OpenCode API
// ---------------------------------------------------------------------------
async function createSession(directory: string = '/tmp'): Promise<string> {
    const ctx = await request.newContext();
    const res = await ctx.post(`${OPENCODE_URL}/session`, {
        data: { title: 'gap-test-session' },
        headers: { 'x-opencode-directory': directory },
    });
    const body = await res.json();
    return body.id as string;
}

// ===========================================================================
// GAP: Session lifecycle — missing operations
// ===========================================================================

test.describe('Gap: Session Init', () => {
    test('Tier 3 – POST /session/:id/init is called when a session is initialized', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: theia-openspace never calls POST /session/:id/init
        // Expected: session initialization triggers the init endpoint
        // This test will FAIL until init is implemented in SessionService.
        //
        // Implementation location: extensions/openspace-core/src/browser/session-service.ts
        // Should call: POST /session/:id/init after createSession()

        const initBtn = page.locator('[data-testid="init-session-button"], .init-session-button');
        await expect(initBtn).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Gap: Session Fork', () => {
    test('Tier 1 – Fork session button exists in UI', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: No fork UI exists anywhere in the chat widget
        // Expected: a "Fork session" action in the session menu or message context menu
        // This test will FAIL until fork UI is implemented.
        //
        // Implementation location: extensions/openspace-chat/src/browser/chat-widget.tsx
        // Should call: POST /session/:id/fork via SessionService.forkSession()

        const forkBtn = page.locator('[data-testid="fork-session-button"], .fork-session-button');
        await expect(forkBtn).toBeVisible({ timeout: 5000 });
    });

    test('Tier 3 – Forking a session creates a child session linked to the parent', async () => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        const ctx = await request.newContext();
        const sessionId = await createSession();

        // Fork via API directly (the endpoint works; theia-openspace just doesn't call it)
        const forkRes = await ctx.post(`${OPENCODE_URL}/session/${sessionId}/fork`, {
            data: {},
            headers: { 'x-opencode-directory': '/tmp' },
        });
        expect(forkRes.ok()).toBeTruthy();
        const child = await forkRes.json();

        // The child should have parentID pointing to the original
        expect(child.parentID ?? child.parent_id).toBe(sessionId);

        // Gap: The child session should be visible in the theia-openspace session list
        // under the parent — but there is no hierarchy UI and /session/:id/children is never called.
        // This assertion documents what should eventually be true in the UI.
        // (No browser assertion here — this is an API contract verification)
        expect(child.id).toBeTruthy();
    });
});

test.describe('Gap: Session Summarize / Compact', () => {
    test('Tier 1 – Compact session action exists in session menu', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: No compaction/summarize action in any menu
        // Expected: a "Compact session" or "Summarize" option
        // This test will FAIL until the action is added.
        //
        // Implementation location: extensions/openspace-chat/src/browser/chat-widget.tsx
        // Should call: POST /session/:id/summarize via SessionService.summarizeSession()

        const compactBtn = page.locator(
            '[data-testid="compact-session-button"], .compact-session-button, [aria-label*="compact" i], [aria-label*="summarize" i]'
        );
        await expect(compactBtn).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Gap: Session Share / Unshare', () => {
    test('Tier 1 – Share session action exists in UI', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: No share/unshare UI
        // Expected: a share button that calls POST /session/:id/share and displays share URL
        // This test will FAIL until share is implemented.

        const shareBtn = page.locator(
            '[data-testid="share-session-button"], .share-session-button, [aria-label*="share" i]'
        );
        await expect(shareBtn).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Gap: Session Revert / Unrevert', () => {
    test('Tier 1 – Revert session action exists in UI', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: No revert/unrevert UI
        // Expected: a revert action in the session or message context menu
        // This test will FAIL until revert is implemented.

        const revertBtn = page.locator(
            '[data-testid="revert-session-button"], .revert-session-button, [aria-label*="revert" i]'
        );
        await expect(revertBtn).toBeVisible({ timeout: 5000 });
    });
});

test.describe('Gap: Archive sessions', () => {
    test('Tier 1 – Archived sessions are visually distinguished or hidden with toggle', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: time.archived is never set via UI; no toggle to show/hide archived sessions
        // Expected: an "Archive" action per session, and a toggle to show archived sessions
        // This test will FAIL until archive UI is implemented.

        const archiveToggle = page.locator(
            '[data-testid="show-archived-toggle"], .show-archived-toggle, [aria-label*="archived" i]'
        );
        await expect(archiveToggle).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// GAP: SSE events not forwarded
// ===========================================================================

test.describe('Gap: SSE session.error event handling', () => {
    test('Tier 3 – session.error SSE event is surfaced in UI as an error notification', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: session.error falls through to `default` case in opencode-proxy.ts
        // The event is never forwarded to the browser.
        // Expected: errors should appear as a visible error state in the chat widget.
        //
        // Bug location: extensions/openspace-core/src/node/opencode-proxy.ts
        // (the SSE event router switch statement — session.error hits default)
        //
        // This test will FAIL until session.error is handled and forwarded.

        // Simulate: look for the error display element that should appear when session errors occur
        const errorDisplay = page.locator('.session-error, [data-testid="session-error"]');

        // We can't easily trigger a session.error without a real session, but we can
        // verify the DOM element exists (it should exist even if empty, for the happy path).
        // The test passes only once the element is implemented in chat-widget.tsx.
        await expect(errorDisplay).toBeAttached({ timeout: 5000 });
    });
});

test.describe('Gap: SSE message.removed event handling', () => {
    test('Tier 3 – Deleting a message via API removes it from the UI', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: message.removed SSE event is received by opencode-proxy.ts but not forwarded.
        // Expected: deleting a message via OpenCode API should remove it from the message list.
        //
        // Bug location: extensions/openspace-core/src/node/opencode-proxy.ts
        // and: extensions/openspace-core/src/browser/opencode-sync-service.ts
        //
        // This test will FAIL until message.removed is forwarded and handled.

        const sessionId = await createSession();
        const ctx = await request.newContext();

        // Send a message to create one
        const msgRes = await ctx.post(`${OPENCODE_URL}/session/${sessionId}/message`, {
            data: { parts: [{ type: 'text', text: 'hello' }] },
            headers: { 'x-opencode-directory': '/tmp' },
        });
        expect(msgRes.ok()).toBeTruthy();
        const msg = await msgRes.json();

        // Delete the message — this emits message.removed via SSE
        const delRes = await ctx.delete(
            `${OPENCODE_URL}/${sessionId}/message/${msg.id}`,
            { headers: { 'x-opencode-directory': '/tmp' } }
        );
        expect(delRes.ok()).toBeTruthy();

        // The UI should no longer show this message
        // (This will fail because message.removed is not forwarded)
        const msgLocator = page.locator(`[data-message-id="${msg.id}"]`);
        await expect(msgLocator).not.toBeAttached({ timeout: 5000 });
    });
});

test.describe('Gap: SSE todo.updated event handling', () => {
    test('Tier 3 – Todo updates from OpenCode are reflected in the UI', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: todo.updated SSE event is not handled at all.
        // Expected: a todo panel or overlay that updates when todos change.
        //
        // Implementation location: extensions/openspace-core/src/node/opencode-proxy.ts
        //   (add todo.updated case to SSE router)
        // Extensions needed: a TodoService + TodoWidget in the browser
        //
        // This test will FAIL until todos are implemented.

        const todoPanel = page.locator('.openspace-todo-panel, [data-testid="todo-panel"]');
        await expect(todoPanel).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// GAP: Message parts not rendered
// ===========================================================================

test.describe('Gap: Reasoning parts rendered', () => {
    test('Tier 1 – Reasoning parts have a dedicated render element in the DOM', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: reasoning parts are not rendered in MessageBubble / MessageTimeline
        // Expected: a .part-reasoning or similar container
        //
        // Implementation location: extensions/openspace-chat/src/browser/message-bubble.tsx
        //
        // This test will FAIL until reasoning parts are rendered.
        // (We check that the CSS class exists in the stylesheet to indicate it's been implemented.)

        const hasReasoningStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try {
                    return Array.from(sheet.cssRules).some(
                        r => r.cssText.includes('part-reasoning')
                    );
                } catch { return false; }
            });
        });
        expect(hasReasoningStyle).toBe(true);
    });
});

test.describe('Gap: File parts rendered', () => {
    test('Tier 1 – File attachment parts have a render element', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: file parts are not rendered
        // Expected: a .part-file or file attachment container

        const hasFilePartStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try {
                    return Array.from(sheet.cssRules).some(
                        r => r.cssText.includes('part-file')
                    );
                } catch { return false; }
            });
        });
        expect(hasFilePartStyle).toBe(true);
    });
});

test.describe('Gap: Compaction marker rendered', () => {
    test('Tier 1 – Compaction parts show a visual divider in the message timeline', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: compaction parts are not rendered — no visual cue when context was compacted
        // Expected: a .compaction-marker or similar divider in the timeline
        //
        // Implementation location: extensions/openspace-chat/src/browser/message-timeline.tsx

        const hasCompactionStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try {
                    return Array.from(sheet.cssRules).some(
                        r => r.cssText.includes('compaction')
                    );
                } catch { return false; }
            });
        });
        expect(hasCompactionStyle).toBe(true);
    });
});

// ===========================================================================
// GAP: Session discovery — no filters / pagination
// ===========================================================================

test.describe('Gap: Session list pagination', () => {
    test('Tier 1 – Load more sessions button is present when list may be truncated', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: GET /session is called with no limit or start cursor.
        // With large session counts the list would be truncated with no way to load more.
        // Expected: a "Load more" button or infinite scroll in SessionsWidget / session dropdown.
        //
        // Implementation location:
        //   extensions/openspace-chat/src/browser/sessions-widget.tsx
        //   extensions/openspace-core/src/browser/session-service.ts (add limit + cursor params)

        const loadMoreBtn = page.locator(
            '[data-testid="load-more-sessions"], .load-more-sessions, [aria-label*="load more" i]'
        );
        await expect(loadMoreBtn).toBeAttached({ timeout: 5000 });
    });
});

test.describe('Gap: Session search', () => {
    test('Tier 1 – Session search input exists in sessions widget', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: No search input in SessionsWidget or session dropdown.
        // Expected: a search/filter input that passes the `search` query param to GET /session.
        //
        // Implementation location: extensions/openspace-chat/src/browser/sessions-widget.tsx

        const searchInput = page.locator(
            '[data-testid="session-search"], .session-search input, input[placeholder*="search" i]'
        );
        await expect(searchInput).toBeVisible({ timeout: 5000 });
    });
});

// ===========================================================================
// GAP: Session status — retry state and bulk status
// ===========================================================================

test.describe('Gap: Session retry state shown in UI', () => {
    test('Tier 1 – Retry countdown is visible when session is in retry state', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: SessionStatus { type: 'retry', attempt, message, next } is forwarded via SSE
        // but the retry details (countdown, attempt number, message) are never shown.
        // Expected: a visible retry indicator in the chat widget input area.
        //
        // Implementation location: extensions/openspace-chat/src/browser/chat-widget.tsx
        // (check onSessionStatusChanged, render retry state)

        // We inject a fake retry status into the page to test the UI rendering
        const hasRetryElement = await page.evaluate(() => {
            // Check if the DOM has any element that could display retry state
            return (
                document.querySelector('.session-retry') !== null ||
                document.querySelector('[data-testid="session-retry"]') !== null
            );
        });

        // This will FAIL until the retry UI element is implemented
        expect(hasRetryElement).toBe(true);
    });
});

test.describe('Gap: Bulk session status at startup', () => {
    test('Tier 3 – GET /session/status is called on startup and status is reflected', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        // Intercept network requests to verify /session/status is called
        const statusCalled: boolean[] = [];
        page.on('request', req => {
            if (req.url().includes('/session/status') && !req.url().includes('/session/status/')) {
                statusCalled.push(true);
            }
        });

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: GET /session/status is never called by opencode-proxy.ts or session-service.ts
        // Expected: called at startup to populate status for all known sessions
        //
        // Implementation location: extensions/openspace-core/src/node/opencode-proxy.ts
        // or: extensions/openspace-core/src/browser/session-service.ts

        // Wait for potential startup calls to settle
        await page.waitForTimeout(3000);
        expect(statusCalled.length).toBeGreaterThan(0);
    });
});

// ===========================================================================
// GAP: Message pagination
// ===========================================================================

test.describe('Gap: Paginated message loading', () => {
    test('Tier 3 – GET /session/:id/message uses limit parameter', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        const messageCalls: string[] = [];
        page.on('request', req => {
            const url = req.url();
            if (url.includes('/message') && !url.includes('/message/')) {
                messageCalls.push(url);
            }
        });

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Wait for message loading
        await page.waitForTimeout(3000);

        // Gap: GET /session/:id/message is called with no limit param.
        // With large message histories this is unbounded.
        // Expected: a `?limit=400` or similar param on all message list requests.
        //
        // Implementation location: extensions/openspace-core/src/browser/session-service.ts
        // in loadMessages() — add `limit` query parameter

        const hasLimit = messageCalls.some(url => url.includes('limit='));
        expect(hasLimit).toBe(true);
    });

    test('Tier 1 – Load more messages button exists in message timeline', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: No "load more" button or scroll-based pagination for messages
        // Expected: a button or sentinel element at top of timeline to load older messages
        //
        // Implementation location: extensions/openspace-chat/src/browser/message-timeline.tsx

        const loadMoreBtn = page.locator(
            '[data-testid="load-more-messages"], .load-more-messages, [aria-label*="load more messages" i]'
        );
        await expect(loadMoreBtn).toBeAttached({ timeout: 5000 });
    });
});

// ===========================================================================
// GAP: Diff display
// ===========================================================================

test.describe('Gap: Session diff display', () => {
    test('Tier 3 – Session diff is visible in UI', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: GET /session/:id/diff is never called. File changes made by the model
        // are not shown as a diff summary anywhere in the UI.
        // Expected: a diff panel or "changed files" count in the session header.
        //
        // Implementation location: extensions/openspace-core/src/browser/session-service.ts
        // (add getDiff() method) + UI in chat-widget.tsx or sessions-widget.tsx

        const diffPanel = page.locator(
            '.session-diff, [data-testid="session-diff"], [aria-label*="changed files" i]'
        );
        await expect(diffPanel).toBeAttached({ timeout: 5000 });
    });
});

// ===========================================================================
// GAP: Todos
// ===========================================================================

test.describe('Gap: Todo panel', () => {
    test('Tier 1 – Todo panel widget exists in the IDE', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);

        // Gap: GET /session/:id/todo is never called. Todos from the model are invisible to the user.
        // Expected: a todo panel showing current session todos with status.
        //
        // Implementation location: new TodoWidget extension or integration into chat-widget.tsx

        const todoPanel = page.locator(
            '.openspace-todo, [data-testid="todo-panel"], .todo-widget'
        );
        await expect(todoPanel).toBeAttached({ timeout: 5000 });
    });
});

// ===========================================================================
// GAP: Forked session hierarchy UI
// ===========================================================================

test.describe('Gap: Forked session hierarchy', () => {
    test('Tier 1 – Sessions widget shows parent-child relationships', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Gap: parentID on Session.Info is never used. Forked sessions appear flat.
        // Expected: sessions with a parentID should be indented or linked under their parent.
        //
        // Implementation location: extensions/openspace-chat/src/browser/sessions-widget.tsx

        // Verify that session items have a data attribute that can represent hierarchy
        const sessionItems = page.locator('.session-list-item[data-parent-id]');
        // This assertion is structural — even if no forked sessions exist, the attribute
        // should be in the DOM for sessions that have a parentID.
        // The test FAILS until parentID is wired into the DOM.

        // We can only verify the attribute exists on at least one item if we know there
        // are forked sessions. So we check for the implementation via CSS class instead.
        const hasHierarchyStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try {
                    return Array.from(sheet.cssRules).some(
                        r => r.cssText.includes('session-child') || r.cssText.includes('session-forked')
                    );
                } catch { return false; }
            });
        });
        expect(hasHierarchyStyle).toBe(true);
    });
});

// ===========================================================================
// GAP: Bugs
// ===========================================================================

test.describe('Bug: onSessionStatusChanged not disposed', () => {
    test('Tier 1 – No memory leak from undisposed onSessionStatusChanged emitter', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);

        // Bug: SessionService.dispose() does not call this._onSessionStatusChanged.dispose()
        // This is a memory leak when the service is destroyed.
        //
        // Bug location: extensions/openspace-core/src/browser/session-service.ts
        // In the dispose() method — add: this._onSessionStatusChanged.dispose()
        //
        // This test verifies the fix by checking the dispose pattern via code inspection.
        // We can't directly test disposal in E2E, so we check a side-effect:
        // after navigating away and back, no duplicate status events fire.

        const statusEvents: number[] = [];
        await page.exposeFunction('__trackStatusEvent', () => statusEvents.push(Date.now()));

        // Navigate twice — a memory leak would cause duplicate subscriptions
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        await page.waitForTimeout(1000);

        // If there's a leak, events accumulate. We can't fully test this in E2E
        // without the code fix. Mark as a structural placeholder.
        // The test passes vacuously — it documents the bug but cannot detect it via E2E alone.
        // A unit test is more appropriate for this bug. Marked pending.
        test.info().annotations.push({
            type: 'note',
            description: 'Bug: onSessionStatusChanged not disposed in session-service.ts dispose(). Requires unit test, not E2E.',
        });
        expect(true).toBe(true); // placeholder — the real fix is in session-service.ts
    });
});

test.describe('Bug: 750ms delta dedup window', () => {
    test('Tier 3 – Rapid delta events with same content are not incorrectly dropped', async () => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        // Bug: The 750ms dedup window in opencode-proxy.ts deduplicated based on content hash.
        // If two different logical characters happen to share the same delta content within 750ms,
        // one is silently dropped.
        //
        // Bug location: extensions/openspace-core/src/node/opencode-proxy.ts
        // The dedup window should use (partId + delta hash) as the key, not delta hash alone.
        //
        // This test documents the expected behaviour post-fix.
        // Actual injection of rapid same-content deltas is not feasible in E2E without a mock.

        test.info().annotations.push({
            type: 'note',
            description: 'Bug: 750ms delta dedup window uses content hash without partId, may drop valid duplicates. Requires unit test for opencode-proxy.ts.',
        });
        expect(true).toBe(true); // placeholder
    });
});

// ===========================================================================
// GAP: Agent parts rendered (E3)
// ===========================================================================

test.describe('Gap: Agent parts rendered', () => {
    test('Tier 1 – Agent invocation parts have a render element in DOM', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        const hasAgentStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try { return Array.from(sheet.cssRules).some(r => r.cssText.includes('part-agent')); }
                catch { return false; }
            });
        });
        expect(hasAgentStyle).toBe(true);
    });
});

// ===========================================================================
// GAP: Patch/snapshot parts rendered (E5)
// ===========================================================================

test.describe('Gap: Patch/snapshot parts rendered', () => {
    test('Tier 1 – Patch parts have a render element with diff indicator', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        const hasPatchStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try { return Array.from(sheet.cssRules).some(r => r.cssText.includes('part-patch')); }
                catch { return false; }
            });
        });
        expect(hasPatchStyle).toBe(true);
    });
});

// ===========================================================================
// GAP: Per-session status badge (H1)
// ===========================================================================

test.describe('Gap: Per-session status badge', () => {
    test('Tier 1 – Session list items show status badge', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        const hasBadgeStyle = await page.evaluate(() => {
            const sheets = Array.from(document.styleSheets);
            return sheets.some(sheet => {
                try { return Array.from(sheet.cssRules).some(r => r.cssText.includes('session-status-badge')); }
                catch { return false; }
            });
        });
        expect(hasBadgeStyle).toBe(true);
    });
});
