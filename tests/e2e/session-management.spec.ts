/**
 * E2E Test Suite: Session Management
 *
 * Tier 1 tests always run (Theia only, no OpenCode).
 * Tier 3 tests require OpenCode at localhost:7890 — skip cleanly if unavailable.
 *
 * Contract: TASK-E2E-REWRITE – Deliverable 2
 */

import { test, expect } from '@playwright/test';
import { BASE_URL, isOpenCodeAvailable, openChatWidget, waitForTheiaReady } from './helpers/theia';

// ---------------------------------------------------------------------------
// Tier 1 tests — always run
// ---------------------------------------------------------------------------

test.describe('Session Management – Tier 1 (always)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
    });

    test('Session selector UI is present in chat widget', async ({ page }) => {
        // .session-selector and .session-dropdown-button are rendered by SessionHeader
        // regardless of whether a session is active (see chat-widget.tsx)
        await expect(page.locator('.session-selector')).toBeVisible();
        await expect(page.locator('.session-dropdown-button')).toBeVisible();
    });

    test('Empty state shows correct elements when no active session', async ({ page }) => {
        // .chat-no-session is rendered when hasActiveSession === false (chat-widget.tsx line 454)
        // Use existence check, not visibility, because a session may or may not be active.
        const noSessionCount = await page.locator('.chat-no-session').count();
        const newButtonCount = await page.locator('.new-session-button').count();

        // The new-session-button is ALWAYS rendered (SessionHeader always renders it).
        // .chat-no-session is present when no session is active.
        // At minimum the new-session-button must exist in the DOM.
        expect(newButtonCount).toBeGreaterThan(0);

        if (noSessionCount > 0) {
            // If no active session, verify the hint text is also present
            await expect(page.locator('.chat-hint')).toBeVisible();
        }
    });

});

// ---------------------------------------------------------------------------
// Tier 3 tests — skip if OpenCode unavailable
// ---------------------------------------------------------------------------

test.describe('Session Management – Tier 3 (requires OpenCode)', () => {

    test('Can create a new session', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Click the new-session button
        const newBtn = page.locator('.new-session-button');
        await expect(newBtn).toBeVisible();
        await newBtn.click();

        // Wait for session to appear in dropdown
        await page.waitForFunction(() => {
            const btn = document.querySelector('.session-dropdown-button');
            const count = Number(btn?.getAttribute('data-test-sessions-count') ?? '0');
            return count >= 1;
        }, undefined, { timeout: 10000 });

        // Verify dropdown reports at least 1 session
        const dropdownBtn = page.locator('.session-dropdown-button');
        const sessionsCount = await dropdownBtn.getAttribute('data-test-sessions-count');
        expect(Number(sessionsCount)).toBeGreaterThanOrEqual(1);
    });

    test('Sessions list loads from server without error', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Wait for loading to finish: data-test-sessions-count attribute must be present
        // (it is always rendered on the dropdown button in chat-widget.tsx)
        await page.waitForFunction(() => {
            const btn = document.querySelector('.session-dropdown-button');
            return btn !== null && btn.hasAttribute('data-test-sessions-count');
        }, undefined, { timeout: 10000 });

        // No error state visible
        await expect(page.locator('.session-list-error')).not.toBeVisible();
    });

    test('Can switch between sessions', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);

        // Ensure at least 2 sessions exist
        const dropdownBtn = page.locator('.session-dropdown-button');
        await expect(dropdownBtn).toBeVisible();

        // Check session count
        const sessionsCountAttr = await dropdownBtn.getAttribute('data-test-sessions-count');
        const sessionsCount = Number(sessionsCountAttr ?? '0');

        if (sessionsCount < 2) {
            // Create a second session so we can switch
            await page.locator('.new-session-button').click();
            await page.waitForFunction(() => {
                const btn = document.querySelector('.session-dropdown-button');
                return Number(btn?.getAttribute('data-test-sessions-count') ?? '0') >= 2;
            }, undefined, { timeout: 10000 });
        }

        // Open dropdown and note current active session
        await dropdownBtn.click();
        const firstItem = page.locator('.session-list-item').nth(0);
        const secondItem = page.locator('.session-list-item').nth(1);

        // Click the non-active item to switch
        const firstIsActive = await firstItem.getAttribute('class');
        const targetItem = firstIsActive?.includes('active') ? secondItem : firstItem;
        await targetItem.click();

        // Dropdown closes after switch
        await expect(page.locator('.session-list-dropdown')).not.toBeVisible({ timeout: 3000 });
    });

});
