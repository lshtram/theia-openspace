# Contract: Task 1.2 — Implement OpenCodeProxy (backend)

## Contract ID
`contract-1.2-opencode-proxy`

## Task
**WORKPLAN.md Task 1.2** — Implement OpenCodeProxy (backend)

## Source of Truth
- WORKPLAN.md §1.2
- TECHSPEC-THEIA-OPENSPACE.md §3.1.2 (OpenCodeProxy)
- opencode API spec: `/Users/Shared/dev/opencode/specs/project.md`
- Types defined in Task 1.1: `extensions/openspace-core/src/common/opencode-protocol.ts`

## Deliverable

Create `extensions/openspace-core/src/node/opencode-proxy.ts`

This file must implement the `OpenCodeService` interface (from `opencode-protocol.ts`) and make HTTP calls to the opencode server REST API.

### Implementation Requirements

1. **Class**: `OpenCodeProxy` implements `OpenCodeService`

2. **Constructor**: Accept dependencies:
   - `RestClient` (or similar HTTP client from @theia/core)
   - `OpenCodeClient` (the RPC callback interface)
   - Server URL configuration

3. **HTTP Client Setup**: Use `@theia/core`'s `HttpClient` or `RequestService` to make REST calls to the opencode server

4. **Implement all `OpenCodeService` methods**:
   | Method | HTTP Call | Endpoint |
   |--------|-----------|----------|
   | `getProjects()` | GET | `/project` |
   | `initProject(directory)` | POST | `/project/init` (body: `{directory}`) |
   | `getSessions(projectId)` | GET | `/project/:projectId/session` |
   | `getSession(projectId, sessionId)` | GET | `/project/:projectId/session/:sessionId` |
   | `createSession(projectId, session)` | POST | `/project/:projectId/session` |
   | `deleteSession(projectId, sessionId)` | DELETE | `/project/:projectId/session/:sessionId` |
   | `initSession(projectId, sessionId)` | POST | `/project/:projectId/session/:sessionId/init` |
   | `abortSession(projectId, sessionId)` | POST | `/project/:projectId/session/:sessionId/abort` |
   | `shareSession(projectId, sessionId)` | POST | `/project/:projectId/session/:sessionId/share` |
   | `unshareSession(projectId, sessionId)` | DELETE | `/project/:projectId/session/:sessionId/share` |
   | `compactSession(projectId, sessionId)` | POST | `/project/:projectId/session/:sessionId/compact` |
   | `revertSession(projectId, sessionId)` | POST | `/project/:projectId/session/:sessionId/revert` |
   | `unrevertSession(projectId, sessionId)` | POST | `/project/:projectId/session/:sessionId/unrevert` |
   | `grantPermission(projectId, sessionId, permissionId)` | POST | `/project/:projectId/session/:sessionId/permission/:permissionId` |
   | `getMessages(projectId, sessionId)` | GET | `/project/:projectId/session/:sessionId/message` |
   | `getMessage(projectId, sessionId, messageId)` | GET | `/project/:projectId/session/:sessionId/message/:messageId` |
   | `createMessage(projectId, sessionId, message)` | POST | `/project/:projectId/session/:sessionId/message` |
   | `findFiles(projectId, sessionId)` | GET | `/project/:projectId/session/:sessionId/find/file` |
   | `getFile(projectId, sessionId)` | GET | `/project/:projectId/session/:sessionId/file` |
   | `getFileStatus(projectId, sessionId)` | GET | `/project/:projectId/session/:sessionId/file/status` |
   | `getAgent(projectId, directory?)` | GET | `/project/:projectId/agent?directory=...` |
   | `getProvider(directory?)` | GET | `/provider?directory=...` |
   | `getConfig(directory?)` | GET | `/config?directory=...` |

5. **Implement RpcServer methods**:
   - `setClient(client: OpenCodeClient | null): void` — Store the client for callbacks

6. **Error Handling**:
   - Throw meaningful errors on HTTP failures
   - Map HTTP status codes to appropriate error types

7. **Type Conversions**:
   - Map opencode API response types to the TypeScript interfaces defined in Task 1.1

## Constraints

1. **No SSE yet** — Task 1.3 will add SSE; this is just HTTP calls
2. **Type-safe** — Use the interfaces from Task 1.1
3. **No UI** — Backend only
4. **Configuration** — Accept server URL via constructor or Theia preferences

## Validation

After implementation:
```bash
cd /Users/Shared/dev/theia-openspace && yarn build
```

Must compile without errors in YOUR code.

## Notes

- Use `@theia/core` HTTP utilities: `RequestService` or `HttpClient`
- The opencode server runs externally — this proxy calls it via HTTP
- Pre-existing LSP errors in Theia's node_modules — ignore them
- File location: `extensions/openspace-core/src/node/opencode-proxy.ts`
