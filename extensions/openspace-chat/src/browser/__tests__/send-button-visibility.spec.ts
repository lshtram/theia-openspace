import * as fs from 'fs';
import * as path from 'path';
import { expect } from 'chai';

// Derive __dirname from import.meta.url (works in ESM at runtime)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore TS1343
const __dirname_here = path.dirname(new URL(import.meta.url).pathname);

/**
 * Structural test: verifies at the source level that:
 * 1. prompt-toolbar-left-group wraps the pills (agent/model/mode selectors)
 * 2. prompt-input-send-button appears AFTER the left-group closing tag in the JSX
 *    (i.e. it is a sibling, not a child — so the left-group can never crowd it out)
 */
describe('send button visibility — source structure', () => {
    const tsxPath = path.resolve(
        __dirname_here,
        '../prompt-input/prompt-input.tsx'
    );
    let src: string;

    before(() => {
        src = fs.readFileSync(tsxPath, 'utf8');
    });

    it('prompt-toolbar-left-group class appears in the JSX source', () => {
        expect(src).to.include('prompt-toolbar-left-group');
    });

    it('prompt-input-send-button appears AFTER prompt-toolbar-left-group in the source', () => {
        const leftGroupIdx = src.indexOf('prompt-toolbar-left-group');
        const sendBtnIdx = src.indexOf('prompt-input-send-button');
        expect(leftGroupIdx).to.be.greaterThan(-1, 'prompt-toolbar-left-group not found in source');
        expect(sendBtnIdx).to.be.greaterThan(-1, 'prompt-input-send-button not found in source');
        expect(sendBtnIdx).to.be.greaterThan(leftGroupIdx,
            'send button should appear after left-group in source (sibling, not child)');
    });

    it('left-group closing tag appears before send button in the source', () => {
        // The closing </div> of left-group must come before the send button's className
        // Use a regex to find the position of the left-group closing tag
        const leftGroupOpenIdx = src.indexOf('prompt-toolbar-left-group');
        // Find the next closing </div> after the left-group opening
        const closingTagIdx = src.indexOf('</div>', leftGroupOpenIdx);
        const sendBtnIdx = src.indexOf('prompt-input-send-button');
        expect(closingTagIdx).to.be.greaterThan(-1, '</div> after left-group not found');
        expect(sendBtnIdx).to.be.greaterThan(closingTagIdx,
            'send button should appear after the left-group closing tag');
    });
});
