// extensions/openspace-core/src/browser/__tests__/bridge-contribution.spec.ts
//
// Tests for OpenSpaceBridgeContribution.
//
// Bridge contribution relies on browser APIs (fetch, window) that aren't
// available in Node. These tests cover the pure logic and structural
// invariants, using stubs for async I/O.

import { expect } from 'chai';
import * as sinon from 'sinon';
import { OpenSpaceBridgeContribution } from '../bridge-contribution';

// ─── Minimal mocks ────────────────────────────────────────────────────────────

const makeLogger = () => ({
    info: sinon.stub(),
    warn: sinon.stub(),
    error: sinon.stub(),
    debug: sinon.stub(),
});

const makePaneService = () => {
    const listeners: ((s: unknown) => void)[] = [];
    return {
        onPaneLayoutChanged: (fn: (s: unknown) => void) => { listeners.push(fn); return { dispose: () => {} }; },
        triggerChange: (snap: unknown) => listeners.forEach(fn => fn(snap)),
        resizePane: sinon.stub().resolves({ success: false }),
    };
};

const makeSyncService = () => ({
    setSessionService: sinon.stub(),
    onAgentCommand: sinon.stub(),
});

const makeSessionService = () => ({
    getSessions: sinon.stub().resolves([]),
});

function buildContribution(fetchStub?: sinon.SinonStub) {
    const bc = new OpenSpaceBridgeContribution();
    const paneService = makePaneService();
    const logger = makeLogger();
    const syncService = makeSyncService();
    const sessionService = makeSessionService();

    (bc as unknown as Record<string, unknown>)['paneService'] = paneService;
    (bc as unknown as Record<string, unknown>)['logger'] = logger;
    (bc as unknown as Record<string, unknown>)['syncService'] = syncService;
    (bc as unknown as Record<string, unknown>)['sessionService'] = sessionService;

    // Stub fetch globally (BridgeContribution uses globalThis.fetch)
    const fetch = fetchStub ?? sinon.stub().resolves({ ok: true });
    (globalThis as Record<string, unknown>)['fetch'] = fetch;

    // Stub window.location.origin (not available in Node)
    if (typeof window === 'undefined') {
        (globalThis as Record<string, unknown>)['window'] = {
            location: { origin: 'http://localhost:3000' }
        };
    }

    return { bc, paneService, logger, syncService, sessionService, fetch };
}

describe('OpenSpaceBridgeContribution', () => {
    let originalFetch: unknown;
    let originalWindow: unknown;

    beforeEach(() => {
        originalFetch = (globalThis as Record<string, unknown>)['fetch'];
        originalWindow = (globalThis as Record<string, unknown>)['window'];
    });

    afterEach(() => {
        (globalThis as Record<string, unknown>)['fetch'] = originalFetch;
        (globalThis as Record<string, unknown>)['window'] = originalWindow;
        sinon.restore();
    });

    // ── onStart ───────────────────────────────────────────────────────────

    describe('onStart', () => {
        it('wires SessionService into SyncService on start', async () => {
            const { bc, syncService, sessionService } = buildContribution();
            await bc.onStart();
            expect(syncService.setSessionService.calledWith(sessionService)).to.be.true;
        });

        it('logs info on start', async () => {
            const { bc, logger } = buildContribution();
            await bc.onStart();
            expect(logger.info.calledWithMatch('[BridgeContribution]')).to.be.true;
        });

        it('does not throw when Hub is unavailable (fetch rejects)', async () => {
            const failFetch = sinon.stub().rejects(new TypeError('fetch failed'));
            const { bc } = buildContribution(failFetch);
            // onStart() must not propagate errors to the caller
            let threw = false;
            try {
                await bc.onStart();
            } catch {
                threw = true;
            }
            expect(threw).to.be.false;
        });

        it('logs warning (not error) when Hub is unavailable due to TypeError', async () => {
            const failFetch = sinon.stub().rejects(new TypeError('network error'));
            const { bc, logger } = buildContribution(failFetch);
            await bc.onStart();
            // Give async registration promise a chance to settle
            await new Promise(r => setTimeout(r, 20));
            expect(logger.warn.calledWithMatch('[BridgeContribution]')).to.be.true;
            expect(logger.error.called).to.be.false;
        });

        it('logs error for non-network errors', async () => {
            const failFetch = sinon.stub().rejects(new Error('Unexpected server error'));
            const { bc, logger } = buildContribution(failFetch);
            await bc.onStart();
            await new Promise(r => setTimeout(r, 20));
            expect(logger.error.calledWithMatch('[BridgeContribution]')).to.be.true;
        });
    });

    // ── onStop ────────────────────────────────────────────────────────────

    describe('onStop', () => {
        it('logs info on stop', () => {
            const { bc, logger } = buildContribution();
            bc.onStop();
            expect(logger.info.calledWithMatch('[BridgeContribution]')).to.be.true;
        });

        it('does not throw', () => {
            const { bc } = buildContribution();
            expect(() => bc.onStop()).to.not.throw();
        });
    });

    // ── Throttle logic ────────────────────────────────────────────────────

    describe('publishState throttling', () => {
        it('skips publish if called within throttle window', async () => {
            const fetchStub = sinon.stub().resolves({ ok: true });
            const { bc, paneService } = buildContribution(fetchStub);
            await bc.onStart();
            await new Promise(r => setTimeout(r, 10));

            fetchStub.resetHistory();

            // Fire 5 rapid pane changes
            for (let i = 0; i < 5; i++) {
                paneService.triggerChange({ panes: [i] });
            }
            await new Promise(r => setTimeout(r, 20));

            // Only 1 state publish should have been made (throttle = 1s)
            expect(fetchStub.callCount).to.equal(1);
        });
    });
});
