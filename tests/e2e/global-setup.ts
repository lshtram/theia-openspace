/**
 * Playwright Global Setup
 * 
 * Creates a demo E2E test project in the OpenCode server before running tests.
 * This avoids contaminating real projects with test data.
 */

import { chromium, FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import { execSync } from 'child_process';

async function globalSetup(_config: FullConfig) {
  console.log('[Global Setup] Initializing E2E test environment...');
  
  // Create a temporary directory for the demo project
  const demoProjectPath = path.join('/tmp', 'openspace-e2e-demo-project');
  
  // Clean up any existing demo project
  if (fs.existsSync(demoProjectPath)) {
    console.log('[Global Setup] Cleaning up existing demo project...');
    fs.rmSync(demoProjectPath, { recursive: true, force: true });
  }
  
  // Create fresh demo project directory
  fs.mkdirSync(demoProjectPath, { recursive: true });
  console.log(`[Global Setup] Created demo project directory: ${demoProjectPath}`);
  
  // Initialize git repo (OpenCode requires git)
  try {
    execSync('git init', { cwd: demoProjectPath, stdio: 'pipe' });
    execSync('git config user.email "test@example.com"', { cwd: demoProjectPath, stdio: 'pipe' });
    execSync('git config user.name "E2E Test"', { cwd: demoProjectPath, stdio: 'pipe' });
    
    // Create a dummy file and commit
    fs.writeFileSync(path.join(demoProjectPath, 'README.md'), '# E2E Test Project\n\nThis is a demo project for E2E tests.\n');
    execSync('git add .', { cwd: demoProjectPath, stdio: 'pipe' });
    execSync('git commit -m "Initial commit"', { cwd: demoProjectPath, stdio: 'pipe' });
    console.log('[Global Setup] Initialized git repository');
  } catch (error) {
    console.error('[Global Setup] Failed to initialize git:', error);
  }
  
  // Register the project with OpenCode server
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Call OpenCode API to initialize project
    const response = await page.request.post('http://localhost:7890/project/init', {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        directory: demoProjectPath
      }
    });
    
    if (response.ok()) {
      const project = await response.json();
      console.log('[Global Setup] Registered demo project with OpenCode:');
      console.log(`  - Project ID: ${project.id}`);
      console.log(`  - Path: ${project.worktree || project.path}`);
      
      // Store project ID in environment variable for tests to use
      process.env.E2E_TEST_PROJECT_ID = project.id;
      
      // Store in a file that tests can read
      const configPath = path.join(__dirname, '.e2e-project-id');
      fs.writeFileSync(configPath, project.id);
      console.log(`[Global Setup] Saved project ID to ${configPath}`);
    } else {
      console.error('[Global Setup] Failed to register project:', response.status(), response.statusText());
      const text = await response.text();
      console.error('[Global Setup] Response:', text);
    }
  } catch (error) {
    console.error('[Global Setup] Error during setup:', error);
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('[Global Setup] Setup complete!');
}

export default globalSetup;
