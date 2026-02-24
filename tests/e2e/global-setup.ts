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
import setupOpenCode from '../../scripts/global-setup-opencode';

const OPENCODE_PORT = parseInt(process.env.OPENCODE_PORT ?? '7890', 10);
const OPENCODE_BASE_URL = `http://localhost:${OPENCODE_PORT}`;

function getBodyPreview(body: string): string {
  return body.replace(/\s+/g, ' ').trim().slice(0, 160);
}

function isJsonContentType(contentType: string | undefined): boolean {
  return (contentType || '').toLowerCase().includes('application/json');
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0;
}

type ProjectSummary = { id: string; worktree?: string; path?: string };

function looksLikeProjectSummary(value: unknown): value is ProjectSummary {
  if (!value || typeof value !== 'object') {
    return false;
  }
  const candidate = value as { id?: unknown; worktree?: unknown; path?: unknown };
  return isNonEmptyString(candidate.id) && (isNonEmptyString(candidate.worktree) || isNonEmptyString(candidate.path));
}

async function resolveFallbackProjectId(request: import('@playwright/test').APIRequestContext, preferredPath: string): Promise<string> {
  const response = await request.get(`${OPENCODE_BASE_URL}/project`);
  const text = await response.text();
  const contentType = response.headers()['content-type'];

  if (!response.ok()) {
    throw new Error(
      `[Global Setup] Failed to list projects for fallback resolution: HTTP ${response.status()} ${response.statusText()}. ` +
      `content-type=${contentType || 'unknown'} body-preview="${getBodyPreview(text)}"`
    );
  }

  if (!isJsonContentType(contentType)) {
    throw new Error(
      `[Global Setup] Fallback /project returned non-JSON response. ` +
      `Expected application/json but got ${contentType || 'unknown'}. ` +
      `body-preview="${getBodyPreview(text)}"`
    );
  }

  let payload: unknown;
  try {
    payload = JSON.parse(text);
  } catch {
    throw new Error(`[Global Setup] Fallback /project returned invalid JSON: body-preview="${getBodyPreview(text)}"`);
  }

  if (!Array.isArray(payload)) {
    throw new Error(`[Global Setup] Fallback /project payload is not an array: body-preview="${getBodyPreview(text)}"`);
  }

  const projects = payload.filter(looksLikeProjectSummary);
  const normalizedPreferred = preferredPath.replace(/\/$/, '');

  const exact = projects.find((p) => {
    const location = (p.worktree || p.path || '').replace(/\/$/, '');
    return location === normalizedPreferred;
  });
  if (exact) {
    return exact.id;
  }

  const currentRepo = process.cwd().replace(/\/$/, '');
  const repoProject = projects.find((p) => {
    const location = (p.worktree || p.path || '').replace(/\/$/, '');
    return location === currentRepo;
  });
  if (repoProject) {
    return repoProject.id;
  }

  const prefixMatches = projects
    .map((p) => ({
      id: p.id,
      location: (p.worktree || p.path || '').replace(/\/$/, ''),
    }))
    .filter((p) => isNonEmptyString(p.location) && currentRepo.startsWith(p.location))
    .sort((a, b) => b.location.length - a.location.length);

  if (prefixMatches.length > 0) {
    return prefixMatches[0].id;
  }

  throw new Error(
    `[Global Setup] Could not deterministically resolve fallback project ID from /project. ` +
    `No entry matched demo path (${preferredPath}) or current repo (${currentRepo}).`
  );
}

async function globalSetup(_config: FullConfig) {
  console.log('[Global Setup] Initializing E2E test environment...');

  await setupOpenCode(_config);
  
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
    throw new Error(
      `[Global Setup] Failed to initialize git repository at ${demoProjectPath}. ` +
      `OpenCode project setup requires a valid git repo. Ensure git is installed and writable, then rerun ` +
      `scripts/e2e-precheck.sh (or npm run test:e2e). Original error: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  
  // Register the project with OpenCode server
  const browser = await chromium.launch();
  const context = await browser.newContext();
  const page = await context.newPage();
  
  try {
    // Call OpenCode API to initialize project
    const response = await page.request.post(`${OPENCODE_BASE_URL}/project/init`, {
      headers: {
        'Content-Type': 'application/json'
      },
      data: {
        directory: demoProjectPath
      }
    });
    
    const text = await response.text();
    const contentType = response.headers()['content-type'];

    if (!response.ok()) {
      throw new Error(
        `[Global Setup] Failed to register demo project via /project/init: ` +
        `HTTP ${response.status()} ${response.statusText()}. ` +
        `content-type=${contentType || 'unknown'} body-preview="${getBodyPreview(text)}"`
      );
    }

    if (!isJsonContentType(contentType)) {
      console.warn(
        `[Global Setup] /project/init returned non-JSON (${contentType || 'unknown'}). ` +
        `Falling back to /project lookup. body-preview="${getBodyPreview(text)}"`
      );
      const fallbackProjectId = await resolveFallbackProjectId(page.request, demoProjectPath);
      process.env.E2E_TEST_PROJECT_ID = fallbackProjectId;
      const configPath = path.join(__dirname, '.e2e-project-id');
      fs.writeFileSync(configPath, fallbackProjectId);
      console.log(`[Global Setup] Using fallback project ID from /project: ${fallbackProjectId}`);
      console.log(`[Global Setup] Saved project ID to ${configPath}`);
      return;
    }

    let project: { id?: string; worktree?: string; path?: string };
    try {
      project = JSON.parse(text);
    } catch {
      throw new Error(
        `[Global Setup] OpenCode /project/init returned invalid JSON payload. ` +
        `content-type=${contentType || 'unknown'} body-preview="${getBodyPreview(text)}"`
      );
    }

    if (!isNonEmptyString(project.id)) {
      throw new Error(
        `[Global Setup] OpenCode /project/init JSON response is missing required field "id". ` +
        `body-preview="${getBodyPreview(text)}"`
      );
    }

    const hasWorktree = isNonEmptyString(project.worktree);
    const hasPath = isNonEmptyString(project.path);
    if (!hasWorktree && !hasPath) {
      throw new Error(
        `[Global Setup] OpenCode /project/init JSON response must include a non-empty "worktree" or "path" string. ` +
        `body-preview="${getBodyPreview(text)}"`
      );
    }

    console.log('[Global Setup] Registered demo project with OpenCode:');
    console.log(`  - Project ID: ${project.id}`);
    console.log(`  - Path: ${project.worktree || project.path}`);

    // Store project ID in environment variable for tests to use
    process.env.E2E_TEST_PROJECT_ID = project.id;

    // Store in a file that tests can read
    const configPath = path.join(__dirname, '.e2e-project-id');
    fs.writeFileSync(configPath, project.id);
    console.log(`[Global Setup] Saved project ID to ${configPath}`);
  } catch (error) {
    console.error('[Global Setup] Error during setup:', error);
    throw error;
  } finally {
    await context.close();
    await browser.close();
  }
  
  console.log('[Global Setup] Setup complete!');
}

export default globalSetup;
