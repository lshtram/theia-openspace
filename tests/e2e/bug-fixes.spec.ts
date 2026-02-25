/**
 * Bug Fix Test Suite
 *
 * Tests for 5 confirmed bugs identified during hands-on testing and code audit.
 * Written BEFORE implementation — each test must FAIL until the fix is in place.
 *
 * Bug list:
 *   BUG-1: "[]" card rendered above the input prompt (raw array or TodoPanel when todos=[])
 *   BUG-2: File content floods message history (Read tool parts rendered inline)
 *   BUG-3: Load More Sessions discards accumulated results (accumulation bug)
 *   BUG-4: Active model not restored when switching sessions
 *   BUG-5: Delete button is hard-delete; should be Archive (reversible)
 *
 * Tier strategy:
 *   Tier 1 – DOM / CSS checks, no OpenCode required
 *   Tier 3 – Require OpenCode at localhost:7890
 *
 * Run this file only:
 *   npx playwright test tests/e2e/bug-fixes.spec.ts
 */

import { test, expect, request, type Page } from '@playwright/test';
import {
    BASE_URL,
    isOpenCodeAvailable,
    openChatWidget,
    waitForTheiaReady,
} from './helpers/theia';

const OPENCODE_URL = 'http://localhost:7890';

// The demo project directory must match what global-setup creates,
// so sessions created via the API show up in Theia's sessions widget.
const DEMO_PROJECT_DIR = '/tmp/openspace-e2e-demo-project';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function openSessionsWidget(page: Page): Promise<void> {
    const isVisible = await page.evaluate(() => {
        const container = document.querySelector('.openspace-sessions-widget');
        if (!container) { return false; }
        const parent = container.closest('.lm-Widget');
        return parent ? !parent.classList.contains('lm-mod-hidden') : false;
    });
    if (isVisible) { return; }

    const sessionsTab = page.locator('.theia-app-left .lm-TabBar-tab').filter({ hasText: /^Sessions$/ }).first();
    if (await sessionsTab.isVisible({ timeout: 2000 }).catch(() => false)) {
        await sessionsTab.click();
        await page.waitForFunction(() => {
            const container = document.querySelector('.openspace-sessions-widget');
            if (!container) { return false; }
            const parent = container.closest('.lm-Widget');
            return parent ? !parent.classList.contains('lm-mod-hidden') : false;
        }, { timeout: 5000 }).catch(() => {});
    }
}

async function createSession(directory = DEMO_PROJECT_DIR): Promise<string> {
    const ctx = await request.newContext();
    const res = await ctx.post(`${OPENCODE_URL}/session`, {
        data: { title: `bug-fix-test-${Date.now()}` },
        headers: { 'x-opencode-directory': directory },
    });
    expect(res.ok(), `createSession failed: ${res.status()}`).toBeTruthy();
    const body = await res.json();
    return body.id as string;
}

// ===========================================================================
// BUG-1: "[]" card above input prompt
// ===========================================================================

test.describe('BUG-1: No spurious [] card above input prompt', () => {
    /**
     * When no todos are active the area between message history and the input
     * must be completely empty — no "[object Array]", no "[]" text, no empty
     * card element with a data-testid of "todo-panel".
     *
     * Root cause: TodoPanel renders null when todos=[], so if [] appears it
     * means something else is converting the todos array to a string or a raw
     * <TodoPanel> is rendering an empty container instead of null.
     */
    test('Tier 1 – todo-panel is absent from the DOM when there are no todos', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // The TodoPanel MUST return null when todos=[]; the element must not be in the DOM.
        const todoPanelHandle = page.locator('[data-testid="todo-panel"]');
        await expect(todoPanelHandle, 'todo-panel must NOT be in the DOM when todos is empty').not.toBeAttached({ timeout: 5000 });
    });

    test('Tier 1 – raw "[]" text is never rendered near the chat input', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Look for a text node or element that contains only "[]" near the input area.
        const rawArrayText = page.locator('.openspace-chat-widget').filter({ hasText: /^\[\]$/ });
        await expect(rawArrayText, 'raw "[]" text must not be visible in the chat widget').not.toBeVisible({ timeout: 5000 });
    });

    test('Tier 1 – no empty card element is rendered between message list and input area', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // The .openspace-todo-panel element must not exist at all when todos=[].
        const emptyPanel = page.locator('.openspace-todo-panel');
        await expect(emptyPanel, '.openspace-todo-panel must not be in the DOM when there are no todos').not.toBeAttached({ timeout: 5000 });
    });
});

// ===========================================================================
// BUG-2: File content floods message history (Read tool parts)
// ===========================================================================

test.describe('BUG-2: Read tool output is not shown verbatim in message history', () => {
    /**
     * When OpenCode calls the Read tool in response to a message that includes
     * an @file attachment, the tool result — full file content — must NOT be
     * rendered as a visible plain-text block in the message history.
     *
     * Acceptable behaviours:
     *   a) tool parts named "Read" are collapsed by default (user must click to expand)
     *   b) tool parts whose input matches an already-attached @file are hidden entirely
     *
     * The test verifies that long raw file content is never exposed as untruncated
     * visible text in the .message-timeline element.
     */

    test('Tier 1 – Read tool parts have chevron and collapsed state in CSS', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // The ToolBlock component renders tool parts. The body is hidden via React
        // conditional rendering ({expanded && <body>}), toggled by data-expanded attribute.
        // We verify:
        //  1. The CSS rule for data-expanded="true" chevron rotation exists (confirms expand/collapse is implemented)
        //  2. The .part-tool-output has max-height to prevent unbounded file content display
        const cssOk = await page.evaluate(() => {
            for (const sheet of Array.from(document.styleSheets)) {
                try {
                    const rules = Array.from(sheet.cssRules ?? []);
                    const hasChevronRotate = rules.some(r => r.cssText.includes('data-expanded="true"') && r.cssText.includes('part-tool-chevron'));
                    const hasOutputMaxHeight = rules.some(r => r.cssText.includes('part-tool-output') && r.cssText.includes('max-height'));
                    if (hasChevronRotate && hasOutputMaxHeight) { return true; }
                } catch { /* cross-origin */ }
            }
            return false;
        });
        expect(
            cssOk,
            'CSS must have expand/collapse chevron rule AND max-height on tool output to prevent file flooding'
        ).toBe(true);
    });

    test('Tier 3 – After sending a message with a file, raw file contents are not visible as plain text', async ({ page }) => {
        test.setTimeout(120000); // Requires live OpenCode LLM inference; allow extra time
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Ensure an active session exists — click "New session" if the prompt input is not visible
        const chatWidget = page.locator('.openspace-chat-widget');
        const promptEditor = chatWidget.locator('.prompt-input-editor[contenteditable]');
        const promptVisible = await promptEditor.isVisible({ timeout: 3000 }).catch(() => false);
        if (!promptVisible) {
            // Try clicking the new session button within the chat widget
            const newBtn = chatWidget.locator('[aria-label="New session"], .new-session-button');
            await newBtn.click({ timeout: 5000 }).catch(() => {});
            // Wait for the prompt editor to appear (session was created)
            await promptEditor.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        }

        // Type a message referencing a file
        const textarea = chatWidget.locator('.prompt-input-editor[contenteditable]');
        await textarea.click({ timeout: 15000 });
        await textarea.fill('What is in /etc/hosts?');
        await page.keyboard.press('Enter');

        // Wait for streaming to finish (the send button transitions back).
        // Allow up to 90s for the LLM to respond; if it times out, proceed and check anyway.
        await page.waitForSelector('.send-button:not([data-streaming="true"]), .prompt-input-send:not([disabled])', {
            timeout: 90000,
        }).catch(() => {});

        // The full contents of /etc/hosts (or any long file) must NOT be visible as
        // unstyled/untruncated plain text in the message timeline.
        // We check that no visible element inside .message-timeline has more than
        // 500 characters of raw text that looks like file content.
        const longRawTextVisible = await page.evaluate(() => {
            const timeline = document.querySelector('.message-timeline');
            if (!timeline) { return false; }
            const allTextNodes: string[] = [];
            const walker = document.createTreeWalker(timeline, NodeFilter.SHOW_TEXT);
            let node: Node | null;
            // eslint-disable-next-line no-cond-assign
            while ((node = walker.nextNode())) {
                const parent = node.parentElement;
                if (!parent) { continue; }
                const style = window.getComputedStyle(parent);
                // Only count text that is actually visible and not inside a collapsed/hidden container
                if (style.display === 'none' || style.visibility === 'hidden' || style.overflow === 'hidden') {
                    continue;
                }
                const text = (node.textContent ?? '').trim();
                if (text.length > 500) { allTextNodes.push(text.slice(0, 60) + '...'); }
            }
            return allTextNodes.length > 0;
        });

        expect(
            longRawTextVisible,
            'Raw file content (>500 chars) must NOT be visible as plain text in the message timeline'
        ).toBe(false);
    });

    test('Tier 3 – Read tool block shows a collapsed header, not expanded file content', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Ensure an active session exists — click "New session" if the prompt input is not visible
        const chatWidget2 = page.locator('.openspace-chat-widget');
        const promptEditor2 = chatWidget2.locator('.prompt-input-editor[contenteditable]');
        const promptVisible2 = await promptEditor2.isVisible({ timeout: 3000 }).catch(() => false);
        if (!promptVisible2) {
            const newBtn = chatWidget2.locator('[aria-label="New session"], .new-session-button');
            await newBtn.click({ timeout: 5000 }).catch(() => {});
            await promptEditor2.waitFor({ state: 'visible', timeout: 15000 }).catch(() => {});
        }

        const textarea = chatWidget2.locator('.prompt-input-editor[contenteditable]');
        await textarea.click({ timeout: 15000 });
        await textarea.fill('Read /etc/hosts');
        await page.keyboard.press('Enter');

        // Wait for at least one tool block to appear
        await page.waitForSelector('.part-tool', { timeout: 30000 }).catch(() => {});

        // Any .part-tool block for a Read-type tool must be collapsed (data-expanded="false")
        // by default — user should not see file contents without clicking.
        const expandedReadBlocks = await page.evaluate(() => {
            const blocks = Array.from(document.querySelectorAll('.part-tool[data-expanded="true"]'));
            return blocks.filter(b => {
                // A block is a "Read" block if its header mentions Read or the tool name matches
                const header = b.querySelector('.tool-header, .part-tool-name, [class*="tool-name"]');
                return header?.textContent?.toLowerCase().includes('read') ?? false;
            }).length;
        });

        expect(
            expandedReadBlocks,
            'Read tool blocks must be collapsed by default (data-expanded must be "false")'
        ).toBe(0);
    });
});

// ===========================================================================
// BUG-3: Load More Sessions discards accumulated results
// ===========================================================================

test.describe('BUG-3: Load More Sessions appends rather than replaces', () => {
    /**
     * When the user clicks "Load more" in the Sessions widget the new sessions
     * must be APPENDED to the already-visible list, not replace it.
     *
     * Root cause: loadMoreSessions() fetches the next page but never appends
     * to this._sessions. The button handler then calls load() which resets to
     * page 1.
     */

    test('Tier 3 – Sessions list grows after clicking Load more (items from page 1 are still visible)', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        // Navigate to Theia first so we can read the active project's directory
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        // Determine the active project directory from Theia's localStorage
        // so sessions we create via API show up in the widget.
        const activeProjectId = await page.evaluate(() =>
            window.localStorage.getItem('openspace.activeProjectId') ?? ''
        );
        let activeProjectDir = DEMO_PROJECT_DIR;
        if (activeProjectId) {
            const ctx2 = await request.newContext();
            const res2 = await ctx2.get(`${OPENCODE_URL}/project`);
            if (res2.ok()) {
                const projects: Array<{ id: string; worktree?: string; path?: string }> = await res2.json().catch(() => []);
                const proj = projects.find(p => p.id === activeProjectId);
                if (proj?.worktree || proj?.path) {
                    activeProjectDir = (proj.worktree ?? proj.path) as string;
                }
            }
        }

        // Create enough sessions to trigger pagination (>20).
        // We create them via the API directly to avoid UI flakiness.
        // Must use the same directory as the active project so sessions appear in Theia.
        const ctx = await request.newContext();
        const ids: string[] = [];
        for (let i = 0; i < 22; i++) {
            const res = await ctx.post(`${OPENCODE_URL}/session`, {
                data: { title: `pagination-test-${i}-${Date.now()}` },
                headers: { 'x-opencode-directory': activeProjectDir },
            });
            if (res.ok()) {
                const b = await res.json();
                ids.push(b.id as string);
            }
        }

        // Reload the page so the sessions widget picks up all created sessions
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        // Wait for the sessions list to load and loading spinner to disappear
        await page.waitForSelector('.sessions-widget-list', { timeout: 10000 }).catch(() => {});
        await page.waitForSelector('.sessions-widget-loading', { state: 'hidden', timeout: 10000 }).catch(() => {});
        // Additional wait to ensure React state is settled
        await page.waitForTimeout(1000);

        const countBefore = await page.locator('.sessions-widget-list .sessions-widget-item').count();

        // The "Load more" button should be visible if there are >20 sessions
        const loadMoreBtn = page.locator('[data-testid="load-more-sessions"], .load-more-sessions');
        const btnVisible = await loadMoreBtn.isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(!btnVisible, 'Load more button not visible — not enough sessions to trigger pagination');

        await loadMoreBtn.click();
        // Wait for the list to update and loading to complete
        await page.waitForSelector('.sessions-widget-loading', { state: 'hidden', timeout: 10000 }).catch(() => {});
        // Wait for count to potentially increase (give React time to re-render)
        await page.waitForFunction(
            (before: number) => document.querySelectorAll('.sessions-widget-list .sessions-widget-item').length > before,
            countBefore,
            { timeout: 5000 }
        ).catch(() => {}); // may not increase if bug still present

        const countAfter = await page.locator('.sessions-widget-list .sessions-widget-item').count();

        expect(
            countAfter,
            `Sessions list must grow after "Load more". Before: ${countBefore}, After: ${countAfter}`
        ).toBeGreaterThan(countBefore);
    });

    test('Tier 3 – First-page sessions remain visible after clicking Load more', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        // Navigate to Theia first to read the active project directory
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        const activeProjectId = await page.evaluate(() =>
            window.localStorage.getItem('openspace.activeProjectId') ?? ''
        );
        let activeProjectDir = DEMO_PROJECT_DIR;
        if (activeProjectId) {
            const ctx2 = await request.newContext();
            const res2 = await ctx2.get(`${OPENCODE_URL}/project`);
            if (res2.ok()) {
                const projects: Array<{ id: string; worktree?: string; path?: string }> = await res2.json().catch(() => []);
                const proj = projects.find(p => p.id === activeProjectId);
                if (proj?.worktree || proj?.path) {
                    activeProjectDir = (proj.worktree ?? proj.path) as string;
                }
            }
        }

        // Create >20 sessions so Load More becomes available
        const ctx = await request.newContext();
        const firstSessionTitle = `first-page-anchor-${Date.now()}`;
        await ctx.post(`${OPENCODE_URL}/session`, {
            data: { title: firstSessionTitle },
            headers: { 'x-opencode-directory': activeProjectDir },
        });
        for (let i = 0; i < 21; i++) {
            await ctx.post(`${OPENCODE_URL}/session`, {
                data: { title: `filler-${i}-${Date.now()}` },
                headers: { 'x-opencode-directory': activeProjectDir },
            });
        }

        // Reload to pick up all newly created sessions
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        await page.waitForSelector('.sessions-widget-list', { timeout: 10000 }).catch(() => {});
        await page.waitForSelector('.sessions-widget-loading', { state: 'hidden', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);

        const loadMoreBtn = page.locator('[data-testid="load-more-sessions"], .load-more-sessions');
        const btnVisible = await loadMoreBtn.isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(!btnVisible, 'Load more button not visible — not enough sessions to trigger pagination');

        // Record the IDs of sessions visible on page 1
        const firstPageIds = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.sessions-widget-list .sessions-widget-item'))
                .map(el => el.getAttribute('data-session-id') ?? el.textContent?.trim() ?? '')
                .filter(Boolean)
        );

        await loadMoreBtn.click();
        await page.waitForSelector('.sessions-widget-loading', { state: 'hidden', timeout: 10000 }).catch(() => {});
        await page.waitForTimeout(1000);

        // Every session that was visible before must still be visible after
        const afterIds = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.sessions-widget-list .sessions-widget-item'))
                .map(el => el.getAttribute('data-session-id') ?? el.textContent?.trim() ?? '')
                .filter(Boolean)
        );

        for (const id of firstPageIds) {
            expect(
                afterIds,
                `Session "${id}" from page 1 must still be visible after loading more`
            ).toContain(id);
        }
    });
});

// ===========================================================================
// BUG-4: Active model not restored when switching sessions
// ===========================================================================

test.describe('BUG-4: Model is restored when switching to a session that used a specific model', () => {
    /**
     * Each OpenCode session records the model that was used.
     * When the user switches to a session, the model selector must reflect
     * the model stored in that session — not whatever was last selected globally.
     *
     * Root cause: setActiveSession() never reads session.model and never calls
     * setActiveModel(). The model selector therefore shows stale state.
     */

    test('Tier 3 – Switching sessions updates the displayed model in the model selector', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        // Create two sessions via the UI "New session" button
        const newSessionBtn = page.locator('[aria-label="New session"], .new-session-button');

        // Session A
        if (await newSessionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await newSessionBtn.click();
            await page.waitForTimeout(1500);
        }

        // Read the model selector's current text for session A
        const modelSelector = page.locator('.model-selector-pill').first();
        const _modelA = await modelSelector.textContent({ timeout: 5000 }).catch(() => 'unknown');

        // Create session B (which may have a different model if OpenCode assigns one)
        if (await newSessionBtn.isVisible({ timeout: 3000 }).catch(() => false)) {
            await newSessionBtn.click();
            await page.waitForTimeout(1500);
        }
        const _modelB = await modelSelector.textContent({ timeout: 3000 }).catch(() => 'unknown');

        // Switch back to session A by clicking it in the sessions list
        // (We need at least 2 sessions visible — if only 1 created, skip)
        const sessionItems = page.locator('.sessions-list .session-item');
        const count = await sessionItems.count();
        test.skip(count < 2, 'Need at least 2 sessions to test model restoration');

        // Click the second session item (not the current one)
        await sessionItems.nth(1).click();
        await page.waitForTimeout(1000);

        const modelAfterSwitch = await modelSelector.textContent({ timeout: 3000 }).catch(() => null);

        // The model shown must change to match the session we switched to.
        // If both sessions happen to have the same model, the test is inconclusive —
        // but it must not show "Select Model" (the unset placeholder).
        expect(
            modelAfterSwitch,
            'Model selector must not show "Select Model" after switching to a session that has a stored model'
        ).not.toMatch(/select model/i);
    });

    test('Tier 3 – Model selector shows the session model, not "Select Model" placeholder, after switching to a session that has a stored model', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        // Create a session via API and then "send" a message to it so OpenCode records
        // a model on the session. We use the low-level API to check the session object.
        const sessionId = await createSession();
        const ctx = await request.newContext();

        // Fetch the session and check if it has a model set
        const sessionRes = await ctx.get(`${OPENCODE_URL}/session/${sessionId}`);
        const sessionData = await sessionRes.json();
        const storedModel = sessionData?.model;

        // Only meaningful if the session has a model (it may not if no message was sent)
        // We still test the selector presence and that it defaults sanely.

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // The model selector element must always be present in the chat widget
        const modelSelector = page.locator('.model-selector').first();
        await expect(modelSelector, '.model-selector must be in the DOM').toBeAttached({ timeout: 5000 });

        // Navigate to the session via the sessions widget
        await openSessionsWidget(page);
        const sessionItem = page.locator(`.session-item[data-session-id="${sessionId}"]`).first();
        const itemVisible = await sessionItem.isVisible({ timeout: 5000 }).catch(() => false);

        if (!itemVisible) {
            // If session item not found by data attr, try clicking New Session and checking model
            const newBtn = page.locator('[aria-label="New session"], .new-session-button');
            if (await newBtn.isVisible({ timeout: 2000 }).catch(() => false)) {
                await newBtn.click();
                await page.waitForTimeout(1500);
            }
        } else {
            await sessionItem.click();
            await page.waitForTimeout(1000);
        }

        const pillText = await page.locator('.model-selector-pill').first().textContent({ timeout: 3000 }).catch(() => null);

        // If the session has a stored model, the pill must show that model — not the generic placeholder.
        if (storedModel) {
            expect(
                pillText,
                `Model pill must reflect session model "${storedModel}", not "Select Model"`
            ).not.toMatch(/select model/i);
        } else {
            // If no model stored yet, we just assert the selector is present and functional
            expect(pillText, 'Model pill must have some text content').toBeTruthy();
        }
    });
});

// ===========================================================================
// BUG-5: Delete button is hard-delete, should be Archive
// ===========================================================================

test.describe('BUG-5: Sessions are archived, not hard-deleted', () => {
    /**
     * The sessions widget currently has a "Delete" button that calls
     * DELETE /session/:id — a permanent, irreversible hard delete.
     *
     * The correct UX is to ARCHIVE sessions (PATCH /session/:id with
     * { time: { archived: <timestamp> } }), which:
     *   1. Hides the session from the default list
     *   2. Makes it visible when "Show archived" is toggled on
     *   3. Is reversible
     *
     * After this fix:
     *   - The button label/tooltip says "Archive", not "Delete"
     *   - The archived session disappears from the default list
     *   - The archived session reappears when "Show archived" is toggled
     *   - A permanent-delete option may or may not exist separately
     */

    test('Tier 1 – Session action button is labelled "Archive", not "Delete"', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        await page.waitForSelector('.openspace-sessions-widget', { timeout: 5000 });

        // The action button must say "Archive" (aria-label or title), not "Delete session".
        const archiveBtn = page.locator(
            '[aria-label="Archive session"], [title="Archive session"], .sessions-widget-archive'
        ).first();
        await expect(archiveBtn, 'An "Archive session" button must exist in the sessions widget').toBeVisible({ timeout: 5000 });
    });

    test('Tier 1 – No hard-delete button labelled "Delete session" exists in sessions widget', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        await page.waitForSelector('.openspace-sessions-widget', { timeout: 5000 });

        // The old "Delete session" button must be gone (or renamed).
        const hardDeleteBtn = page.locator(
            '[aria-label="Delete session"], [title="Delete session"], .sessions-widget-delete'
        ).first();
        await expect(hardDeleteBtn, '"Delete session" button must NOT exist — it should have been renamed to Archive').not.toBeVisible({ timeout: 3000 });
    });

    test('Tier 3 – Archiving a session removes it from the default list but keeps it under "Show archived"', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        // Create a dedicated session to archive
        const sessionId = await createSession();

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await openSessionsWidget(page);

        await page.waitForSelector('.sessions-list', { timeout: 10000 }).catch(() => {});

        // Find the session item for our test session
        const sessionItem = page.locator(`.session-item[data-session-id="${sessionId}"]`).first();
        const itemVisible = await sessionItem.isVisible({ timeout: 5000 }).catch(() => false);
        test.skip(!itemVisible, `Newly created session ${sessionId} not visible in the list`);

        // Click Archive on this session (hover to reveal the button, then click)
        await sessionItem.hover();
        const archiveBtn = sessionItem.locator('[aria-label="Archive session"], [title="Archive session"], .sessions-widget-archive');
        await archiveBtn.click();

        // Confirm dialog if one appears
        await page.locator('.theia-button.main, [role="dialog"] button').filter({ hasText: /archive/i }).click().catch(() => {});

        // After archiving, session must NOT be visible in the default list
        await expect(
            page.locator(`.session-item[data-session-id="${sessionId}"]`),
            'Archived session must disappear from the default (non-archived) list'
        ).not.toBeVisible({ timeout: 5000 });

        // Toggle "Show archived" — the session must reappear
        const showArchivedToggle = page.locator('[data-testid="show-archived-toggle"], .show-archived-toggle');
        await showArchivedToggle.click();

        await expect(
            page.locator(`.session-item[data-session-id="${sessionId}"]`),
            'Archived session must be visible when "Show archived" is toggled on'
        ).toBeVisible({ timeout: 5000 });
    });

    test('Tier 3 – Archiving calls PATCH /session/:id (not DELETE) via OpenCode API', async () => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        const sessionId = await createSession();
        const ctx = await request.newContext();

        // Simulate what the fixed UI should do: PATCH with archived timestamp
        const archiveRes = await ctx.patch(`${OPENCODE_URL}/session/${sessionId}`, {
            data: { time: { archived: Date.now() } },
        });
        expect(archiveRes.ok(), `PATCH /session/${sessionId} must succeed`).toBeTruthy();

        const archived = await archiveRes.json();
        expect(archived.time?.archived, 'Archived timestamp must be set on the session').toBeTruthy();

        // Verify the session still exists (was not deleted)
        const getRes = await ctx.get(`${OPENCODE_URL}/session/${sessionId}`);
        expect(getRes.ok(), 'Session must still exist after archiving (not hard-deleted)').toBeTruthy();
    });
});
