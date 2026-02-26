/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P2-C: Toast / Notification System.
 *
 * ToastService — a lightweight in-memory observable toast stack.
 * ToastStack — React component rendering toasts from the service.
 *
 * Imports ToastService directly from TS source (pure class, no DI).
 * Imports ToastStack from compiled lib (React component).
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import * as React from 'react';
import { createRoot } from 'react-dom/client';
import { act } from 'react';
import { ToastService } from '../toast-service';
import { createRequire } from 'node:module';

// @ts-expect-error TS1343
const _require = createRequire(import.meta.url);
const { ToastStack } = _require('openspace-chat/lib/browser/toast-stack') as {
    ToastStack: React.FC<any>;
};

// ─── Polyfills ────────────────────────────────────────────────────────────────

if (!Element.prototype.scrollIntoView) {
    (Element.prototype as any).scrollIntoView = function (): void { /* noop */ };
}

// ─── P2-C: ToastService ───────────────────────────────────────────────────────

describe('P2-C: ToastService', () => {
    afterEach(() => { sinon.restore(); });

    it('starts with no toasts', () => {
        const svc = new ToastService();
        expect(svc.toasts).to.have.length(0);
    });

    it('adds a toast via show()', () => {
        const svc = new ToastService();
        svc.show({ type: 'info', message: 'Turn complete' });
        expect(svc.toasts).to.have.length(1);
        expect(svc.toasts[0].message).to.equal('Turn complete');
        expect(svc.toasts[0].type).to.equal('info');
    });

    it('assigns a unique id to each toast', () => {
        const svc = new ToastService();
        svc.show({ type: 'success', message: 'A' });
        svc.show({ type: 'error', message: 'B' });
        const ids = svc.toasts.map(t => t.id);
        expect(ids[0]).to.not.equal(ids[1]);
        expect(ids[0]).to.be.a('string').with.length.greaterThan(0);
    });

    it('removes a toast via dismiss(id)', () => {
        const svc = new ToastService();
        svc.show({ type: 'info', message: 'Removable' });
        const id = svc.toasts[0].id;
        svc.dismiss(id);
        expect(svc.toasts).to.have.length(0);
    });

    it('fires onToastsChanged event when a toast is added', () => {
        const svc = new ToastService();
        const cb = sinon.stub();
        svc.onToastsChanged(cb);
        svc.show({ type: 'warning', message: 'Watch out' });
        expect(cb.calledOnce).to.be.true;
    });

    it('fires onToastsChanged event when a toast is dismissed', () => {
        const svc = new ToastService();
        svc.show({ type: 'info', message: 'Temp' });
        const id = svc.toasts[0].id;
        const cb = sinon.stub();
        svc.onToastsChanged(cb);
        svc.dismiss(id);
        expect(cb.calledOnce).to.be.true;
    });

    it('ignores dismiss() for unknown ids', () => {
        const svc = new ToastService();
        svc.show({ type: 'info', message: 'Keep me' });
        svc.dismiss('nonexistent-id');
        expect(svc.toasts).to.have.length(1);
    });

    it('supports multiple simultaneous toasts', () => {
        const svc = new ToastService();
        svc.show({ type: 'info', message: 'One' });
        svc.show({ type: 'success', message: 'Two' });
        svc.show({ type: 'error', message: 'Three' });
        expect(svc.toasts).to.have.length(3);
    });
});

// ─── P2-C: ToastStack component ───────────────────────────────────────────────

describe('P2-C: ToastStack component', () => {
    afterEach(() => { document.body.innerHTML = ''; sinon.restore(); });

    it('renders nothing when toasts array is empty', () => {
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => { root.render(React.createElement(ToastStack, { toasts: [] })); });
        expect(container.querySelectorAll('.toast').length).to.equal(0);
        act(() => root.unmount()); container.remove();
    });

    it('renders one .toast per toast entry', () => {
        const toasts = [
            { id: '1', type: 'info', message: 'Hello' },
            { id: '2', type: 'error', message: 'Error!' },
        ];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => { root.render(React.createElement(ToastStack, { toasts, onDismiss: sinon.stub() })); });
        expect(container.querySelectorAll('.toast').length).to.equal(2);
        act(() => root.unmount()); container.remove();
    });

    it('applies type-specific CSS class to each toast', () => {
        const toasts = [
            { id: '1', type: 'success', message: 'Done' },
            { id: '2', type: 'error', message: 'Fail' },
        ];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => { root.render(React.createElement(ToastStack, { toasts, onDismiss: sinon.stub() })); });
        expect(container.querySelector('.toast--success')).to.not.be.null;
        expect(container.querySelector('.toast--error')).to.not.be.null;
        act(() => root.unmount()); container.remove();
    });

    it('displays the toast message text', () => {
        const toasts = [{ id: '1', type: 'info', message: 'Build succeeded' }];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => { root.render(React.createElement(ToastStack, { toasts, onDismiss: sinon.stub() })); });
        expect(container.querySelector('.toast')!.textContent).to.include('Build succeeded');
        act(() => root.unmount()); container.remove();
    });

    it('calls onDismiss when a toast dismiss button is clicked', () => {
        const onDismiss = sinon.stub();
        const toasts = [{ id: 'abc-123', type: 'info', message: 'Dismiss me' }];
        const container = document.createElement('div');
        document.body.appendChild(container);
        const root = createRoot(container);
        act(() => { root.render(React.createElement(ToastStack, { toasts, onDismiss })); });

        const dismissBtn = container.querySelector('.toast-dismiss') as HTMLElement;
        expect(dismissBtn).to.not.be.null;
        act(() => { dismissBtn.click(); });

        expect(onDismiss.calledOnce).to.be.true;
        expect(onDismiss.firstCall.args[0]).to.equal('abc-123');
        act(() => root.unmount()); container.remove();
    });
});
