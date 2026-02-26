/**
 * DOM cursor-position utilities for the contenteditable editor.
 *
 * Extracted from the prompt-input monolith during god-object decomposition (Phase 4c).
 */

import * as React from '@theia/core/shared/react';

/**
 * Check if cursor is at the very beginning of the editor.
 */
export function isCursorAtStart(editorRef: React.RefObject<HTMLDivElement | null>): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return true;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const editor = editorRef.current;
    if (!editor) return true;
    const preRange = document.createRange();
    preRange.setStart(editor, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length === 0;
}

/**
 * Check if cursor is at the very end of the editor.
 */
export function isCursorAtEnd(editorRef: React.RefObject<HTMLDivElement | null>): boolean {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return true;
    const range = sel.getRangeAt(0);
    if (!range.collapsed) return false;
    const editor = editorRef.current;
    if (!editor) return true;
    const text = editor.textContent || '';
    const preRange = document.createRange();
    preRange.setStart(editor, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString().length >= text.length;
}

/**
 * Get all text content before the cursor in the editor (across all nodes).
 * Needed for @ and / detection to work even with pill spans present.
 */
export function getTextBeforeCursor(editorRef: React.RefObject<HTMLDivElement | null>): string {
    const editor = editorRef.current;
    if (!editor) return '';
    const selection = window.getSelection();
    if (!selection || selection.rangeCount === 0) return '';
    const range = selection.getRangeAt(0);
    const preRange = document.createRange();
    preRange.setStart(editor, 0);
    preRange.setEnd(range.startContainer, range.startOffset);
    return preRange.toString();
}
