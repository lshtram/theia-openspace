import * as fs from 'fs';
import * as path from 'path';

const PROJECT_ID_FILE = path.join(__dirname, '..', '.e2e-project-id');

export function getE2eProjectId(): string | undefined {
    if (!fs.existsSync(PROJECT_ID_FILE)) {
        return process.env.E2E_TEST_PROJECT_ID;
    }
    const value = fs.readFileSync(PROJECT_ID_FILE, 'utf-8').trim();
    return value || process.env.E2E_TEST_PROJECT_ID;
}

export async function createTestSession(projectId: string, title: string): Promise<{ id: string }> {
    const response = await fetch('http://localhost:7890/session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ projectID: projectId, title }),
    });

    if (!response.ok) {
        throw new Error(`Failed to create test session: ${response.status} ${response.statusText}`);
    }

    return response.json() as Promise<{ id: string }>;
}
