import { PermissionNotification, Project, Session } from '../common/opencode-protocol';

export function buildProject(overrides: Partial<Project> = {}): Project {
    return {
        id: 'proj-1',
        worktree: '/test/project',
        time: { created: Date.now() },
        ...overrides,
    };
}

export function buildSession(overrides: Partial<Session> = {}): Session {
    return {
        id: 'session-1',
        projectID: 'proj-1',
        title: 'Test Session',
        time: {
            created: Date.now(),
            updated: Date.now(),
        },
        directory: '/test',
        version: '1.0.0',
        ...overrides,
    };
}

export function buildPermissionNotification(overrides: Partial<PermissionNotification> = {}): PermissionNotification {
    return {
        type: 'requested',
        sessionId: 'session-1',
        projectId: 'proj-1',
        permissionId: 'perm-123',
        permission: {
            id: 'perm-123',
            type: 'file_write',
            message: 'Agent oracle_a3f7 wants to write to /workspace/test.ts',
            status: 'pending',
        },
        ...overrides,
    };
}
