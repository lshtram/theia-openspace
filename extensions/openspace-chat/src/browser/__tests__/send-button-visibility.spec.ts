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

/**
 * CSS properties test: verifies that the flex overflow rules that keep the send
 * button always visible are present in the stylesheet.
 *
 * Key invariants:
 * - .prompt-toolbar-left-group has min-width:0 and overflow:hidden so it can
 *   shrink and clip pills without pushing siblings out of view.
 * - .prompt-toolbar-pill has flex-shrink:1 so pills absorb space pressure first.
 * - .prompt-input-icon-btn and .prompt-input-send-button have flex-shrink:0 so
 *   they never shrink away regardless of how little space is available.
 * - .prompt-input-send-button has margin-left:auto so it always hugs the right edge.
 */
describe('send button visibility — CSS flex rules', () => {
    const cssPath = path.resolve(
        __dirname_here,
        '../style/prompt-input.css'
    );
    let css: string;

    before(() => {
        css = fs.readFileSync(cssPath, 'utf8');
    });

    /**
     * Extract the text of the CSS rule block for a given selector.
     * Looks for the selector followed immediately by whitespace and '{',
     * to avoid matching pseudo-class variants like :hover or :focus-visible.
     * Returns the content between the '{' and its matching '}'.
     *
     * NOTE: This parser assumes plain CSS with no nested braces. It is valid
     * for prompt-input.css which contains no @supports, SCSS, or other nesting.
     * If the file ever gains nested braces, getRuleBlock may return a truncated
     * block and produce a false-positive pass — add a brace-depth guard at that point.
     */
    function getRuleBlock(selector: string): string {
        // Match selector followed by optional whitespace then '{'
        // (avoids matching `.prompt-input-send-button:focus-visible` when
        //  looking for `.prompt-input-send-button`)
        const pattern = new RegExp(selector.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\s*\\{');
        const match = pattern.exec(css);
        if (!match) { return ''; }
        const open = match.index + match[0].length - 1; // position of '{'
        const close = css.indexOf('}', open);
        if (close === -1) { return ''; }
        return css.slice(open + 1, close);
    }

    it('.prompt-toolbar-left-group has min-width: 0 to allow shrinking', () => {
        const block = getRuleBlock('.prompt-toolbar-left-group');
        expect(block).to.include('min-width: 0',
            '.prompt-toolbar-left-group must have min-width: 0 so it can shrink below its content size');
    });

    it('.prompt-toolbar-left-group has overflow: hidden to clip pills', () => {
        const block = getRuleBlock('.prompt-toolbar-left-group');
        expect(block).to.include('overflow: hidden',
            '.prompt-toolbar-left-group must have overflow: hidden to clip pills rather than pushing siblings');
    });

    it('.prompt-toolbar-pill has flex-shrink: 1 so pills absorb space pressure', () => {
        const block = getRuleBlock('.prompt-toolbar-pill');
        expect(block).to.include('flex-shrink: 1',
            '.prompt-toolbar-pill must shrink before icon buttons and the send button');
    });

    it('.prompt-input-icon-btn has flex-shrink: 0 so icon buttons never disappear', () => {
        const block = getRuleBlock('.prompt-input-icon-btn');
        expect(block).to.include('flex-shrink: 0',
            '.prompt-input-icon-btn must not shrink — it must always be visible');
    });

    it('.prompt-input-send-button has flex-shrink: 0 so send button never disappears', () => {
        const block = getRuleBlock('.prompt-input-send-button');
        expect(block).to.include('flex-shrink: 0',
            '.prompt-input-send-button must not shrink — it must always be visible');
    });

    it('.prompt-input-send-button has margin-left: auto to stay at right edge', () => {
        const block = getRuleBlock('.prompt-input-send-button');
        expect(block).to.include('margin-left: auto',
            '.prompt-input-send-button must have margin-left: auto to always hug the right edge');
    });
});
