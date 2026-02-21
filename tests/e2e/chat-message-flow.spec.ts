/**
 * E2E Test Suite: Chat Message Flow
 *
 * Tier 1 tests: always run (Theia only, no OpenCode backend required).
 *   - Verifies the chat widget structure is present.
 *
 * Tier 3 tests: require OpenCode at localhost:7890.
 *   - Requires an active session; verifies prompt input, typing, and message send.
 */

import { test, expect, Page } from '@playwright/test';

const BASE_URL = 'http://localhost:3000';

// ── Shared helpers ────────────────────────────────────────────────────────────

async function dismissWorkspaceTrustDialog(page: Page): Promise<void> {
    try {
        const trustDialog = page.locator('.workspace-trust-dialog');
        const isVisible = await trustDialog.isVisible({ timeout: 3000 }).catch(() => false);
        if (isVisible) {
            await page.locator('.workspace-trust-dialog .theia-button.main').click();
            await trustDialog.waitFor({ state: 'hidden', timeout: 5000 });
        }
    } catch { /* not present */ }
}

async function waitForTheiaReady(page: Page): Promise<void> {
    await page.waitForSelector('.theia-preload', { state: 'hidden', timeout: 30000 });
    await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
    await dismissWorkspaceTrustDialog(page);
}

async function openChatWidget(page: Page): Promise<void> {
    const alreadyVisible = await page.locator('.openspace-chat-widget').isVisible().catch(() => false);
    if (!alreadyVisible) {
        const chatTab = page.locator('.theia-tab-icon-label:has-text("Chat")').first();
        const chatSidebarIcon = page.locator('[title="Chat"]').first();
        if (await chatTab.isVisible({ timeout: 2000 }).catch(() => false)) {
            await chatTab.click();
        } else if (await chatSidebarIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
            await chatSidebarIcon.click();
        }
    }
    await page.waitForSelector('.openspace-chat-widget', { state: 'visible', timeout: 5000 });
}

async function ensureActiveSession(page: Page): Promise<void> {
    const noSession = await page.locator('.chat-no-session').count();
    if (noSession > 0) {
        const newBtn = page.locator('.new-session-button').first();
        await newBtn.click();
        await page.waitForSelector('.message-timeline', { timeout: 10000 });
    }
}

async function isOpenCodeAvailable(): Promise<boolean> {
    try {
        const resp = await fetch('http://localhost:7890/v1/health').catch(() => null);
        return resp !== null && resp.ok;
    } catch {
        return false;
    }
}

// ── Tier 1: always run ────────────────────────────────────────────────────────

test.describe('Chat Message Flow – Tier 1 (always)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
    });

    test('Chat widget is visible and contains session selector', async ({ page }) => {
        // Session selector (header) is always rendered regardless of session state
        await expect(page.locator('.session-selector')).toBeVisible();
        await expect(page.locator('.session-dropdown-button')).toBeVisible();
    });

    test('Chat widget renders either the message timeline or no-session state', async ({ page }) => {
        // Exactly one of these states must be present
        const timeline = await page.locator('.message-timeline').count();
        const noSession = await page.locator('.chat-no-session').count();
        expect(timeline + noSession).toBeGreaterThan(0);
    });

    test('New session button is always present in chat widget', async ({ page }) => {
        // new-session-button is always rendered in the SessionHeader
        await expect(page.locator('.new-session-button')).toBeVisible();
    });

});

// ── Tier 3: requires OpenCode ─────────────────────────────────────────────────

test.describe('Chat Message Flow – Tier 3 (requires OpenCode)', () => {

    test('Prompt input is visible when a session is active', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await ensureActiveSession(page);

        await expect(page.locator('.prompt-input-container')).toBeVisible({ timeout: 5000 });
    });

    test('Prompt input accepts typed text', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await ensureActiveSession(page);

        const editor = page.locator('[contenteditable="true"]').first();
        await expect(editor).toBeVisible({ timeout: 5000 });
        await editor.click();
        await editor.type('hello world');
        const text = await editor.textContent();
        expect(text).toContain('hello');
    });

    test('Sent message appears in the message timeline', async ({ page }) => {
        const available = await isOpenCodeAvailable();
        test.skip(!available, 'Tier 3: OpenCode not reachable at localhost:7890');

        await page.goto(BASE_URL);
        await waitForTheiaReady(page);
        await openChatWidget(page);
        await ensureActiveSession(page);

        // Type a short message and send it
        const editor = page.locator('[contenteditable="true"]').first();
        await editor.click();
        await editor.type('ping');

        const sendBtn = page.locator('.prompt-input-send-button').first();
        await expect(sendBtn).toBeVisible({ timeout: 5000 });
        await sendBtn.click();

        // The user's message should appear in the timeline
        await expect(
            page.locator('.message-timeline').locator('text=ping').first()
        ).toBeVisible({ timeout: 15000 });
    });

});
