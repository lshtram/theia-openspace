/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Unit tests for OpenCodeProxy HTTP/REST methods.
 *
 * After decomposition, the request pipeline is:
 *   OpenCodeProxy → RestApiFacade → HttpClient.rawRequest()
 *
 * These tests create a MockHttpClient that intercepts rawRequest,
 * then wire RestApiFacade + OpenCodeProxy manually (bypassing Theia DI)
 * to test the full delegation chain with the same semantics as the
 * original TestableProxy subclass.
 */

import { expect } from 'chai';
import { HttpClient } from '../opencode-proxy/http-client';
import { RestApiFacade } from '../opencode-proxy/rest-api';
import { OpenCodeProxy } from '../opencode-proxy/opencode-proxy';

// ─── MockHttpClient ──────────────────────────────────────────────────────────

type RawResponse = { statusCode: number; body: string };

class MockHttpClient extends HttpClient {
    public capturedUrl = '';
    public capturedMethod = '';
    public capturedBody: string | undefined;

    constructor(url = 'http://localhost:7890') {
        super();
        (this as any).serverUrl = url;
        (this as any).logger = {
            info: () => {},
            debug: () => {},
            warn: () => {},
            error: () => {}
        };
    }

    public mockRawRequest?: (url: string, method: string, body?: string) => RawResponse;

    override rawRequest(
        url: string,
        method: string,
        _headers: Record<string, string>,
        body?: string
    ): Promise<RawResponse> {
        this.capturedUrl = url;
        this.capturedMethod = method;
        this.capturedBody = body;
        if (this.mockRawRequest) {
            return Promise.resolve(this.mockRawRequest(url, method, body));
        }
        return Promise.reject(new Error('No mockRawRequest configured'));
    }

    /** Helper: configure mock to return JSON */
    public respondWith(data: unknown, statusCode = 200): void {
        this.mockRawRequest = () => ({ statusCode, body: JSON.stringify(data) });
    }

    /** Helper: configure mock to return an error status */
    public respondWithError(statusCode: number, message = 'Error'): void {
        this.mockRawRequest = () => ({ statusCode, body: message });
    }
}

// ─── Test Wiring ─────────────────────────────────────────────────────────────

/** Build a fully-wired OpenCodeProxy with a MockHttpClient (no DI container). */
function createTestProxy(url = 'http://localhost:7890'): { proxy: OpenCodeProxy; mock: MockHttpClient } {
    const mock = new MockHttpClient(url);

    const rest = new RestApiFacade();
    (rest as any).http = mock;

    const proxy = new OpenCodeProxy();
    (proxy as any).rest = rest;
    // Stub SSE and NodeUtils — not needed for HTTP tests
    (proxy as any).sse = { setClient: () => {}, disconnectSSE: () => {}, dispose: () => {} };
    (proxy as any).nodeUtils = {};
    (proxy as any).logger = {
        info: () => {},
        debug: () => {},
        warn: () => {},
        error: () => {}
    };

    return { proxy, mock };
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('OpenCodeProxy — HTTP methods', () => {
    let proxy: OpenCodeProxy;
    let mock: MockHttpClient;

    beforeEach(() => {
        ({ proxy, mock } = createTestProxy('http://localhost:7890'));
    });

    // ── Project methods ──────────────────────────────────────────────────────

    describe('getProjects()', () => {
        it('makes GET /project', async () => {
            mock.respondWith([{ id: 'p1', worktree: '/ws', time: { created: 0 } }]);
            const projects = await proxy.getProjects();
            expect(mock.capturedMethod).to.equal('GET');
            expect(mock.capturedUrl).to.include('/project');
            expect(projects).to.have.length(1);
            expect(projects[0].id).to.equal('p1');
        });
    });

    describe('initProject()', () => {
        it('makes POST /project/init with directory', async () => {
            mock.respondWith({ id: 'p2', worktree: '/new', time: { created: 1 } });
            const project = await proxy.initProject('/new/workspace');
            expect(mock.capturedMethod).to.equal('POST');
            expect(mock.capturedUrl).to.include('/project/init');
            const sentBody = JSON.parse(mock.capturedBody!);
            expect(sentBody.directory).to.equal('/new/workspace');
            expect(project.id).to.equal('p2');
        });
    });

    // ── Session methods ──────────────────────────────────────────────────────

    describe('getSessions()', () => {
        it('makes GET /session', async () => {
            mock.respondWith([{ id: 's1', title: 'Test', time: { created: 0 } }]);
            const sessions = await proxy.getSessions('proj-1');
            expect(mock.capturedMethod).to.equal('GET');
            expect(mock.capturedUrl).to.include('/session');
            expect(sessions[0].id).to.equal('s1');
        });
    });

    describe('createSession()', () => {
        it('makes POST /session with session data', async () => {
            mock.respondWith({ id: 's2', title: 'New Session', time: { created: 0 } });
            const session = await proxy.createSession('proj-1', { title: 'New Session' });
            expect(mock.capturedMethod).to.equal('POST');
            expect(mock.capturedUrl).to.match(/\/session$/);
            expect(session.id).to.equal('s2');
        });
    });

    describe('deleteSession()', () => {
        it('makes DELETE /session/:id', async () => {
            mock.mockRawRequest = () => ({ statusCode: 204, body: '' });
            await proxy.deleteSession('proj-1', 'sess-abc');
            expect(mock.capturedMethod).to.equal('DELETE');
            expect(mock.capturedUrl).to.include('/session/sess-abc');
        });

        it('URL-encodes session ID', async () => {
            mock.mockRawRequest = () => ({ statusCode: 204, body: '' });
            await proxy.deleteSession('proj-1', 'sess with spaces');
            expect(mock.capturedUrl).to.include('sess%20with%20spaces');
        });
    });

    describe('abortSession()', () => {
        it('makes POST /session/:id/abort', async () => {
            mock.respondWith({ id: 'sess-1', title: 'Aborted', time: { created: 0 } });
            const result = await proxy.abortSession('proj-1', 'sess-1');
            expect(mock.capturedMethod).to.equal('POST');
            expect(mock.capturedUrl).to.include('/session/sess-1/abort');
            expect(result.id).to.equal('sess-1');
        });
    });

    // ── Message methods ──────────────────────────────────────────────────────

    describe('getMessages()', () => {
        it('makes GET /session/:id/message', async () => {
            mock.respondWith([{ id: 'm1', parts: [], role: 'user' }]);
            const messages = await proxy.getMessages('proj-1', 'sess-1');
            expect(mock.capturedMethod).to.equal('GET');
            expect(mock.capturedUrl).to.include('/session/sess-1/message');
            expect(messages).to.have.length(1);
        });
    });

    describe('createMessage()', () => {
        it('makes POST /session/:id/message with parts', async () => {
            mock.respondWith({ info: { id: 'm2', role: 'user', parts: [], time: { created: 0 } }, parts: [{ type: 'text', text: 'hello' }] });
            const message = await proxy.createMessage(
                'proj-1', 'sess-1',
                { parts: [{ type: 'text', text: 'hello' } as any] }
            );
            expect(mock.capturedMethod).to.equal('POST');
            expect(mock.capturedUrl).to.include('/session/sess-1/message');
            const body = JSON.parse(mock.capturedBody!);
            expect(body.parts).to.have.length(1);
            expect(message.info.id).to.equal('m2');
        });

        it('includes model when provided', async () => {
            mock.respondWith({ info: { id: 'm3', role: 'user', parts: [], time: { created: 0 } }, parts: [] });
            await proxy.createMessage(
                'proj-1', 'sess-1',
                { parts: [] },
                { providerID: 'anthropic', modelID: 'claude-3-5-sonnet' }
            );
            const body = JSON.parse(mock.capturedBody!);
            expect(body.model).to.deep.equal({ providerID: 'anthropic', modelID: 'claude-3-5-sonnet' });
        });

        it('omits model when not provided', async () => {
            mock.respondWith({ info: { id: 'm4', role: 'user', parts: [], time: { created: 0 } }, parts: [] });
            await proxy.createMessage('proj-1', 'sess-1', { parts: [] });
            const body = JSON.parse(mock.capturedBody!);
            expect(body.model).to.be.undefined;
        });
    });

    // ── Permission methods ───────────────────────────────────────────────────

    describe('replyPermission()', () => {
        it('makes POST /permission/:requestId/reply with reply=once', async () => {
            mock.respondWith({});
            await proxy.replyPermission('proj-1', 'req-123', 'once');
            expect(mock.capturedMethod).to.equal('POST');
            expect(mock.capturedUrl).to.include('/permission/req-123/reply');
            const body = JSON.parse(mock.capturedBody!);
            expect(body.reply).to.equal('once');
        });

        it('sends reply=always', async () => {
            mock.respondWith({});
            await proxy.replyPermission('proj-1', 'req-456', 'always');
            const body = JSON.parse(mock.capturedBody!);
            expect(body.reply).to.equal('always');
        });

        it('sends reply=reject', async () => {
            mock.respondWith({});
            await proxy.replyPermission('proj-1', 'req-789', 'reject');
            const body = JSON.parse(mock.capturedBody!);
            expect(body.reply).to.equal('reject');
        });
    });

    // ── Models / config methods ──────────────────────────────────────────────

    describe('getAvailableModels()', () => {
        it('makes GET /config/providers and returns providers array', async () => {
            mock.respondWith({
                providers: [
                    { id: 'anthropic', name: 'Anthropic', models: [] },
                    { id: 'openai', name: 'OpenAI', models: [] }
                ]
            });
            const models = await proxy.getAvailableModels();
            expect(mock.capturedMethod).to.equal('GET');
            expect(mock.capturedUrl).to.include('/config/providers');
            expect(models).to.have.length(2);
            expect(models[0].id).to.equal('anthropic');
        });

        it('passes directory as query param when provided', async () => {
            mock.respondWith({ providers: [] });
            await proxy.getAvailableModels('/my/project');
            expect(mock.capturedUrl).to.include('directory=');
        });

        it('returns empty array when providers missing from response', async () => {
            mock.respondWith({});
            const models = await proxy.getAvailableModels();
            expect(models).to.deep.equal([]);
        });
    });

    // ── File search ──────────────────────────────────────────────────────────

    describe('searchFiles()', () => {
        it('makes GET /find/file with query param', async () => {
            mock.respondWith(['src/app.ts', 'src/utils.ts']);
            const files = await proxy.searchFiles('sess-1', 'app');
            expect(mock.capturedMethod).to.equal('GET');
            expect(mock.capturedUrl).to.include('/find/file');
            expect(mock.capturedUrl).to.include('query=app');
            expect(files).to.have.length(2);
        });

        it('includes limit param', async () => {
            mock.respondWith([]);
            await proxy.searchFiles('sess-1', 'test', 5);
            expect(mock.capturedUrl).to.include('limit=5');
        });
    });

    // ── HTTP error handling ──────────────────────────────────────────────────

    describe('HTTP error handling', () => {
        it('throws on 404 response', async () => {
            mock.respondWithError(404, 'Not Found');
            try {
                await proxy.getProjects();
                expect.fail('should have thrown');
            } catch (err: any) {
                expect(err.message).to.include('404');
            }
        });

        it('throws on 500 response', async () => {
            mock.respondWithError(500, 'Internal Server Error');
            try {
                await proxy.getSessions('proj-1');
                expect.fail('should have thrown');
            } catch (err: any) {
                expect(err.message).to.include('500');
            }
        });

        it('throws on malformed JSON response', async () => {
            mock.mockRawRequest = () => ({ statusCode: 200, body: 'not-valid-json{{{' });
            try {
                await proxy.getProjects();
                expect.fail('should have thrown');
            } catch (err: any) {
                expect(err).to.be.instanceOf(SyntaxError);
            }
        });
    });
});
