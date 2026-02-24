import { expect, Page, test } from '@playwright/test';

export const BASE_URL = 'http://localhost:3000';

export async function dismissWorkspaceTrustDialog(page: Page): Promise<void> {
    try {
        const trustDialog = page.locator('.workspace-trust-dialog');
        const isVisible = await trustDialog.isVisible({ timeout: 3000 }).catch(() => false);
        if (isVisible) {
            await page.locator('.workspace-trust-dialog .theia-button.main').click();
            await trustDialog.waitFor({ state: 'hidden', timeout: 5000 });
        }
    } catch {
        // Dialog not present.
    }
}

export async function waitForTheiaReady(page: Page): Promise<void> {
    await page.waitForSelector('.theia-preload', { state: 'hidden', timeout: 30000 });
    await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
    await page.locator('.theia-ApplicationShell, #theia-app-shell').first().waitFor({ state: 'attached', timeout: 5000 });
    await dismissWorkspaceTrustDialog(page);
}

export async function openChatWidget(page: Page): Promise<void> {
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

export async function isOpenCodeAvailable(): Promise<boolean> {
    try {
        const resp = await fetch('http://localhost:7890/v1/health').catch(() => null);
        return resp !== null && resp.ok;
    } catch {
        return false;
    }
}

export async function skipUnlessTier(tier: 1 | 2 | 3, message: string): Promise<void> {
    if (tier === 3) {
        const available = await isOpenCodeAvailable();
        test.skip(!available, message);
    }
}

export async function ensureTestHooks(page: Page): Promise<void> {
    const hasHooks = await page.evaluate(() => typeof (window as unknown as { __openspace_test__?: unknown }).__openspace_test__ !== 'undefined');
    expect(hasHooks).toBeTruthy();
}
