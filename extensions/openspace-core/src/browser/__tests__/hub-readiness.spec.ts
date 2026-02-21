import { expect } from 'chai';
import * as sinon from 'sinon';
import { waitForHub } from '../hub-readiness';

describe('waitForHub()', () => {
    let originalFetch: unknown;

    beforeEach(() => {
        originalFetch = (globalThis as Record<string, unknown>)['fetch'];
    });

    afterEach(() => {
        (globalThis as Record<string, unknown>)['fetch'] = originalFetch;
        sinon.restore();
    });

    it('resolves immediately when Hub responds 200 on first attempt', async () => {
        const fetchStub = sinon.stub().resolves({ ok: true, status: 200 });
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        await waitForHub('http://localhost:3000/mcp', { maxAttempts: 3, intervalMs: 10 });

        expect(fetchStub.callCount).to.equal(1);
        expect(fetchStub.firstCall.args[0]).to.equal('http://localhost:3000/mcp');
        expect(fetchStub.firstCall.args[1]).to.deep.include({ method: 'GET' });
    });

    it('retries and resolves once Hub becomes available', async () => {
        const fetchStub = sinon.stub();
        fetchStub.onCall(0).rejects(new TypeError('network error'));
        fetchStub.onCall(1).resolves({ ok: false, status: 503 });
        fetchStub.onCall(2).resolves({ ok: true, status: 200 });
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        await waitForHub('http://localhost:3000/mcp', { maxAttempts: 5, intervalMs: 10 });

        expect(fetchStub.callCount).to.equal(3);
    });

    it('throws HubNotReadyError after exhausting all attempts', async () => {
        const fetchStub = sinon.stub().rejects(new TypeError('network error'));
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        let thrown: Error | undefined;
        try {
            await waitForHub('http://localhost:3000/mcp', { maxAttempts: 3, intervalMs: 10 });
        } catch (e) {
            thrown = e as Error;
        }

        expect(thrown).to.be.instanceOf(Error);
        expect(thrown!.message).to.include('Hub not ready');
        expect(fetchStub.callCount).to.equal(3);
    });

    it('treats a non-ok HTTP status as unavailable and retries', async () => {
        const fetchStub = sinon.stub();
        fetchStub.onCall(0).resolves({ ok: false, status: 404 });
        fetchStub.onCall(1).resolves({ ok: true, status: 200 });
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        await waitForHub('http://localhost:3000/mcp', { maxAttempts: 3, intervalMs: 10 });

        expect(fetchStub.callCount).to.equal(2);
    });

    it('aborts a hung fetch and retries', async () => {
        const fetchStub = sinon.stub();
        // First call: resolves only when signal is aborted (simulates a hung fetch)
        fetchStub.onCall(0).callsFake((_url: string, options: RequestInit) =>
            new Promise<Response>((_resolve, reject) => {
                const signal = options?.signal;
                if (signal) {
                    signal.addEventListener('abort', () => {
                        reject(new DOMException('The operation was aborted.', 'AbortError'));
                    });
                }
                // Otherwise, hangs forever
            })
        );
        // Second call: succeeds
        fetchStub.onCall(1).resolves({ ok: true, status: 200 });
        (globalThis as Record<string, unknown>)['fetch'] = fetchStub;

        // Use short intervalMs so abort fires quickly
        await waitForHub('http://localhost:3000/mcp', { maxAttempts: 3, intervalMs: 50 });

        expect(fetchStub.callCount).to.equal(2);
    });
});
