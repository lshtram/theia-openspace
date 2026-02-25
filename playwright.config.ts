import { defineConfig, devices } from '@playwright/test';

/**
 * Playwright configuration for OpenSpace E2E tests
 * See https://playwright.dev/docs/test-configuration
 */
export default defineConfig({
  testDir: './tests/e2e',
  
  /* Global setup — ensures OpenCode server (:7890) is running.
   * Theia (:3000) is handled by webServer below. */
  globalSetup: require.resolve('./tests/e2e/global-setup'),
  
  /* Global teardown — stops any OpenCode server process started by globalSetup. */
  globalTeardown: require.resolve('./tests/e2e/global-teardown'),
  
  /* Maximum time one test can run for */
  timeout: 60 * 1000,
  
  /* Run tests in files in parallel */
  fullyParallel: false,
  
  /* Fail the build on CI if you accidentally left test.only */
  forbidOnly: !!process.env.CI,
  
  /* Retry on CI; also 1 retry locally to handle transient bridge timing issues */
  retries: process.env.CI ? 2 : 1,
  
  /* Reliability-first: run one worker in all environments. */
  workers: 1,
  
  /* Reporter to use */
  reporter: 'html',
  
  /* Shared settings for all projects */
  use: {
    /* Base URL to use in actions like `await page.goto('/')` */
    baseURL: process.env.PLAYWRIGHT_BASE_URL || 'http://localhost:3000',
    
    /* Collect trace when retrying the failed test */
    trace: 'on-first-retry',
    
    /* Screenshot only on failure */
    screenshot: 'only-on-failure',
    
    /* Video only on failure */
    video: 'retain-on-failure',
    
    /* Run in headless mode */
    headless: true,
  },

  /* Configure projects for major browsers */
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  /* Theia dev server — started automatically if not already running.
   * In non-CI mode reuseExistingServer=true so a manually-started Theia
   * is reused.  The globalSetup (scripts/global-setup-opencode.ts) handles
   * the OpenCode server on port 7890.
   * Use `npm run test:e2e` (not `npx playwright test` directly) so the
   * e2e-precheck.sh guard runs first. */
  webServer: {
    command: process.env.PLAYWRIGHT_SERVER_CMD || 'yarn start:browser',
    port: parseInt(process.env.PLAYWRIGHT_PORT || '3000', 10),
    timeout: 120 * 1000,
    reuseExistingServer: true,
  },
});
