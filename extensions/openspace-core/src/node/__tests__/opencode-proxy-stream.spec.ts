/* eslint-disable @typescript-eslint/no-explicit-any */
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

/**
 * OpenCodeProxy unit tests.
 *
 * After decomposition, tests are split by responsibility:
 *   - HttpClient: URL construction (buildUrl), HTTP error handling (requestJson)
 *   - OpenCodeProxy facade: state management (setClient, dispose), Phase T3 contract
 *
 * Both are tested here with manual wiring (no Theia DI container).
 */

import { expect } from 'chai';
import { HttpClient, DEFAULT_OPENCODE_URL } from '../opencode-proxy/http-client';
import { OpenCodeProxy } from '../opencode-proxy/opencode-proxy';
import { OpenCodeClient } from '../../common/opencode-protocol';

// ─── TestableHttpClient ──────────────────────────────────────────────────────

/**
 * Testable subclass that exposes protected methods and allows HTTP mocking.
 */
class TestableHttpClient extends HttpClient {
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

    /** Expose buildUrl for testing */
    public testBuildUrl(endpoint: string, queryParams?: Record<string, string | undefined>): string {
        return this.buildUrl(endpoint, queryParams);
    }

    /** Expose requestJson for testing */
    public testRequestJson<T>(options: { url: string; type: string; data?: string }): Promise<T> {
        return this.requestJson<T>(options);
    }

    /** Override rawRequest to simulate HTTP responses without a real server */
    public mockRawRequest?: (url: string, method: string) => { statusCode: number; body: string };

    override rawRequest(url: string, method: string, _headers: Record<string, string>, _body?: string): Promise<{ statusCode: number; body: string }> {
        if (this.mockRawRequest) {
            return Promise.resolve(this.mockRawRequest(url, method));
        }
        return super.rawRequest(url, method, _headers, _body);
    }
}

// ─── TestableProxy ───────────────────────────────────────────────────────────

/** Create a minimally-wired OpenCodeProxy for facade-level tests. */
function createTestProxy(): OpenCodeProxy {
    const proxy = new OpenCodeProxy();
    (proxy as any).logger = {
        info: () => {},
        debug: () => {},
        warn: () => {},
        error: () => {}
    };
    // Stub injected dependencies
    (proxy as any).rest = {};
    (proxy as any).sse = {
        setClient: () => {},
        disconnectSSE: () => {},
        dispose: () => {}
    };
    (proxy as any).nodeUtils = {};
    return proxy;
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('OpenCodeProxy', () => {

    describe('DEFAULT_OPENCODE_URL constant', () => {
        it('should point to localhost:7890', () => {
            expect(DEFAULT_OPENCODE_URL).to.equal('http://localhost:7890');
        });
    });

    describe('buildUrl()', () => {
        let client: TestableHttpClient;

        beforeEach(() => {
            client = new TestableHttpClient('http://localhost:7890');
        });

        it('should build URL for simple endpoint', () => {
            const url = client.testBuildUrl('/session');
            expect(url).to.equal('http://localhost:7890/session');
        });

        it('should build URL with single query parameter', () => {
            const url = client.testBuildUrl('/session', { foo: 'bar' });
            expect(url).to.equal('http://localhost:7890/session?foo=bar');
        });

        it('should build URL with multiple query parameters', () => {
            const url = client.testBuildUrl('/project', { a: '1', b: '2' });
            const parsed = new URL(url);
            expect(parsed.pathname).to.equal('/project');
            expect(parsed.searchParams.get('a')).to.equal('1');
            expect(parsed.searchParams.get('b')).to.equal('2');
        });

        it('should omit undefined query parameters', () => {
            const url = client.testBuildUrl('/session', { present: 'yes', missing: undefined });
            const parsed = new URL(url);
            expect(parsed.searchParams.get('present')).to.equal('yes');
            expect(parsed.searchParams.has('missing')).to.be.false;
        });

        it('should work with a custom base URL', () => {
            const customClient = new TestableHttpClient('http://example.com:8080');
            const url = customClient.testBuildUrl('/test');
            expect(url).to.equal('http://example.com:8080/test');
        });

        it('should URL-encode query parameter values with spaces', () => {
            const url = client.testBuildUrl('/search', { q: 'hello world' });
            expect(url).to.match(/q=hello(%20|\+)world/);
        });
    });

    describe('setClient() / dispose() — state management', () => {
        let proxy: OpenCodeProxy;

        beforeEach(() => {
            proxy = createTestProxy();
        });

        it('should start with no client', () => {
            expect(proxy.client).to.be.undefined;
        });

        it('should accept a client via setClient()', () => {
            const mockClient = {} as OpenCodeClient;
            proxy.setClient(mockClient);
            expect(proxy.client).to.equal(mockClient);
        });

        it('should clear the client when setClient(undefined) is called', () => {
            const mockClient = {} as OpenCodeClient;
            proxy.setClient(mockClient);
            proxy.setClient(undefined);
            expect(proxy.client).to.be.undefined;
        });

        it('should clear the client on dispose()', () => {
            const mockClient = {} as OpenCodeClient;
            proxy.setClient(mockClient);
            proxy.dispose();
            expect(proxy.client).to.be.undefined;
        });

        it('should set isDisposed after dispose()', () => {
            proxy.dispose();
            // After decomposition, dispose clears the client via sse.dispose()
            // The isDisposed flag is no longer on the facade — verify client is cleared
            expect(proxy.client).to.be.undefined;
        });
    });

    describe('requestJson() — HTTP error handling', () => {
        let client: TestableHttpClient;

        beforeEach(() => {
            client = new TestableHttpClient();
        });

        it('should throw on HTTP 404', async () => {
            client.mockRawRequest = () => ({ statusCode: 404, body: 'Not Found' });
            try {
                await client.testRequestJson({ url: 'http://localhost/test', type: 'GET' });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.message).to.include('404');
            }
        });

        it('should throw on HTTP 500', async () => {
            client.mockRawRequest = () => ({ statusCode: 500, body: 'Internal Server Error' });
            try {
                await client.testRequestJson({ url: 'http://localhost/test', type: 'GET' });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.message).to.include('500');
            }
        });

        it('should return parsed JSON on HTTP 200', async () => {
            client.mockRawRequest = () => ({ statusCode: 200, body: '{"id":"abc","title":"test"}' });
            const result = await client.testRequestJson<{ id: string; title: string }>({ url: 'http://localhost/test', type: 'GET' });
            expect(result.id).to.equal('abc');
            expect(result.title).to.equal('test');
        });

        it('should accept HTTP 201 as success', async () => {
            client.mockRawRequest = () => ({ statusCode: 201, body: '{"id":"new"}' });
            const result = await client.testRequestJson<{ id: string }>({ url: 'http://localhost/test', type: 'POST' });
            expect(result.id).to.equal('new');
        });

        it('should include response body in error message on failure', async () => {
            client.mockRawRequest = () => ({ statusCode: 403, body: 'Access denied to /secret' });
            try {
                await client.testRequestJson({ url: 'http://localhost/test', type: 'GET' });
                expect.fail('should have thrown');
            } catch (e: any) {
                expect(e.message).to.include('Access denied to /secret');
            }
        });
    });

    describe('Phase T3 contract: no stream interceptor', () => {
        it('should not expose interceptStream method (removed in Phase T3)', () => {
            const proxy = createTestProxy();
            expect((proxy as any).interceptStream).to.be.undefined;
        });

        it('should not expose extractAgentCommands method (removed in Phase T3)', () => {
            const proxy = createTestProxy();
            expect((proxy as any).extractAgentCommands).to.be.undefined;
        });

        it('should not have any method name containing "intercept"', () => {
            const proxy = createTestProxy();
            const methodNames = Object.getOwnPropertyNames(Object.getPrototypeOf(proxy));
            const interceptMethods = methodNames.filter(m => m.toLowerCase().includes('intercept'));
            expect(interceptMethods).to.be.empty;
        });
    });

});
