import { chromium } from '@playwright/test';

const browser = await chromium.launch({ headless: true });
const context = await browser.newContext();
const page = await context.newPage();

// Capture console messages
page.on('console', msg => {
  console.log(`[BROWSER ${msg.type()}]: ${msg.text()}`);
});

page.on('pageerror', error => {
  console.log(`[PAGE ERROR]: ${error.message}`);
});

try {
  await page.goto('http://localhost:3000', { timeout: 30000 });
  console.log('Page loaded');
  
  // Wait a bit for JS to execute
  await page.waitForTimeout(15000);
  
  // Check what's on the page
  const html = await page.content();
  console.log('HTML length:', html.length);
  console.log('Has theia-app-shell:', html.includes('theia-app-shell'));
  console.log('Has theia-preload:', html.includes('theia-preload'));
  
} catch (e) {
  console.log('Error:', e.message);
}

await browser.close();
