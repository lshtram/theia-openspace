import { FullConfig } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';
import teardownOpenCode from '../../scripts/global-teardown-opencode';

async function globalTeardown(config: FullConfig): Promise<void> {
    const demoProjectPath = path.join('/tmp', 'openspace-e2e-demo-project');
    if (fs.existsSync(demoProjectPath)) {
        fs.rmSync(demoProjectPath, { recursive: true, force: true });
    }

    const projectIdFile = path.join(__dirname, '.e2e-project-id');
    if (fs.existsSync(projectIdFile)) {
        fs.unlinkSync(projectIdFile);
    }

    await teardownOpenCode(config);
}

export default globalTeardown;
