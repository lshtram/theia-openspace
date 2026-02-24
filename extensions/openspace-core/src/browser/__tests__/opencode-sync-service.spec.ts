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
 * T2-15: Test hooks must be guarded by NODE_ENV check.
 *
 * Behavioural runtime tests: instantiate OpenCodeSyncServiceImpl, call
 * setSessionService(), and assert that window.__openspace_test__ is only
 * populated in non-production environments.
 */

import { expect } from 'chai';
import { OpenCodeSyncServiceImpl } from '../opencode-sync-service';
import { SessionService } from '../session-service';
import { SessionServiceImpl } from '../session-service';

const SESSION_ID = 'test-session-id';

/**
 * Build a minimal stub SessionService. Only onActiveSessionChanged needs to
 * be present because setSessionService() subscribes to that event.
 */
function makeSessionServiceStub(sessionId = SESSION_ID): SessionService & { updateSessionStatusCalled: number } {
    const stub = {
        onActiveSessionChanged: () => ({ dispose: () => undefined }),
        dispose: () => undefined,
        activeSession: { id: sessionId } as any,
        updateSessionStatus: () => { stub.updateSessionStatusCalled++; },
        updateSessionStatusCalled: 0,
    } as unknown as SessionService & { updateSessionStatusCalled: number };
    return stub;
}

function makeService(): OpenCodeSyncServiceImpl {
    const service = new OpenCodeSyncServiceImpl();
    (service as any).logger = {
        info: () => undefined,
        warn: () => undefined,
        error: () => undefined,
        debug: () => undefined,
    };
    (service as any).commandRegistry = { getCommand: () => undefined, executeCommand: () => undefined };
    return service;
}

describe('OpenCodeSyncService - Test Hook Security (T2-15)', () => {
    let originalNodeEnv: string | undefined;

    beforeEach(() => {
        originalNodeEnv = process.env.NODE_ENV;
        // Clean up any previously set test hook
        if (typeof window !== 'undefined') {
            delete (window as any).__openspace_test__;
        }
    });

    afterEach(() => {
        // Always restore NODE_ENV regardless of what the test did
        if (originalNodeEnv === undefined) {
            delete process.env.NODE_ENV;
        } else {
            process.env.NODE_ENV = originalNodeEnv;
        }
        // Clean up any test hook left behind
        if (typeof window !== 'undefined') {
            delete (window as any).__openspace_test__;
        }
    });

    it('should NOT expose window.__openspace_test__ when NODE_ENV is production', () => {
        process.env.NODE_ENV = 'production';

        const service = makeService();
        service.setSessionService(makeSessionServiceStub());

        expect((window as any).__openspace_test__).to.be.undefined;
    });

    it('should expose window.__openspace_test__ when NODE_ENV is not production', () => {
        process.env.NODE_ENV = 'test';

        const service = makeService();
        service.setSessionService(makeSessionServiceStub());

        expect((window as any).__openspace_test__).to.not.be.undefined;
        expect(typeof (window as any).__openspace_test__.triggerAgentCommand).to.equal('function');
        expect(typeof (window as any).__openspace_test__.getLastDispatchedCommand).to.equal('function');
        expect(typeof (window as any).__openspace_test__.injectMessageEvent).to.equal('function');
    });
});

describe('OpenCodeSyncService - Event buffering during DI init race (Bug A)', () => {

    it('buffers status_changed events arriving before setSessionService() and processes them after wiring', () => {
        const service = makeService();

        // Simulate SSE event arriving before setSessionService() is called
        // (the DI race condition: new connection, events arrive before BridgeContribution.onStart fires)
        service.onSessionEvent({
            type: 'status_changed',
            sessionId: SESSION_ID,
            sessionStatus: { type: 'busy' },
        } as any);

        // At this point, with the current (broken) implementation, the event is swallowed.
        // After the fix, it should be queued.

        const stub = makeSessionServiceStub();
        service.setSessionService(stub);

        // After wiring, the buffered event should have been drained and processed
        expect(stub.updateSessionStatusCalled).to.equal(1);
    });

});

/**
 * Build a minimal real SessionServiceImpl for streaming duplication tests.
 * Bypasses DI by injecting stubs directly via property assignment.
 */
function makeRealSessionService(sessionId = SESSION_ID): SessionServiceImpl {
    const mockOpenCodeService = {
        getProjects: () => Promise.resolve([]),
        getSessions: () => Promise.resolve([]),
        getMessages: () => Promise.resolve([]),
        connectToProject: () => Promise.resolve(),
    } as any;

    const storage: Record<string, string> = {};
    // Stub localStorage only if not already stubbed
    try {
        Object.defineProperty(window, 'localStorage', {
            value: {
                getItem: (key: string) => storage[key] ?? null,
                setItem: (key: string, value: string) => { storage[key] = value; },
                removeItem: (key: string) => { delete storage[key]; },
            },
            configurable: true,
            writable: true,
        });
    } catch { /* already stubbed */ }

    const svc = new SessionServiceImpl();
    (svc as any).openCodeService = mockOpenCodeService;
    (svc as any).logger = { info: () => undefined, warn: () => undefined, error: () => undefined, debug: () => undefined };

    // Pre-load a session and a message so streaming methods have something to target
    (svc as any)._activeSession = { id: sessionId };
    (svc as any)._messages = [{
        id: 'msg-1',
        sessionID: sessionId,
        role: 'assistant',
        parts: [],
        time: { created: Date.now() },
    }];

    return svc;
}

describe('OpenCodeSyncService - Text streaming duplication (Bug B)', () => {
    /**
     * Regression test for text duplication caused by message.part.updated (carrying full
     * accumulated text) conflicting with message.part.delta (incremental appends).
     *
     * When the backend fires message.part.updated BEFORE message.part.delta for the same
     * token, updateStreamingMessageParts replaces the text part with the full snapshot,
     * then applyPartDelta appends the same delta again on top → duplication.
     *
     * Fix: handleMessagePartial must filter out text/reasoning parts before calling
     * updateStreamingMessageParts — only tool parts should be upserted from message.part.updated.
     * Text parts must only be written via message.part.delta → applyPartDelta.
     */
    it('does not duplicate text when message.part.updated fires before message.part.delta for same token', () => {
        const sessionId = 'streaming-session';
        const messageId = 'msg-streaming';
        const partId = 'part-1';

        // Build sync service with real SessionService
        const syncSvc = makeService();
        const sessionSvc = makeRealSessionService(sessionId);
        // Override the pre-loaded message to use our IDs
        (sessionSvc as any)._messages = [{
            id: messageId,
            sessionID: sessionId,
            role: 'assistant',
            parts: [],
            time: { created: Date.now() },
        }];
        syncSvc.setSessionService(sessionSvc);

        // Step 1: First token arrives via delta — "hello "
        syncSvc.onMessagePartDelta({
            sessionID: sessionId,
            messageID: messageId,
            partID: partId,
            field: 'text',
            delta: 'hello ',
        });

        // Step 2: message.part.updated arrives carrying the FULL accumulated text "hello world"
        // (i.e., it has been batched and includes a token not yet sent via delta)
        syncSvc.onMessageEvent({
            type: 'partial',
            sessionId: sessionId,
            projectId: '',
            messageId: messageId,
            data: {
                info: {
                    id: messageId,
                    sessionID: sessionId,
                    role: 'assistant',
                    time: { created: Date.now() },
                } as any,
                parts: [{
                    id: partId,
                    sessionID: sessionId,
                    messageID: messageId,
                    type: 'text',
                    text: 'hello world',
                }],
            },
        } as any);

        // Step 3: The delta for "world" arrives AFTER part.updated already set the full text.
        // This is the race: part.updated already contains "world", but the delta arrives too.
        syncSvc.onMessagePartDelta({
            sessionID: sessionId,
            messageID: messageId,
            partID: partId,
            field: 'text',
            delta: 'world',
        });

        // Assert: text should be exactly "hello world", not "hello worldworld"
        // (the "world" delta should NOT be double-applied if part.updated already set it)
        const messages = sessionSvc.messages;
        expect(messages).to.have.lengthOf(1);
        const parts = messages[0].parts as any[];
        expect(parts).to.have.lengthOf(1);
        expect(parts[0].text).to.equal('hello world');
    });

    it('preserves reasoning part type when partial provides empty reasoning stub before deltas', () => {
        const sessionId = 'streaming-session-reasoning';
        const messageId = 'msg-reasoning';
        const reasoningPartId = 'part-reasoning';

        const syncSvc = makeService();
        const sessionSvc = makeRealSessionService(sessionId);
        (sessionSvc as any)._messages = [{
            id: messageId,
            sessionID: sessionId,
            role: 'assistant',
            parts: [],
            time: { created: Date.now() },
        }];
        syncSvc.setSessionService(sessionSvc);

        // Backend sends reasoning stub in message.part.updated with empty text
        syncSvc.onMessageEvent({
            type: 'partial',
            sessionId,
            projectId: '',
            messageId,
            data: {
                info: { id: messageId, sessionID: sessionId, role: 'assistant', time: { created: Date.now() } } as any,
                parts: [{ id: reasoningPartId, sessionID: sessionId, messageID: messageId, type: 'reasoning', text: '' }]
            }
        } as any);

        // Then deltas arrive on field=text for that reasoning part ID
        syncSvc.onMessagePartDelta({
            sessionID: sessionId,
            messageID: messageId,
            partID: reasoningPartId,
            field: 'text',
            delta: 'The user is greeting.'
        });

        const msg = sessionSvc.messages.find(m => m.id === messageId) as any;
        expect(msg).to.exist;
        expect(msg.parts).to.have.lengthOf(1);
        expect(msg.parts[0].type).to.equal('reasoning');
        expect(msg.parts[0].text).to.equal('The user is greeting.');
    });

    it('deduplicates identical back-to-back message.part.delta events', () => {
        const sessionId = 'streaming-session-dedupe';
        const messageId = 'msg-dedupe';
        const partId = 'part-dedupe';

        const syncSvc = makeService();
        const sessionSvc = makeRealSessionService(sessionId);
        (sessionSvc as any)._messages = [{
            id: messageId,
            sessionID: sessionId,
            role: 'assistant',
            parts: [],
            time: { created: Date.now() },
        }];
        syncSvc.setSessionService(sessionSvc);

        const evt = {
            sessionID: sessionId,
            messageID: messageId,
            partID: partId,
            field: 'text',
            delta: 'Hello chunk '
        };

        syncSvc.onMessagePartDelta(evt as any);
        syncSvc.onMessagePartDelta(evt as any);

        const msg = sessionSvc.messages.find(m => m.id === messageId) as any;
        expect(msg).to.exist;
        expect(msg.parts).to.have.lengthOf(1);
        expect(msg.parts[0].text).to.equal('Hello chunk ');
    });

    it('replaces streamed fallback parts with authoritative completed parts when completed event has empty parts', async () => {
        const sessionId = 'streaming-session-2';
        const messageId = 'msg-streaming-2';
        const partId = 'part-r';

        const syncSvc = makeService();
        const sessionSvc = makeRealSessionService(sessionId);

        // Ensure active project/session exist for backend message fetch
        (sessionSvc as any)._activeProject = { id: 'global' };
        (sessionSvc as any)._activeSession = { id: sessionId };

        // Mock backend getMessage to return canonical parts (reasoning + final text)
        const mockGetMessage = async () => ({
            info: {
                id: messageId,
                sessionID: sessionId,
                role: 'assistant',
                time: { created: Date.now(), completed: Date.now() }
            },
            parts: [
                { id: 'reasoning-1', sessionID: sessionId, messageID: messageId, type: 'reasoning', text: 'The user is greeting me.' },
                { id: 'text-1', sessionID: sessionId, messageID: messageId, type: 'text', text: 'Hello! How can I help you today?' }
            ]
        });
        (sessionSvc as any).openCodeService.getMessage = mockGetMessage;

        // Seed with a streaming stub containing duplicated text-only content
        (sessionSvc as any)._messages = [{
            id: messageId,
            sessionID: sessionId,
            role: 'assistant',
            parts: [{ id: partId, sessionID: sessionId, messageID: messageId, type: 'text', text: 'The userThe user is greeting me.' }],
            time: { created: Date.now() },
        }];

        syncSvc.setSessionService(sessionSvc);

        // Mark as actively streaming so completed handler executes normal completion path
        (syncSvc as any).streamingMessages.set(messageId, { text: 'The userThe user is greeting me.' });

        // Completed event arrives with empty parts (common SSE behavior)
        syncSvc.onMessageEvent({
            type: 'completed',
            sessionId,
            projectId: 'global',
            messageId,
            data: {
                info: {
                    id: messageId,
                    sessionID: sessionId,
                    role: 'assistant',
                    time: { created: Date.now(), completed: Date.now() }
                } as any,
                parts: []
            }
        } as any);

        // Allow async backend fetch/replace to resolve
        await new Promise(resolve => setTimeout(resolve, 0));

        const msg = sessionSvc.messages.find(m => m.id === messageId) as any;
        expect(msg).to.exist;
        expect(msg.parts).to.have.lengthOf(2);
        expect(msg.parts[0].type).to.equal('reasoning');
        expect(msg.parts[0].text).to.equal('The user is greeting me.');
        expect(msg.parts[1].type).to.equal('text');
        expect(msg.parts[1].text).to.equal('Hello! How can I help you today?');
    });

    it('refreshes from backend even when completed event includes parts (to correct duplicated stream content)', async () => {
        const sessionId = 'streaming-session-3';
        const messageId = 'msg-streaming-3';

        const syncSvc = makeService();
        const sessionSvc = makeRealSessionService(sessionId);

        (sessionSvc as any)._activeProject = { id: 'global' };
        (sessionSvc as any)._activeSession = { id: sessionId };
        (sessionSvc as any)._messages = [{
            id: messageId,
            sessionID: sessionId,
            role: 'assistant',
            parts: [],
            time: { created: Date.now() },
        }];
        (sessionSvc as any).openCodeService.getMessage = async () => ({
            info: {
                id: messageId,
                sessionID: sessionId,
                role: 'assistant',
                time: { created: Date.now(), completed: Date.now() }
            },
            parts: [
                { id: 'r1', sessionID: sessionId, messageID: messageId, type: 'reasoning', text: 'Thinking once.' },
                { id: 't1', sessionID: sessionId, messageID: messageId, type: 'text', text: 'Hello once.' }
            ]
        });

        syncSvc.setSessionService(sessionSvc);
        (syncSvc as any).streamingMessages.set(messageId, { text: 'dup' });

        // Completed event contains duplicated parts from transient stream state
        syncSvc.onMessageEvent({
            type: 'completed',
            sessionId,
            projectId: 'global',
            messageId,
            data: {
                info: {
                    id: messageId,
                    sessionID: sessionId,
                    role: 'assistant',
                    time: { created: Date.now(), completed: Date.now() }
                } as any,
                parts: [
                    { id: 'x1', sessionID: sessionId, messageID: messageId, type: 'text', text: 'Thinking once.Thinking once.' },
                    { id: 'x2', sessionID: sessionId, messageID: messageId, type: 'text', text: 'Hello once.Hello once.' }
                ]
            }
        } as any);

        await new Promise(resolve => setTimeout(resolve, 0));

        const msg = sessionSvc.messages.find(m => m.id === messageId) as any;
        expect(msg).to.exist;
        expect(msg.parts).to.have.lengthOf(2);
        expect(msg.parts[0].type).to.equal('reasoning');
        expect(msg.parts[0].text).to.equal('Thinking once.');
        expect(msg.parts[1].type).to.equal('text');
        expect(msg.parts[1].text).to.equal('Hello once.');
    });
});
