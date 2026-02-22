/**
 * E2E Test Suite: App Load Smoke Tests (Tier 1)
 *
 * Tier 1 — Only Theia running at localhost:3000. Tests UI structure, static elements.
 * No OpenCode required. These tests MUST always pass when the dev server is running.
 *
 * Contract: TASK-E2E-REWRITE – Deliverable 1
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

/**
 * Helper: Wait for Theia shell to be fully initialized.
 * Mirrors the gold-standard pattern from permission-dialog.spec.ts.
 */
async function waitForTheiaReady(page: Page): Promise<void> {
    await page.waitForSelector('.theia-preload', { state: 'hidden', timeout: 30000 });
    await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
    await page.locator('.theia-ApplicationShell, #theia-app-shell').first().waitFor({ state: 'attached', timeout: 5000 });
}

test.describe('App Load Smoke Tests', () => {

    test('App loads and Theia shell is visible', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);

        // Assert #theia-app-shell is present and visible
        const appShell = page.locator('#theia-app-shell');
        await expect(appShell).toBeVisible();
    });

    test('Window title is "Theia Openspace"', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);

        // Title format: "[workspace] - Theia Openspace" or "Theia Openspace"
        // Use toContain because the workspace name may be prepended (e.g., "core_dev - Theia Openspace")
        const title = await page.title();
        expect(title).toContain('Theia Openspace');
    });

    test('Chat widget is accessible from sidebar', async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);

        // The chat widget class is set in ChatWidget constructor: this.addClass('openspace-chat-widget')
        // Either the widget is already in DOM, or a sidebar button for "Chat" is visible.
        // We use 'count' not 'visible' because the widget may be in sidebar but not currently open.
        const widgetInDom = await page.locator('.openspace-chat-widget').count();
        const sidebarChatButton = page.locator('[title="Chat"], [aria-label*="Chat"]').first();
        const sidebarButtonVisible = await sidebarChatButton.isVisible().catch(() => false);

        // At least one of: widget in DOM or sidebar button present
        const chatAccessible = widgetInDom > 0 || sidebarButtonVisible;
        expect(chatAccessible).toBe(true);
    });

    test('Hub manifest endpoint accepts valid manifest POST', async ({ page }) => {
        // Navigate first so the page has an origin (http://localhost:3000),
        // then use page.evaluate fetch — the browser will include Origin automatically.
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);

        // POST /openspace/manifest — accepts a manifest with a commands array
        // Returns {"success":true} when manifest is valid, 400 when invalid.
        // Use in-page fetch so the browser sets Origin: http://localhost:3000
        const result = await page.evaluate(async (url: string) => {
            const res = await fetch(`${url}/openspace/manifest`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ commands: [{ id: 'openspace.editor.open', name: 'Open Editor', description: 'Open a file' }] })
            });
            const body = await res.json();
            return { status: res.status, body };
        }, BASE_URL);

        // Must return 200 with success=true when a valid manifest is posted
        expect(result.status).toBe(200);
        expect(result.body).toHaveProperty('success', true);
    });

    test('Hub instructions endpoint returns non-empty string containing openspace tool references', async ({ page }) => {
        // GET /openspace/instructions — returns system prompt text for AI agents
        const response = await page.request.get(`${BASE_URL}/openspace/instructions`);
        expect(response.status()).toBe(200);

        const text = await response.text();
        // Non-trivial content (more than 100 chars)
        expect(text.length).toBeGreaterThan(100);
        // Must reference OpenSpace tools
        expect(text).toContain('openspace.');
    });

});
