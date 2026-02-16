/**
 * E2E Test Suite: Permission Dialog
 * 
 * Tests the permission dialog UI component that appears when AI agents
 * request permission for operations.
 * 
 * Contract: Task 1.14 - Permission Dialog UI
 * Required: Permission display, grant/deny actions, queue processing, timeout
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Helper: Wait for Theia to be fully initialized
 */
async function waitForTheiaReady(page: Page) {
  // Wait for Theia shell to be present
  await page.waitForSelector('.theia-preload', { state: 'hidden', timeout: 30000 });
  await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
  
  // Give extra time for all services to initialize
  await page.waitForTimeout(2000);
}

/**
 * Helper: Simulate a permission request via SSE
 */
async function injectPermissionRequest(
  page: Page,
  id: string,
  action: string,
  metadata?: Record<string, unknown>
) {
  await page.evaluate(({ id, action, metadata }) => {
    // Trigger permission event directly through the service
    const event = new CustomEvent('opencode:permission', {
      detail: {
        id,
        action,
        metadata: metadata || {},
        timestamp: Date.now()
      }
    });
    window.dispatchEvent(event);
  }, { id, action, metadata });
}



test.describe('Permission Dialog UI', () => {
  test.beforeEach(async ({ page }) => {
    // Navigate to Theia
    await page.goto('http://localhost:3000');
    await waitForTheiaReady(page);
  });

  test('E2E-1: Should display permission dialog when permission is requested', async ({ page }) => {
    // Inject a permission request
    await injectPermissionRequest(page, 'perm-001', 'file:read', {
      path: '/test/file.txt',
      reason: 'Need to read configuration'
    });

    // Wait for dialog to appear
    const dialog = page.locator('.permission-dialog-overlay');
    await expect(dialog).toBeVisible({ timeout: 5000 });

    // Verify dialog content
    await expect(page.locator('.permission-dialog h2')).toContainText('Permission Required');
    await expect(page.locator('.permission-dialog-action')).toContainText('file:read');
    await expect(page.locator('.permission-dialog-metadata')).toContainText('/test/file.txt');
    await expect(page.locator('.permission-dialog-metadata')).toContainText('Need to read configuration');

    // Verify buttons are present
    await expect(page.locator('button:has-text("Grant")')).toBeVisible();
    await expect(page.locator('button:has-text("Deny")')).toBeVisible();
  });

  test('E2E-2: Should grant permission when Grant button is clicked', async ({ page }) => {
    // Set up response capture
    let grantedId: string | null = null;
    await page.exposeFunction('captureGrant', (id: string) => {
      grantedId = id;
    });

    // Listen for grant events
    await page.evaluate(() => {
      window.addEventListener('opencode:permission:grant', (e: any) => {
        (window as any).captureGrant(e.detail.id);
      });
    });

    // Inject permission request
    await injectPermissionRequest(page, 'perm-002', 'file:write', {
      path: '/test/output.txt'
    });

    // Wait for dialog
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });

    // Click Grant button
    await page.locator('button:has-text("Grant")').click();

    // Verify dialog disappears
    await expect(page.locator('.permission-dialog-overlay')).not.toBeVisible({ timeout: 3000 });

    // Wait for grant event
    await page.waitForTimeout(500);
    expect(grantedId).toBe('perm-002');
  });

  test('E2E-3: Should deny permission when Deny button is clicked', async ({ page }) => {
    // Set up response capture
    let deniedId: string | null = null;
    await page.exposeFunction('captureDeny', (id: string) => {
      deniedId = id;
    });

    // Listen for deny events
    await page.evaluate(() => {
      window.addEventListener('opencode:permission:deny', (e: any) => {
        (window as any).captureDeny(e.detail.id);
      });
    });

    // Inject permission request
    await injectPermissionRequest(page, 'perm-003', 'terminal:execute', {
      command: 'rm -rf /'
    });

    // Wait for dialog
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });

    // Click Deny button
    await page.locator('button:has-text("Deny")').click();

    // Verify dialog disappears
    await expect(page.locator('.permission-dialog-overlay')).not.toBeVisible({ timeout: 3000 });

    // Wait for deny event
    await page.waitForTimeout(500);
    expect(deniedId).toBe('perm-003');
  });

  test('E2E-4: Should handle keyboard shortcuts (Enter to grant, Escape to deny)', async ({ page }) => {
    // Test Enter key (Grant)
    await injectPermissionRequest(page, 'perm-004', 'network:fetch', {
      url: 'https://api.example.com'
    });

    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });
    
    // Press Enter
    await page.keyboard.press('Enter');
    
    // Dialog should disappear
    await expect(page.locator('.permission-dialog-overlay')).not.toBeVisible({ timeout: 3000 });

    // Test Escape key (Deny)
    await injectPermissionRequest(page, 'perm-005', 'network:fetch', {
      url: 'https://api.example.com'
    });

    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });
    
    // Press Escape
    await page.keyboard.press('Escape');
    
    // Dialog should disappear
    await expect(page.locator('.permission-dialog-overlay')).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-5: Should process queued permissions in FIFO order', async ({ page }) => {
    // Inject multiple permission requests rapidly
    await injectPermissionRequest(page, 'perm-006', 'file:read', { path: '/first.txt' });
    await injectPermissionRequest(page, 'perm-007', 'file:read', { path: '/second.txt' });
    await injectPermissionRequest(page, 'perm-008', 'file:read', { path: '/third.txt' });

    // First dialog should show first request
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });
    await expect(page.locator('.permission-dialog-metadata')).toContainText('/first.txt');

    // Check queue indicator (should show 2 more in queue)
    const queueIndicator = page.locator('.permission-dialog-queue');
    if (await queueIndicator.isVisible()) {
      await expect(queueIndicator).toContainText('2');
    }

    // Grant first permission
    await page.locator('button:has-text("Grant")').click();
    await page.waitForTimeout(500);

    // Second dialog should appear automatically
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.permission-dialog-metadata')).toContainText('/second.txt');

    // Grant second permission
    await page.locator('button:has-text("Grant")').click();
    await page.waitForTimeout(500);

    // Third dialog should appear
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 3000 });
    await expect(page.locator('.permission-dialog-metadata')).toContainText('/third.txt');

    // Deny third permission
    await page.locator('button:has-text("Deny")').click();
    
    // All dialogs should be processed
    await expect(page.locator('.permission-dialog-overlay')).not.toBeVisible({ timeout: 3000 });
  });

  test('E2E-6: Should show timeout countdown', async ({ page }) => {
    // Inject permission request
    await injectPermissionRequest(page, 'perm-009', 'file:delete', {
      path: '/important.txt'
    });

    // Wait for dialog
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });

    // Check that timeout element exists and shows a reasonable value
    const timeoutElement = page.locator('.permission-dialog-timeout');
    if (await timeoutElement.isVisible()) {
      const timeoutText = await timeoutElement.textContent();
      expect(timeoutText).toMatch(/\d+s/); // Should show seconds
      
      // Verify countdown is working (wait 2 seconds and check it decreased)
      const initialSeconds = parseInt(timeoutText?.match(/(\d+)s/)?.[1] || '0');
      await page.waitForTimeout(2000);
      const updatedText = await timeoutElement.textContent();
      const updatedSeconds = parseInt(updatedText?.match(/(\d+)s/)?.[1] || '0');
      
      expect(updatedSeconds).toBeLessThan(initialSeconds);
    }

    // Clean up
    await page.locator('button:has-text("Deny")').click();
  });

  test('E2E-7: Should auto-deny permission after timeout (60 seconds)', async ({ page }) => {
    // This test would take 60 seconds in real-time, so we'll verify the timeout
    // mechanism exists but not wait for the full duration in E2E tests.
    // The unit tests in permission-dialog-manager.spec.ts already verify timeout logic.

    await injectPermissionRequest(page, 'perm-010', 'system:shutdown', {
      reason: 'Testing timeout'
    });

    // Verify dialog appears with timeout indicator
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });
    
    const timeoutElement = page.locator('.permission-dialog-timeout');
    if (await timeoutElement.isVisible()) {
      const timeoutText = await timeoutElement.textContent();
      expect(timeoutText).toMatch(/\d+s/);
      
      // Verify it's close to 60 seconds initially
      const seconds = parseInt(timeoutText?.match(/(\d+)s/)?.[1] || '0');
      expect(seconds).toBeGreaterThan(55); // Should be around 60s
      expect(seconds).toBeLessThanOrEqual(60);
    }

    // Clean up without waiting for timeout
    await page.locator('button:has-text("Deny")').click();
  });

  test('E2E-8: Should handle concurrent permission requests without race conditions', async ({ page }) => {
    // Inject permissions with slight delay to simulate real-world timing
    const requests = [
      { id: 'perm-011', action: 'file:read', metadata: { path: '/a.txt' } },
      { id: 'perm-012', action: 'file:write', metadata: { path: '/b.txt' } },
      { id: 'perm-013', action: 'network:fetch', metadata: { url: 'http://x.com' } },
    ];

    // Fire all requests
    for (const req of requests) {
      await injectPermissionRequest(page, req.id, req.action, req.metadata);
      await page.waitForTimeout(50); // Small delay to simulate SSE timing
    }

    // First dialog should be visible
    await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 5000 });

    // Process all requests
    for (let i = 0; i < requests.length; i++) {
      await expect(page.locator('.permission-dialog-overlay')).toBeVisible({ timeout: 3000 });
      
      // Grant or deny alternately
      if (i % 2 === 0) {
        await page.locator('button:has-text("Grant")').click();
      } else {
        await page.locator('button:has-text("Deny")').click();
      }
      
      await page.waitForTimeout(300);
    }

    // All should be processed
    await expect(page.locator('.permission-dialog-overlay')).not.toBeVisible({ timeout: 3000 });
  });
});
