/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * TDD tests for chat feature parity — P3-C: Scroll-Spy + Message Navigation.
 *
 * The MessageTimeline component should expose a way to register messages for
 * IntersectionObserver-based scroll-spy tracking.  When the user presses
 * Alt+Up / Alt+Down, the visible message changes.
 *
 * Because IntersectionObserver is not available in jsdom, we test the
 * register/unregister API and keyboard navigation via the exported
 * ScrollSpyController helper class (pure logic, no DOM).
 */

import { expect } from 'chai';
import * as sinon from 'sinon';
import { ScrollSpyController } from '../scroll-spy-controller';

// ─── P3-C: ScrollSpyController ────────────────────────────────────────────────

describe('P3-C: ScrollSpyController', () => {
    afterEach(() => { sinon.restore(); });

    it('starts with no registered messages', () => {
        const ctrl = new ScrollSpyController();
        expect(ctrl.visibleMessageId).to.be.undefined;
    });

    it('registers a message', () => {
        const ctrl = new ScrollSpyController();
        const el = document.createElement('div');
        ctrl.register(el, 'msg-1');
        expect(ctrl.registeredCount).to.equal(1);
    });

    it('unregisters a message by id', () => {
        const ctrl = new ScrollSpyController();
        const el = document.createElement('div');
        ctrl.register(el, 'msg-1');
        ctrl.unregister('msg-1');
        expect(ctrl.registeredCount).to.equal(0);
    });

    it('setVisible() updates visibleMessageId', () => {
        const ctrl = new ScrollSpyController();
        const el = document.createElement('div');
        ctrl.register(el, 'msg-1');
        ctrl.setVisible('msg-1');
        expect(ctrl.visibleMessageId).to.equal('msg-1');
    });

    it('navigateByOffset(+1) moves to next registered message', () => {
        const ctrl = new ScrollSpyController();
        const el1 = document.createElement('div');
        const el2 = document.createElement('div');
        ctrl.register(el1, 'msg-1');
        ctrl.register(el2, 'msg-2');
        ctrl.setVisible('msg-1');

        const scrolledTo = ctrl.navigateByOffset(1);
        expect(scrolledTo).to.equal('msg-2');
    });

    it('navigateByOffset(-1) moves to previous registered message', () => {
        const ctrl = new ScrollSpyController();
        const el1 = document.createElement('div');
        const el2 = document.createElement('div');
        ctrl.register(el1, 'msg-1');
        ctrl.register(el2, 'msg-2');
        ctrl.setVisible('msg-2');

        const scrolledTo = ctrl.navigateByOffset(-1);
        expect(scrolledTo).to.equal('msg-1');
    });

    it('navigateByOffset clamps at the first message (no wrap)', () => {
        const ctrl = new ScrollSpyController();
        const el1 = document.createElement('div');
        ctrl.register(el1, 'msg-1');
        ctrl.setVisible('msg-1');

        const scrolledTo = ctrl.navigateByOffset(-1);
        expect(scrolledTo).to.equal('msg-1');
    });

    it('navigateByOffset clamps at the last message (no wrap)', () => {
        const ctrl = new ScrollSpyController();
        const el1 = document.createElement('div');
        ctrl.register(el1, 'msg-1');
        ctrl.setVisible('msg-1');

        const scrolledTo = ctrl.navigateByOffset(1);
        expect(scrolledTo).to.equal('msg-1');
    });

    it('fires onNavigate callback when navigating', () => {
        const ctrl = new ScrollSpyController();
        const el1 = document.createElement('div');
        const el2 = document.createElement('div');
        ctrl.register(el1, 'msg-1');
        ctrl.register(el2, 'msg-2');
        ctrl.setVisible('msg-1');

        const cb = sinon.stub();
        ctrl.onNavigate(cb);

        ctrl.navigateByOffset(1);
        expect(cb.calledOnce).to.be.true;
        expect(cb.firstCall.args[0]).to.equal('msg-2');
    });
});
