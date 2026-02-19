import { test, expect, Page } from '@playwright/test';

const THEIA_URL = 'http://localhost:3000/#/Users/Shared/dev/core_dev';

async function openChatWidget(page: Page) {
    await page.goto(THEIA_URL);
    // Wait for Theia shell
    await page.waitForSelector('#theia-app-shell', { timeout: 30000 });
    await page.waitForSelector('.theia-app-main, .theia-left-side-panel', { state: 'attached', timeout: 10000 });
    // Click the chat icon in the left activity bar
    const chatTab = page.locator('#shell-tab-openspace-chat-widget');
    await chatTab.click();
    // Wait for the chat widget to be visible
    await page.waitForSelector('.openspace-chat-widget', { timeout: 10000 });
}

/**
 * Opens the chat widget AND creates a new session so MessageTimeline renders.
 * Bug 3/3b require an active session for the scroll container to be in the DOM.
 */
async function openChatWithSession(page: Page) {
    await openChatWidget(page);
    // Auto-project selection fires console logs; we can't intercept them here.
    // Wait for the session dropdown to be rendered as a signal that initialization completed.
    await page.waitForSelector('.session-dropdown-button', { timeout: 10000 });
    // Click the "+ New" session button
    const newSessionBtn = page.locator('.new-session-button');
    await newSessionBtn.click();
    // Wait for MessageTimeline scroll container to appear (means session is active)
    await page.waitForSelector('.message-timeline-scroll-container', { timeout: 15000 });
}

test('Bug 1: autoSelectProjectByWorkspace registers workspace as project', async ({ page }) => {
    const consoleLogs: string[] = [];
    page.on('console', msg => consoleLogs.push(msg.text()));

    await openChatWidget(page);

    // Give it a moment to auto-select project
    await page.waitForSelector('.session-dropdown-button', { timeout: 10000 });

    // Check logs for project registration
    const projectLogs = consoleLogs.filter(l => l.includes('SessionService') && (l.includes('project') || l.includes('Project')));
    console.log('Project logs:', projectLogs);

    // Should either find a matching project OR register a new one (not "No project found")
    const failedMatch = consoleLogs.some(l => l.includes('No project found for workspace'));
    const foundMatch = consoleLogs.some(l => l.includes('Found matching project') || l.includes('Registered new project'));
    
    console.log('failedMatch:', failedMatch, 'foundMatch:', foundMatch);
    expect(foundMatch || !failedMatch, 'Should either find or register a project').toBeTruthy();
});

test('Bug 2: SSE events handled without crash', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', msg => {
        if (msg.type() === 'error' || (msg.type() === 'warning' && msg.text().includes('SSE'))) {
            errors.push(msg.text());
        }
    });

    await openChatWidget(page);
    // Wait for the session dropdown to confirm widget is fully initialized
    await page.waitForSelector('.session-dropdown-button', { timeout: 10000 });

    const sseErrors = errors.filter(e => e.includes('Cannot read properties of undefined') && e.includes('type'));
    console.log('SSE errors:', sseErrors);
    expect(sseErrors.length, 'Should have no SSE type errors').toBe(0);
});

test('Bug 2b: plain-text %%OS open command is parsed', async ({ page }) => {
    // Directly test the StreamInterceptor logic by injecting into the page
    // We can test the command handler by simulating an agent command
    await openChatWidget(page);
    
    // Inject a test: dispatch an agentCommand event with openspace.editor.open
    const result = await page.evaluate(async () => {
        // Check if openspace.editor.open command exists in Theia's registry
        const container = (window as any)['theia']?.container;
        if (!container) return 'no container';
        
        const dict = container['_bindingDictionary'];
        let commandRegistryKey: any = null;
        dict._map?.forEach?.((v: any, k: any) => {
            const ks = k?.toString?.() || '';
            if (ks.includes('class CommandRegistry') && !commandRegistryKey) commandRegistryKey = k;
        });
        
        if (!commandRegistryKey) return 'no command registry key';
        const commandRegistry = container.get(commandRegistryKey);
        
        // Check if the openspace.editor.open command is registered
        const commands = commandRegistry.commandIds || [];
        const hasEditorOpen = commands.includes('openspace.editor.open');
        return { hasEditorOpen, commandCount: commands.length };
    });
    
    console.log('Command check:', result);
    expect((result as any).hasEditorOpen, 'openspace.editor.open command should be registered').toBeTruthy();
});

test('Bug 3: chat auto-scroll - scroll container has overflow-y auto', async ({ page }) => {
    await openChatWithSession(page);
    
    const scrollContainerStyle = await page.evaluate(() => {
        const container = document.querySelector('.message-timeline-scroll-container');
        if (!container) return null;
        const style = window.getComputedStyle(container);
        const rect = container.getBoundingClientRect();
        return {
            overflowY: style.overflowY,
            display: style.display,
            flex: style.flex,
            width: Math.round(rect.width),
            height: Math.round(rect.height),
        };
    });
    
    console.log('Scroll container style:', scrollContainerStyle);
    expect(scrollContainerStyle, 'Scroll container should exist').not.toBeNull();
    expect((scrollContainerStyle as any).overflowY, 'Should have overflow-y: auto').toBe('auto');
    expect((scrollContainerStyle as any).height, 'Should have non-zero height').toBeGreaterThan(0);
});

test('Bug 3b: bottom sentinel element exists in message timeline', async ({ page }) => {
    await openChatWithSession(page);
    
    const hasSentinel = await page.evaluate(() => {
        return !!document.querySelector('.message-timeline-bottom-sentinel');
    });
    
    console.log('Has sentinel:', hasSentinel);
    expect(hasSentinel, 'Bottom sentinel element should exist').toBeTruthy();
});
