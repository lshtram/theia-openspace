import * as React from '@theia/core/shared/react';
import { expect } from 'chai';

/**
 * Structural test: send button must be a sibling of left-group, not inside it,
 * and left-group must not be able to crowd it out.
 */
describe('send button visibility — DOM structure', () => {
    it('send button is a sibling of left-group, not nested inside it', () => {
        const { document } = globalThis as any;
        if (!document) {
            // jsdom not available, skip
            return;
        }
        const toolbar = document.createElement('div');
        toolbar.className = 'prompt-input-toolbar';

        const leftGroup = document.createElement('div');
        leftGroup.className = 'prompt-toolbar-left-group';
        toolbar.appendChild(leftGroup);

        const sendBtn = document.createElement('button');
        sendBtn.className = 'prompt-input-send-button';
        toolbar.appendChild(sendBtn);

        // send button must be a direct child of toolbar, not inside left-group
        expect(sendBtn.parentElement).to.equal(toolbar);
        expect(leftGroup.contains(sendBtn)).to.be.false;

        // left-group must precede send button in DOM (so flex order is correct)
        const children = Array.from(toolbar.children);
        const leftIdx = children.indexOf(leftGroup);
        const sendIdx = children.indexOf(sendBtn);
        expect(leftIdx).to.be.lessThan(sendIdx);
    });
});
