/**
 * Custom hook for prompt history navigation (ArrowUp/ArrowDown).
 *
 * Extracted from the prompt-input monolith during god-object decomposition (Phase 4c).
 */

import * as React from '@theia/core/shared/react';
import { sanitizeHtml } from './sanitize-html';
import type { HistoryEntry } from './prompt-constants';
import { MAX_HISTORY } from './prompt-constants';

export interface PromptHistoryState {
    historyEntries: HistoryEntry[];
    historyIndex: number;
    savedDraft: string;
    /** Push a new entry (deduplicates against most recent). */
    pushEntry: (text: string, html: string) => void;
    /** Reset navigation index (called on any user input). */
    resetIndex: () => void;
    /**
     * Handle ArrowUp: navigate backward through history.
     * Returns true if history navigation was consumed (caller should preventDefault).
     */
    navigateUp: (
        editorRef: React.RefObject<HTMLDivElement | null>,
        isCursorAtStart: () => boolean,
        handleEditorInput: () => void
    ) => boolean;
    /**
     * Handle ArrowDown: navigate forward through history.
     * Returns true if history navigation was consumed (caller should preventDefault).
     */
    navigateDown: (
        editorRef: React.RefObject<HTMLDivElement | null>,
        isCursorAtEnd: () => boolean,
        handleEditorInput: () => void
    ) => boolean;
}

/**
 * Restore innerHTML from a history entry into the editor, placing the cursor at end.
 */
function restoreHtml(editor: HTMLDivElement, html: string): void {
    editor.innerHTML = sanitizeHtml(html);
    const range = document.createRange();
    const sel = window.getSelection();
    range.selectNodeContents(editor);
    range.collapse(false);
    sel?.removeAllRanges();
    sel?.addRange(range);
}

export function usePromptHistory(): PromptHistoryState {
    const [historyEntries, setHistoryEntries] = React.useState<HistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = React.useState(-1);
    const [savedDraft, setSavedDraft] = React.useState('');

    const pushEntry = React.useCallback((text: string, html: string) => {
        setHistoryEntries(prev => {
            if (prev[0]?.text === text) return prev;
            return [{ text, html }, ...prev].slice(0, MAX_HISTORY);
        });
        setHistoryIndex(-1);
        setSavedDraft('');
    }, []);

    const resetIndex = React.useCallback(() => {
        setHistoryIndex(-1);
    }, []);

    const navigateUp = React.useCallback((
        editorRef: React.RefObject<HTMLDivElement | null>,
        isCursorAtStart: () => boolean,
        handleEditorInput: () => void
    ): boolean => {
        const editorText = editorRef.current?.textContent || '';
        if (editorText.length !== 0 && !isCursorAtStart()) return false;
        if (historyEntries.length === 0 || historyIndex >= historyEntries.length - 1) return false;

        const newIndex = historyIndex + 1;
        if (historyIndex === -1) {
            setSavedDraft(editorRef.current?.innerHTML || '');
        }
        setHistoryIndex(newIndex);
        if (editorRef.current) {
            restoreHtml(editorRef.current, historyEntries[newIndex].html);
        }
        handleEditorInput();
        return true;
    }, [historyEntries, historyIndex]);

    const navigateDown = React.useCallback((
        editorRef: React.RefObject<HTMLDivElement | null>,
        isCursorAtEnd: () => boolean,
        handleEditorInput: () => void
    ): boolean => {
        if (historyIndex < 0) return false;
        if (!isCursorAtEnd()) return false;

        const newIndex = historyIndex - 1;
        setHistoryIndex(newIndex);
        if (editorRef.current) {
            if (newIndex === -1) {
                restoreHtml(editorRef.current, savedDraft);
            } else {
                restoreHtml(editorRef.current, historyEntries[newIndex].html);
            }
        }
        handleEditorInput();
        return true;
    }, [historyEntries, historyIndex, savedDraft]);

    return { historyEntries, historyIndex, savedDraft, pushEntry, resetIndex, navigateUp, navigateDown };
}
