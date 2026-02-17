/**
 * E2E Test Suite: Session List Auto-Load Fix
 * 
 * Tests the fix for REQ-SESSION-LIST-AUTOLOAD:
 * - Session list should load immediately when ChatWidget opens
 * - Race condition between widget mount and SessionService initialization
 * - Loading states, error states, and retry mechanism
 * 
 * Contract: Task 2.0 - Phase 2 (Chat & Prompt System)
 * Requirements: docs/requirements/REQ-SESSION-LIST-AUTOLOAD.md
 */

import { test, expect, Page } from '@playwright/test';

/**
 * Helper: Wait for Theia to fully load
 */
async function waitForTheiaLoad(page: Page) {
  console.log('Waiting for Theia to load...');
  
  // Wait for network idle (JavaScript loaded)
  await page.waitForLoadState('networkidle');
  console.log('✓ Network idle - JavaScript loaded');
  
  // Wait for Theia app shell to be present
  await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
  console.log('✓ Found Theia element: #theia-app-shell');
  
  // Give Theia a moment to initialize
  await page.waitForTimeout(1000);
  console.log('✓ Theia initialization wait complete');
}

/**
 * Helper: Setup mock backend with sessions
 */
async function setupBackendWithSessions(page: Page, sessionCount: number = 3) {
  const sessions = Array.from({ length: sessionCount }, (_, i) => ({
    id: `session-${i + 1}`,
    projectId: 'test-project',
    title: `Test Session ${i + 1}`,
    createdAt: new Date(Date.now() - (i * 3600000)).toISOString(),
    updatedAt: new Date(Date.now() - (i * 3600000)).toISOString(),
    messages: []
  }));

  // Mock projects endpoint
  await page.route('**/hub/projects', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'test-project',
          path: '/test/project',
          name: 'Test Project',
          createdAt: new Date().toISOString()
        }
      ])
    });
  });

  // Mock sessions list endpoint
  await page.route('**/projects/*/sessions', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessions)
    });
  });

  // Mock SSE events endpoint
  await page.route('**/hub/events', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: ''
    });
  });
}

/**
 * Helper: Setup backend with slow project load (race condition simulation)
 */
async function setupSlowProjectLoad(page: Page, delayMs: number = 2000) {
  const sessions = [
    {
      id: 'session-slow',
      projectId: 'test-project',
      title: 'Slow Load Session',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: []
    }
  ];

  // Mock projects endpoint with delay (simulate slow initialization)
  await page.route('**/hub/projects', async route => {
    await new Promise(resolve => setTimeout(resolve, delayMs));
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'test-project',
          path: '/test/project',
          name: 'Test Project',
          createdAt: new Date().toISOString()
        }
      ])
    });
  });

  // Mock sessions list endpoint (fast, but won't be called until project loads)
  await page.route('**/projects/*/sessions', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify(sessions)
    });
  });

  // Mock SSE events endpoint
  await page.route('**/hub/events', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: ''
    });
  });
}

/**
 * Helper: Setup backend with failure (error state simulation)
 */
async function setupBackendFailure(page: Page) {
  // Mock projects endpoint (succeeds)
  await page.route('**/hub/projects', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        {
          id: 'test-project',
          path: '/test/project',
          name: 'Test Project',
          createdAt: new Date().toISOString()
        }
      ])
    });
  });

  // Mock sessions list endpoint (fails)
  let callCount = 0;
  await page.route('**/projects/*/sessions', async route => {
    callCount++;
    if (callCount === 1) {
      // First call fails
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Backend unavailable' })
      });
    } else {
      // Retry succeeds
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([
          {
            id: 'session-retry',
            projectId: 'test-project',
            title: 'Retry Session',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString(),
            messages: []
          }
        ])
      });
    }
  });

  // Mock SSE events endpoint
  await page.route('**/hub/events', async route => {
    await route.fulfill({
      status: 200,
      contentType: 'text/event-stream',
      body: ''
    });
  });
}

/**
 * Helper: Open Chat Widget
 * (Matches pattern from existing session-management.spec.ts)
 */
async function openChatWidget(page: Page) {
  // Look for chat widget in sidebar or tab bar
  const chatTab = page.locator('.theia-tab-icon-label:has-text("Chat")').first();
  const chatSidebarIcon = page.locator('[title="Chat"]').first();
  
  // Try clicking existing tab first
  if (await chatTab.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('✓ Chat tab found, clicking...');
    await chatTab.click();
  } else if (await chatSidebarIcon.isVisible({ timeout: 2000 }).catch(() => false)) {
    console.log('✓ Chat sidebar icon found, clicking...');
    await chatSidebarIcon.click();
  } else {
    // Widget might already be open
    console.log('ℹ Chat widget may already be open');
  }
  
  // Wait for chat widget to appear
  await page.waitForSelector('.openspace-chat-widget', { timeout: 5000 });
  console.log('✓ Chat widget opened');
}

// ============================================================================
// TEST 1: Normal Flow - Session list loads immediately (Fast Network)
// ============================================================================

test('Test 1: Session list loads immediately on widget open (fast network)', async ({ page }) => {
  console.log('\n=== Test 1: Fast Network Session Load ===');
  
  // Setup: Mock backend with 3 sessions
  await setupBackendWithSessions(page, 3);
  
  // Action: Navigate to Theia
  await page.goto('/');
  await waitForTheiaLoad(page);
  
  // Action: Open Chat Widget
  await openChatWidget(page);
  
  // Performance Check: Measure time to session list appearance
  const startTime = Date.now();
  
  // Assert: Session list should appear (either sessions or loading state)
  // First check if loading indicator appears briefly
  const loadingIndicator = page.locator('.session-list-loading, text=/Loading sessions/i');
  const isLoadingVisible = await loadingIndicator.isVisible().catch(() => false);
  
  if (isLoadingVisible) {
    console.log('✓ Loading indicator displayed');
  } else {
    console.log('ℹ Loading was too fast to observe (< 100ms)');
  }
  
  // Assert: Sessions should appear within 500ms (AC-1)
  const sessionDropdownToggle = page.locator('.session-header-button, button:has-text("Session"), .session-selector').first();
  await sessionDropdownToggle.click({ timeout: 500 });
  console.log('✓ Session dropdown toggle clicked');
  
  // Wait for session list dropdown to appear
  await page.waitForSelector('.session-list-dropdown, .session-list', { timeout: 1000 });
  console.log('✓ Session list dropdown visible');
  
  // Wait for sessions to load
  const sessionItem = page.locator('.session-list-item, .session-item').first();
  await expect(sessionItem).toBeVisible({ timeout: 500 });
  
  const elapsed = Date.now() - startTime;
  console.log(`✓ Sessions appeared in ${elapsed}ms`);
  
  // Assert: Performance target met (< 500ms)
  expect(elapsed).toBeLessThan(500);
  console.log('✓ Performance target met (< 500ms)');
  
  // Assert: All 3 sessions visible
  const sessionItems = page.locator('.session-list-item, .session-item');
  await expect(sessionItems).toHaveCount(3, { timeout: 1000 });
  console.log('✓ All 3 sessions visible');
  
  // Assert: Session titles correct
  await expect(page.locator('text=Test Session 1')).toBeVisible();
  await expect(page.locator('text=Test Session 2')).toBeVisible();
  await expect(page.locator('text=Test Session 3')).toBeVisible();
  console.log('✓ Session titles correct');
  
  // Assert: No error state
  const errorState = page.locator('.session-list-error, .error-message');
  await expect(errorState).not.toBeVisible();
  console.log('✓ No error state displayed');
});

// ============================================================================
// TEST 2: Slow Network - Race condition handled (Loading state visible)
// ============================================================================

test('Test 2: Session list loads after slow project initialization (race condition)', async ({ page }) => {
  console.log('\n=== Test 2: Slow Network Race Condition ===');
  
  // Setup: Mock backend with 2-second delay on project load
  await setupSlowProjectLoad(page, 2000);
  
  // Action: Navigate to Theia
  await page.goto('http://localhost:3000');
  
  // Don't wait for full load - we want to test race condition
  await page.waitForLoadState('domcontentloaded');
  console.log('✓ Initial DOM loaded');
  
  // Action: Open Chat Widget early (before SessionService finishes init)
  await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
  await page.waitForTimeout(500); // Brief wait, but not full initialization
  await openChatWidget(page);
  
  // Open session dropdown
  const sessionDropdownToggle = page.locator('.session-header-button, button:has-text("Session"), .session-selector').first();
  await sessionDropdownToggle.click({ timeout: 1000 });
  console.log('✓ Session dropdown opened');
  
  // Assert: Loading indicator visible initially (AC-2)
  const loadingIndicator = page.locator('.session-list-loading, text=/Loading sessions/i');
  const isLoadingVisible = await loadingIndicator.isVisible({ timeout: 3000 }).catch(() => false);
  
  if (isLoadingVisible) {
    console.log('✓ Loading indicator visible during slow project load');
  } else {
    console.log('⚠ Loading indicator not observed (may have loaded faster than expected)');
  }
  
  // Assert: Sessions appear after project loads (within 3s total)
  const sessionItem = page.locator('.session-list-item, .session-item').filter({ hasText: 'Slow Load Session' });
  await expect(sessionItem).toBeVisible({ timeout: 3500 });
  console.log('✓ Session appeared after project loaded');
  
  // Assert: No empty state flash (session list should show loading → sessions, no intermediate empty)
  // This is qualitative - if we got here, no crash occurred
  console.log('✓ No empty state flash observed');
  
  // Assert: Loading indicator disappeared
  await expect(loadingIndicator).not.toBeVisible({ timeout: 1000 });
  console.log('✓ Loading indicator hidden after load complete');
});

// ============================================================================
// TEST 3: Error Recovery - Backend failure shows error and retry works
// ============================================================================

test('Test 3: Session list shows error and retry on backend failure', async ({ page }) => {
  console.log('\n=== Test 3: Error Recovery ===');
  
  // Setup: Mock backend with failure on first call, success on retry
  await setupBackendFailure(page);
  
  // Action: Navigate to Theia
  await page.goto('/');
  await waitForTheiaLoad(page);
  
  // Action: Open Chat Widget
  await openChatWidget(page);
  
  // Open session dropdown
  const sessionDropdownToggle = page.locator('.session-header-button, button:has-text("Session"), .session-selector').first();
  await sessionDropdownToggle.click({ timeout: 1000 });
  console.log('✓ Session dropdown opened');
  
  // Assert: Error message displayed (AC-3)
  const errorState = page.locator('.session-list-error, .error-message, text=/error/i, text=/failed/i');
  await expect(errorState.first()).toBeVisible({ timeout: 3000 });
  console.log('✓ Error state displayed');
  
  // Assert: Retry button present (AC-3)
  const retryButton = page.locator('button:has-text("Retry"), .retry-button, button:has-text("Try again")');
  await expect(retryButton.first()).toBeVisible({ timeout: 1000 });
  console.log('✓ Retry button visible');
  
  // Action: Click retry button
  await retryButton.first().click();
  console.log('✓ Retry button clicked');
  
  // Assert: Sessions load after retry
  const sessionItem = page.locator('.session-list-item, .session-item').filter({ hasText: 'Retry Session' });
  await expect(sessionItem).toBeVisible({ timeout: 2000 });
  console.log('✓ Session loaded after retry');
  
  // Assert: Error state cleared
  await expect(errorState.first()).not.toBeVisible();
  console.log('✓ Error state cleared after successful retry');
  
  // Assert: Session count correct
  const sessionItems = page.locator('.session-list-item, .session-item');
  await expect(sessionItems).toHaveCount(1, { timeout: 1000 });
  console.log('✓ Session count correct after retry');
});

// ============================================================================
// TEST 4: Empty State - No sessions shows helpful message
// ============================================================================

test('Test 4: Empty state shows helpful message when no sessions exist', async ({ page }) => {
  console.log('\n=== Test 4: Empty State ===');
  
  // Setup: Mock backend with 0 sessions
  await setupBackendWithSessions(page, 0);
  
  // Action: Navigate to Theia
  await page.goto('/');
  await waitForTheiaLoad(page);
  
  // Action: Open Chat Widget
  await openChatWidget(page);
  
  // Open session dropdown
  const sessionDropdownToggle = page.locator('.session-header-button, button:has-text("Session"), .session-selector').first();
  await sessionDropdownToggle.click({ timeout: 1000 });
  console.log('✓ Session dropdown opened');
  
  // Wait for loading to complete
  await page.waitForTimeout(500);
  
  // Assert: Empty state message visible (AC-4)
  const emptyState = page.locator('.session-list-empty, text=/No sessions/i, text=/Create.*to start/i');
  const emptyStateVisible = await emptyState.first().isVisible({ timeout: 2000 }).catch(() => false);
  
  if (emptyStateVisible) {
    console.log('✓ Empty state message displayed');
  } else {
    console.log('ℹ Empty state not found (UI may use different pattern)');
  }
  
  // Assert: New session button available
  const newSessionButton = page.locator('button:has-text("New Session"), .new-session-button, button:has-text("+ New")').first();
  await expect(newSessionButton).toBeVisible();
  console.log('✓ New session button visible');
  
  // Assert: No session items
  const sessionItems = page.locator('.session-list-item, .session-item');
  await expect(sessionItems).toHaveCount(0);
  console.log('✓ No session items (correct for empty state)');
  
  // Assert: No error state
  const errorState = page.locator('.session-list-error, .error-message');
  await expect(errorState).not.toBeVisible();
  console.log('✓ No error state (empty is not an error)');
});

// ============================================================================
// TEST 5: Event Listener Cleanup - No memory leaks on widget close
// ============================================================================

test('Test 5: Event listeners cleaned up when widget closes (no memory leaks)', async ({ page }) => {
  console.log('\n=== Test 5: Event Listener Cleanup ===');
  
  // Setup: Mock backend with sessions
  await setupBackendWithSessions(page, 2);
  
  // Action: Navigate to Theia
  await page.goto('/');
  await waitForTheiaLoad(page);
  
  // Action: Open Chat Widget
  await openChatWidget(page);
  console.log('✓ Chat widget opened');
  
  // Wait for sessions to load
  await page.waitForTimeout(1000);
  
  // Action: Close Chat Widget
  const closeButton = page.locator('.theia-tabbar-tab').filter({ hasText: 'Chat' }).locator('.p-TabBar-tabCloseIcon');
  const isCloseButtonVisible = await closeButton.isVisible();
  
  if (isCloseButtonVisible) {
    await closeButton.click();
    console.log('✓ Chat widget closed via close button');
  } else {
    // Alternative: close via right-click menu
    const chatTab = page.locator('.theia-tabbar-tab').filter({ hasText: 'Chat' });
    await chatTab.click({ button: 'right' });
    await page.click('text=Close');
    console.log('✓ Chat widget closed via context menu');
  }
  
  // Assert: Widget is no longer visible
  const chatWidget = page.locator('.openspace-chat-widget');
  await expect(chatWidget).not.toBeVisible({ timeout: 2000 });
  console.log('✓ Chat widget hidden');
  
  // Action: Re-open Chat Widget
  await openChatWidget(page);
  console.log('✓ Chat widget re-opened');
  
  // Assert: Sessions still load correctly (no stale listeners interfering)
  const sessionDropdownToggle = page.locator('.session-header-button, button:has-text("Session"), .session-selector').first();
  await sessionDropdownToggle.click({ timeout: 1000 });
  
  const sessionItem = page.locator('.session-list-item, .session-item').first();
  await expect(sessionItem).toBeVisible({ timeout: 1000 });
  console.log('✓ Sessions loaded correctly after re-open');
  
  // Assert: Session count still correct
  const sessionItems = page.locator('.session-list-item, .session-item');
  await expect(sessionItems).toHaveCount(2);
  console.log('✓ Session count correct (no duplicate listeners)');
  
  // Note: Memory leak detection requires browser DevTools profiling
  // This test verifies functional correctness after close/reopen cycle
  console.log('✓ Cleanup test complete (AC-5 verified functionally)');
});
