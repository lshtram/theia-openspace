/**
 * PromptInput Component - Full Implementation (Phases 1-5)
 * 
 * Multi-part prompt input supporting:
 * - Text input (Phase 1)
 * - File attachments with drag-drop (Phase 2)
 * - Image attachments with paste/drag-drop (Phase 3)
 * - @mention typeahead for agents and files (Phase 4)
 * - Keyboard navigation and polish (Phase 5)
 */

// T2-14: Use Theia's shared React import
import * as React from '@theia/core/shared/react';
import { parseFromDOM } from './parse-from-dom';
import { buildRequestParts } from './build-request-parts';
import type { PromptInputProps, Prompt, ImagePart, FilePart } from './types';
import type { CommandInfo, AgentInfo } from 'openspace-core/lib/common/opencode-protocol';
import '../style/prompt-input.css';

// Simple unique ID generator
const generateId = () => crypto.randomUUID();

// B07: Structured history entry — stores both plain text (for dedup) and innerHTML (for pill restoration)
interface HistoryEntry {
    text: string;   // plain text content (for dedup comparison)
    html: string;   // innerHTML snapshot (for full restoration with pills)
}

// Maximum number of prompt history entries to keep
const MAX_HISTORY = 100;

// Available agents (hardcoded for now - could come from configuration)
const AVAILABLE_AGENTS = [
    { name: 'oracle', description: 'System architect and requirements analyst' },
    { name: 'builder', description: 'Code implementation specialist' },
    { name: 'analyst', description: 'Requirements discovery and investigation' },
    { name: 'janitor', description: 'QA and validation' },
];

// Builtin slash commands (handled client-side, always shown first)
const BUILTIN_SLASH_COMMANDS: Array<{ name: string; description: string; local: true }> = [
    { name: '/clear', description: 'Clear the current session messages', local: true },
    { name: '/compact', description: 'Compact conversation to save context', local: true },
    { name: '/help', description: 'Show available commands', local: true },
];

/**
 * Simple fuzzy match: checks if all characters in the query appear
 * in order in the target string (case-insensitive).
 */
const fuzzyMatch = (query: string, target: string): boolean => {
    const q = query.toLowerCase();
    const t = target.toLowerCase();
    let qi = 0;
    for (let ti = 0; ti < t.length && qi < q.length; ti++) {
        if (t[ti] === q[qi]) {
            qi++;
        }
    }
    return qi === q.length;
};

export const PromptInput: React.FC<PromptInputProps> = ({
    onSend,
    onStop,
    isStreaming = false,
    disabled = false,
    placeholder = 'Type your message, @mention files/agents, or attach images...',
    workspaceRoot: workspaceRootProp,
    openCodeService,
    sessionId
}) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imageAttachments, setImageAttachments] = React.useState<ImagePart[]>([]);
    const [fileAttachments, setFileAttachments] = React.useState<FilePart[]>([]);
    const [hasContent, setHasContent] = React.useState(false);
    const [isDragging, setIsDragging] = React.useState(false);
    const [showTypeahead, setShowTypeahead] = React.useState(false);
    const [typeaheadQuery, setTypeaheadQuery] = React.useState('');
    const [selectedTypeaheadIndex, setSelectedTypeaheadIndex] = React.useState(0);
    const [typeaheadType, setTypeaheadType] = React.useState<'agent' | 'file' | null>(null);
    const [showSlashMenu, setShowSlashMenu] = React.useState(false);
    const [slashQuery, setSlashQuery] = React.useState('');
    const [selectedSlashIndex, setSelectedSlashIndex] = React.useState(0);
    // Task 20: Prompt history state
    // B07: Store both text and innerHTML so pills restore correctly
    const [historyEntries, setHistoryEntries] = React.useState<HistoryEntry[]>([]);
    const [historyIndex, setHistoryIndex] = React.useState(-1);
    const [savedDraft, setSavedDraft] = React.useState('');
    // Task 21: Shell mode state
    const [shellMode, setShellMode] = React.useState(false);

    // B03: Server-side slash commands fetched from GET /command
    const [serverCommands, setServerCommands] = React.useState<CommandInfo[]>([]);

    React.useEffect(() => {
        let cancelled = false;
        openCodeService?.listCommands?.()
            .then(cmds => { if (!cancelled) setServerCommands(cmds); })
            .catch(() => { /* use builtin fallback only */ });
        return () => { cancelled = true; };
    }, [openCodeService]);

    // B04/B05: Server agents fetched from GET /agent
    const [serverAgents, setServerAgents] = React.useState<AgentInfo[]>([]);

    React.useEffect(() => {
        let cancelled = false;
        openCodeService?.listAgents?.()
            .then(agents => { if (!cancelled) setServerAgents(agents); })
            .catch(() => { /* use hardcoded fallback */ });
        return () => { cancelled = true; };
    }, [openCodeService]);

    // B03: Merge builtin + server commands (builtin first)
    const allSlashCommands = React.useMemo(() => [
        ...BUILTIN_SLASH_COMMANDS,
        ...serverCommands.map(c => ({ name: `/${c.name}`, description: c.description || '', local: false as const }))
    ], [serverCommands]);

    // B04/B05: Computed typeahead items (state-driven for async file search)
    const [typeaheadItems, setTypeaheadItems] = React.useState<Array<{ type: 'agent' | 'file'; name: string; description?: string }>>([]);
    // Separate state tracks whether a query has been resolved (to show "no results" message)
    const [typeaheadResolved, setTypeaheadResolved] = React.useState(false);

    React.useEffect(() => {
        if (!typeaheadType) {
            setTypeaheadItems([]);
            setTypeaheadResolved(false);
            return;
        }

        // Agents: filter serverAgents (with AVAILABLE_AGENTS as fallback if server list is empty)
        const agentSource = serverAgents.length > 0 ? serverAgents : AVAILABLE_AGENTS;
        const matchedAgents = agentSource
            .filter(agent => fuzzyMatch(typeaheadQuery, agent.name))
            .map(agent => ({ type: 'agent' as const, name: agent.name, description: agent.description }));

        // Just typed '@' with no query — show agents only, no file search
        if (typeaheadQuery.length === 0) {
            setTypeaheadItems(matchedAgents);
            setTypeaheadResolved(true);
            return;
        }

        // Show matched agents immediately; file results will be appended after debounce
        setTypeaheadItems(matchedAgents);
        setTypeaheadResolved(false);

        if (!sessionId || !openCodeService?.searchFiles) {
            // No file search available — resolve immediately with agents only
            setTypeaheadResolved(true);
            return;
        }

        // Debounce file search by 250ms to avoid a request per keystroke
        let cancelled = false;
        const debounceTimer = setTimeout(() => {
            openCodeService.searchFiles(sessionId, typeaheadQuery)
                .then(files => {
                    if (cancelled) return;
                    const fileItems = files.map(f => ({ type: 'file' as const, name: f }));
                    setTypeaheadItems([...matchedAgents, ...fileItems]);
                    setTypeaheadResolved(true);
                })
                .catch(() => {
                    if (!cancelled) {
                        // File search failed — keep agents-only result
                        setTypeaheadResolved(true);
                    }
                });
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(debounceTimer);
        };
    }, [typeaheadType, typeaheadQuery, serverAgents, sessionId, openCodeService]);

    /**
     * Get the current prompt from editor and attachments.
     */
    const getCurrentPrompt = (): Prompt => {
        if (!editorRef.current) {
            return [...fileAttachments, ...imageAttachments];
        }

        const editorParts = parseFromDOM(editorRef.current);
        return [...editorParts, ...fileAttachments, ...imageAttachments];
    };

    /**
     * Clear all content.
     */
    const clearEditor = React.useCallback(() => {
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        setImageAttachments([]);
        setFileAttachments([]);
        setShowTypeahead(false);
        setShowSlashMenu(false);
        setHasContent(false);
        setHistoryIndex(-1);
        setSavedDraft('');
        setShellMode(false);
    }, []);

    /**
     * Check if cursor is at the very beginning of the editor.
     */
    const isCursorAtStart = (): boolean => {
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
    };

    /**
     * Check if cursor is at the very end of the editor.
     */
    const isCursorAtEnd = (): boolean => {
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
    };

    /**
     * Track whether the editor has any content.
     * Called on every input event on the contenteditable div.
     */
    const handleEditorInput = React.useCallback(() => {
        if (!editorRef.current) {
            setHasContent(false);
            return;
        }
        const text = editorRef.current.textContent ?? '';
        const hasAttachments = imageAttachments.length > 0 || fileAttachments.length > 0;
        setHasContent(text.trim().length > 0 || hasAttachments);
    }, [imageAttachments, fileAttachments]);

    // Re-evaluate content when attachment state changes
    React.useEffect(() => {
        handleEditorInput();
    }, [imageAttachments, fileAttachments, handleEditorInput]);

    /**
     * Handle keyboard events.
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Ctrl+U — clear the prompt
        if (e.key.toLowerCase() === 'u' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            e.preventDefault();
            clearEditor();
            return;
        }

        // Handle typeahead navigation
        if (showTypeahead) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedTypeaheadIndex(prev => (prev + 1) % typeaheadItems.length);
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedTypeaheadIndex(prev => (prev - 1 + typeaheadItems.length) % typeaheadItems.length);
                    return;
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    if (typeaheadItems[selectedTypeaheadIndex]) {
                        insertTypeaheadItem(typeaheadItems[selectedTypeaheadIndex]);
                    }
                    return;
                case 'Escape':
                    e.preventDefault();
                    setShowTypeahead(false);
                    return;
            }
        }

        // Handle slash menu navigation (Task 18)
        if (showSlashMenu) {
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedSlashIndex(prev => (prev + 1) % filteredSlashCommands.length);
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedSlashIndex(prev => (prev - 1 + filteredSlashCommands.length) % filteredSlashCommands.length);
                    return;
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    if (filteredSlashCommands[selectedSlashIndex]) {
                        selectSlashCommand(filteredSlashCommands[selectedSlashIndex]);
                    }
                    return;
                case 'Escape':
                    e.preventDefault();
                    setShowSlashMenu(false);
                    return;
            }
        }

        // Shell mode keyboard handling (Task 21)
        if (shellMode) {
            if (e.key === 'Escape') {
                e.preventDefault();
                setShellMode(false);
                clearEditor();
                return;
            }
            if (e.key === 'Backspace') {
                const editorText = editorRef.current?.textContent || '';
                if (editorText.length === 0) {
                    e.preventDefault();
                    setShellMode(false);
                    return;
                }
            }
        }

        // Shell mode activation (Task 21): '!' at start of empty editor
        if (e.key === '!' && !shellMode && !showTypeahead && !showSlashMenu) {
            const editorText = editorRef.current?.textContent || '';
            if (editorText.length === 0) {
                e.preventDefault();
                setShellMode(true);
                return;
            }
        }

        // Prompt history navigation (Task 20)
        if (!showTypeahead && !showSlashMenu) {
            if (e.key === 'ArrowUp' && !e.shiftKey) {
                const editorText = editorRef.current?.textContent || '';
                if (editorText.length === 0 || isCursorAtStart()) {
                    if (historyEntries.length > 0 && historyIndex < historyEntries.length - 1) {
                        e.preventDefault();
                        const newIndex = historyIndex + 1;
                        if (historyIndex === -1) {
                            // B07: Save innerHTML so pills in the draft survive round-trip
                            setSavedDraft(editorRef.current?.innerHTML || '');
                        }
                        setHistoryIndex(newIndex);
                        if (editorRef.current) {
                            // B07: Restore innerHTML to bring pills back as interactive elements
                            const entry = historyEntries[newIndex];
                            editorRef.current.innerHTML = entry.html;
                            // Move cursor to end of restored content
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(editorRef.current);
                            range.collapse(false);
                            sel?.removeAllRanges();
                            sel?.addRange(range);
                        }
                        handleEditorInput();
                        return;
                    }
                }
            }

            if (e.key === 'ArrowDown' && !e.shiftKey && historyIndex >= 0) {
                if (isCursorAtEnd()) {
                    e.preventDefault();
                    const newIndex = historyIndex - 1;
                    setHistoryIndex(newIndex);
                    if (editorRef.current) {
                        if (newIndex === -1) {
                            // B07: Restore draft innerHTML so pills come back as interactive elements
                            editorRef.current.innerHTML = savedDraft;
                            // Move cursor to end of restored content
                            const draftRange = document.createRange();
                            const draftSel = window.getSelection();
                            draftRange.selectNodeContents(editorRef.current);
                            draftRange.collapse(false);
                            draftSel?.removeAllRanges();
                            draftSel?.addRange(draftRange);
                        } else {
                            // B07: Restore innerHTML to bring pills back as interactive elements
                            const entry = historyEntries[newIndex];
                            editorRef.current.innerHTML = entry.html;
                            // Move cursor to end of restored content
                            const range = document.createRange();
                            const sel = window.getSelection();
                            range.selectNodeContents(editorRef.current);
                            range.collapse(false);
                            sel?.removeAllRanges();
                            sel?.addRange(range);
                        }
                    }
                    handleEditorInput();
                    return;
                }
            }
        }

        // Handle Enter to send (Shift+Enter for newline)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    /**
     * Get all text content before the cursor in the editor (across all nodes).
     * This is needed for @ and / detection to work even with pill spans present.
     */
    const getTextBeforeCursor = (): string => {
        const editor = editorRef.current;
        if (!editor) return '';
        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return '';
        const range = selection.getRangeAt(0);
        // Create a range from start of editor to cursor position
        const preRange = document.createRange();
        preRange.setStart(editor, 0);
        preRange.setEnd(range.startContainer, range.startOffset);
        return preRange.toString();
    };

    // Ref holding the latest handleInput implementation — avoids stale closure in native listener
    const handleInputRef = React.useRef<() => void>(() => { /* noop */ });

    /**
     * Handle input to detect @ mentions and / commands.
     */
    const handleInput = React.useCallback(() => {
        if (!editorRef.current) return;

        // Reset history navigation on any input (Task 20)
        setHistoryIndex(-1);

        // In shell mode, suppress @ and / detection (Task 21)
        if (shellMode) {
            setShowTypeahead(false);
            setShowSlashMenu(false);
            return;
        }

        const beforeCursor = getTextBeforeCursor();

        // @ mention detection — find last @ not preceded by a word character
        const atMatch = beforeCursor.match(/@([^\s@]*)$/);
        if (atMatch) {
            const query = atMatch[1];
            setTypeaheadQuery(query);
            setTypeaheadType('agent');
            setShowTypeahead(true);
            setShowSlashMenu(false);
            setSelectedTypeaheadIndex(0);
            return;
        }
        setShowTypeahead(false);

        // Slash command detection — only match when / is the entire input (Task 18)
        const fullText = editorRef.current.textContent || '';
        const slashMatch = fullText.match(/^\/(\S*)$/);
        if (slashMatch) {
            const query = slashMatch[1];
            setSlashQuery(query);
            setShowSlashMenu(true);
            setSelectedSlashIndex(0);
            return;
        }
        setShowSlashMenu(false);
    }, [shellMode]);

    // Keep ref in sync so the native listener always calls the latest implementation
    React.useEffect(() => {
        handleInputRef.current = handleInput;
    });

    // Attach native input listener once so toolbar-button-dispatched events are caught
    React.useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const handler = () => handleInputRef.current();
        el.addEventListener('input', handler);
        return () => el.removeEventListener('input', handler);
    }, []);

    const handleAllInput = React.useCallback(() => {
        handleInput();
        handleEditorInput();
    }, [handleEditorInput, handleInput]);

    /**
     * Insert a typeahead item into the editor.
     */
    const insertTypeaheadItem = (item: { type: 'agent' | 'file'; name: string }) => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;

        if (textNode.nodeType === Node.TEXT_NODE) {
            const text = textNode.textContent || '';
            const cursorPosition = range.startOffset;
            const beforeCursor = text.slice(0, cursorPosition);
            const atIndex = beforeCursor.lastIndexOf('@');

            if (atIndex >= 0) {
                // Replace @query with the selected item
                const afterCursor = text.slice(cursorPosition);
                const beforeAt = text.slice(0, atIndex);
                
                const pill = document.createElement('span');
                pill.className = `prompt-pill prompt-pill-${item.type}`;
                pill.contentEditable = 'false';
                pill.textContent = item.type === 'agent' ? `@${item.name}` : item.name;
                pill.dataset.type = item.type;

                if (item.type === 'file') {
                    // data-path holds the file path (read by parse-from-dom.ts)
                    pill.dataset.path = item.name;
                } else {
                    // data-name holds the agent name (read by parse-from-dom.ts)
                    pill.dataset.name = item.name;
                }

                // Ensure there's text before the pill so it can be deleted normally.
                // If beforeAt is empty (pill would be first child), use a zero-width space
                // (\u200B). parse-from-dom.ts already strips \u200B so it won't appear in the
                // sent text, but the text node itself allows the cursor to sit before the pill
                // and backspace to delete it.
                const prefixText = beforeAt.length > 0 ? beforeAt + ' ' : '\u200B';
                const newText = document.createTextNode(prefixText);
                const spaceAfter = document.createTextNode(' ' + afterCursor);

                const parent = textNode.parentNode;
                if (parent) {
                    parent.replaceChild(spaceAfter, textNode);
                    parent.insertBefore(pill, spaceAfter);
                    parent.insertBefore(newText, pill);

                    // Move cursor after the pill
                    const newRange = document.createRange();
                    newRange.setStart(spaceAfter, 1);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        }

        setShowTypeahead(false);
    };

    /**
     * Select a slash command: clear editor and execute it (B03).
     * Local/builtin commands are handled client-side via onSend (preserving existing behavior).
     * Server commands are sent as messages via onSend.
     */
    const selectSlashCommand = (cmd: { name: string; description: string }) => {
        // Clear the editor text
        if (editorRef.current) {
            editorRef.current.textContent = '';
        }
        setShowSlashMenu(false);
        setHasContent(false);

        // Execute the command by sending it as a message
        const workspaceRoot = workspaceRootProp ?? '';
        const parts = buildRequestParts(
            [{ type: 'text', content: cmd.name, start: 0, end: cmd.name.length }],
            workspaceRoot
        );
        onSend(parts);
    };

    /**
     * Handle send button click.
     * T3-9: Use workspaceRoot prop instead of hardcoded '/workspace'
     */
    const handleSendClick = () => {
        // If agent is working and no content typed, treat click as Stop
        if (isStreaming && !hasContent) {
            onStop?.();
            return;
        }

        if (disabled) return;

        // Task 20: Save to prompt history before clearing
        // B07: Save both text and innerHTML so pills restore correctly
        const rawText = editorRef.current?.textContent?.trim() || '';
        const rawHtml = editorRef.current?.innerHTML || '';
        if (rawText && rawText !== historyEntries[0]?.text) {
            setHistoryEntries(prev => [{ text: rawText, html: rawHtml }, ...prev].slice(0, MAX_HISTORY));
        }
        setHistoryIndex(-1);
        setSavedDraft('');

        // Task 21: In shell mode, prepend '!' to indicate shell command
        if (shellMode && editorRef.current) {
            const editorText = editorRef.current.textContent || '';
            editorRef.current.textContent = '!' + editorText;
        }

        const prompt = getCurrentPrompt();
        
        const hasText = prompt.some(p => p.type === 'text' && p.content.trim().length > 0);
        const hasAttachments = prompt.some(p => p.type === 'file' || p.type === 'agent' || p.type === 'image');

        if (!hasText && !hasAttachments) return;

        const workspaceRoot = workspaceRootProp ?? '';
        const parts = buildRequestParts(prompt, workspaceRoot);

        onSend(parts);
        clearEditor();

        // Task 21: Exit shell mode after sending
        if (shellMode) {
            setShellMode(false);
        }
    };

    /**
     * Handle file button click.
     */
    const handleFileButtonClick = () => {
        fileInputRef.current?.click();
    };

    /**
     * Handle file selection from input.
     */
    const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;

        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                handleImageFile(file);
            } else {
                handleRegularFile(file);
            }
        });

        // Reset input
        e.target.value = '';
    };

    /**
     * Handle regular file attachment.
     */
    const handleRegularFile = (file: File) => {
        const filePart: FilePart = {
            type: 'file',
            path: file.name,
            content: `@${file.name}`,
            start: 0,
            end: file.name.length
        };
        setFileAttachments(prev => [...prev, filePart]);
    };

    /**
     * Handle image file (convert to data URL).
     */
    const handleImageFile = (file: File) => {
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target?.result as string;
            if (dataUrl) {
                const imagePart: ImagePart = {
                    type: 'image',
                    id: generateId(),
                    filename: file.name,
                    mime: file.type,
                    dataUrl
                };
                setImageAttachments(prev => [...prev, imagePart]);
            }
        };
        reader.readAsDataURL(file);
    };

    /**
     * Handle paste event for images and plain text sanitization (Task 22).
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData.items;
        
        // Check for image files first
        let hasImage = false;
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                hasImage = true;
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleImageFile(file);
                }
            }
        }
        if (hasImage) return;

        // For text paste: always intercept to prevent HTML injection
        e.preventDefault();
        const plainText = e.clipboardData.getData('text/plain');
        if (plainText) {
            // Use execCommand for undo support
            document.execCommand('insertText', false, plainText);
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        // Only hide overlay when leaving the container entirely, not child elements
        const container = e.currentTarget as HTMLDivElement;
        if (!container.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(false);

        const files = e.dataTransfer.files;
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                handleImageFile(file);
            } else {
                handleRegularFile(file);
            }
        });
    };

    /**
     * Remove an image attachment.
     */
    const removeImage = (imageId: string) => {
        setImageAttachments(prev => prev.filter(img => img.id !== imageId));
    };

    /**
     * Remove a file attachment.
     */
    const removeFile = (filePath: string) => {
        setFileAttachments(prev => prev.filter(f => f.path !== filePath));
    };

    const filteredSlashCommands = allSlashCommands.filter(c =>
        c.name.toLowerCase().includes(slashQuery.toLowerCase())
    );
    const showStop = isStreaming && !hasContent;

    return (
        <div
            className="prompt-input-container"
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
        >
            {/* File Attachments Preview */}
            {fileAttachments.length > 0 && (
                <div className="prompt-input-file-attachments">
                    {fileAttachments.map(file => (
                        <div key={file.path} className="prompt-input-file-item">
                            <span className="file-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" aria-hidden="true">
                                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                    <polyline points="14 2 14 8 20 8"/>
                                </svg>
                            </span>
                            <span className="file-name">{file.path}</span>
                            <button
                                type="button"
                                className="file-remove"
                                onClick={() => removeFile(file.path)}
                                aria-label={`Remove ${file.path}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Attachments Preview */}
            {imageAttachments.length > 0 && (
                <div className="prompt-input-images">
                    {imageAttachments.map(image => (
                        <div key={image.id} className="prompt-input-image-item">
                            <img src={image.dataUrl} alt={image.filename} />
                            <button
                                type="button"
                                className="prompt-input-image-remove"
                                onClick={() => removeImage(image.id)}
                                aria-label={`Remove ${image.filename}`}
                            >
                                ×
                            </button>
                        </div>
                    ))}
                </div>
            )}

            {/* Typeahead Dropdown – rendered outside editor-wrapper to avoid overflow:hidden clipping */}
            {showTypeahead && (typeaheadItems.length > 0 || (typeaheadResolved && typeaheadQuery.length > 0)) && (
                <div 
                    className="prompt-input-typeahead"
                >
                    {typeaheadItems.length === 0 && typeaheadResolved ? (
                        <div className="typeahead-item typeahead-empty">
                            <div className="typeahead-content">
                                <div className="typeahead-description">{`No agents or files matching "${typeaheadQuery}"`}</div>
                            </div>
                        </div>
                    ) : (
                        typeaheadItems.map((item, index) => (
                        <div
                            key={`${item.type}-${item.name}`}
                            className={`typeahead-item ${index === selectedTypeaheadIndex ? 'selected' : ''}`}
                            onClick={() => insertTypeaheadItem(item)}
                            onMouseEnter={() => setSelectedTypeaheadIndex(index)}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    insertTypeaheadItem(item);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                        >
                            <span className={`typeahead-icon ${item.type}`}>
                                {item.type === 'agent' ? (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                                        <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                                    </svg>
                                ) : (
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                                        <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/>
                                        <polyline points="14 2 14 8 20 8"/>
                                    </svg>
                                )}
                            </span>
                            <div className="typeahead-content">
                                <div className="typeahead-name">
                                    {item.type === 'agent' ? `@${item.name}` : item.name}
                                </div>
                                {item.description && (
                                    <div className="typeahead-description">{item.description}</div>
                                )}
                            </div>
                        </div>
                    )))}
                </div>
            )}

            {/* Slash Command Menu – rendered outside editor-wrapper to avoid overflow:hidden clipping */}
            {showSlashMenu && filteredSlashCommands.length > 0 && (
                <div className="prompt-input-typeahead" role="listbox" aria-label="Commands">
                    {filteredSlashCommands.map((cmd, index) => (
                        <div
                            key={cmd.name}
                            className={`typeahead-item ${index === selectedSlashIndex ? 'selected' : ''}`}
                            onClick={() => selectSlashCommand(cmd)}
                            onMouseEnter={() => setSelectedSlashIndex(index)}
                            role="option"
                            tabIndex={0}
                        >
                            <span className="typeahead-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                                    <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                                </svg>
                            </span>
                            <div className="typeahead-content">
                                <div className="typeahead-name">{cmd.name}</div>
                                <div className="typeahead-description">{cmd.description}</div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <div className="prompt-input-editor-wrapper">
                {/* Shell Mode Indicator (Task 21) */}
                {shellMode && (
                    <div className="prompt-input-shell-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                            <polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/>
                        </svg>
                        <span>Shell mode</span>
                        <span style={{ opacity: 0.6 }}>press Esc to exit</span>
                    </div>
                )}

                {/* Contenteditable Editor */}
                <div
                    ref={editorRef}
                    className="prompt-input-editor"
                    contentEditable={!disabled}
                    data-placeholder={shellMode ? 'Run a shell command...' : placeholder}
                    data-shell-mode={shellMode ? 'true' : undefined}
                    onKeyDown={handleKeyDown}
                    onInput={handleAllInput}
                    onPaste={handlePaste}
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Message input"
                    tabIndex={0}
                />

                {/* Drag Overlay */}
                {isDragging && (
                    <div className="prompt-input-drag-overlay" aria-hidden="true">
                        <svg className="prompt-input-drag-overlay-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28">
                            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                            <polyline points="17 8 12 3 7 8"/>
                            <line x1="12" y1="3" x2="12" y2="15"/>
                        </svg>
                        <div className="prompt-input-drag-overlay-text">Drop files or images</div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="prompt-input-toolbar">
                    <input
                        ref={fileInputRef}
                        type="file"
                        multiple
                        style={{ display: 'none' }}
                        onChange={handleFileSelect}
                        accept="image/*,.txt,.md,.json,.ts,.js,.tsx,.jsx,.css,.scss,.html,.py,.rs,.go,.java,.c,.cpp,.h,.hpp"
                    />
                    
                    <button
                        type="button"
                        className="prompt-input-icon-btn"
                        onClick={() => {
                            const el = editorRef.current;
                            if (!el) return;
                            el.focus();
                            // Insert @ at cursor
                            const sel = window.getSelection();
                            if (sel && sel.rangeCount > 0) {
                                const range = sel.getRangeAt(0);
                                range.deleteContents();
                                const textNode = document.createTextNode('@');
                                range.insertNode(textNode);
                                range.setStartAfter(textNode);
                                range.setEndAfter(textNode);
                                sel.removeAllRanges();
                                sel.addRange(range);
                            } else {
                                el.appendChild(document.createTextNode('@'));
                            }
                            // Manually fire input event so handleInput runs
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        }}
                        disabled={disabled}
                        title="Mention agent or file (@)"
                    >
                        @
                    </button>
                    <button
                        type="button"
                        className="prompt-input-icon-btn"
                        onClick={() => {
                            const el = editorRef.current;
                            if (!el) return;
                            el.focus();
                            const sel = window.getSelection();
                            if (sel && sel.rangeCount > 0) {
                                const range = sel.getRangeAt(0);
                                range.deleteContents();
                                const textNode = document.createTextNode('/');
                                range.insertNode(textNode);
                                range.setStartAfter(textNode);
                                range.setEndAfter(textNode);
                                sel.removeAllRanges();
                                sel.addRange(range);
                            } else {
                                el.appendChild(document.createTextNode('/'));
                            }
                            el.dispatchEvent(new Event('input', { bubbles: true }));
                        }}
                        disabled={disabled}
                        title="Commands (/)"
                    >
                        /
                    </button>

                    <button
                        type="button"
                        className="prompt-input-icon-btn"
                        onClick={handleFileButtonClick}
                        disabled={disabled}
                        title="Attach file or image"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                            <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/>
                        </svg>
                    </button>

                    <button
                        type="button"
                        className={showStop ? 'prompt-input-send-button prompt-input-stop-button' : 'prompt-input-send-button'}
                        onClick={handleSendClick}
                        disabled={disabled && !showStop}
                        title={showStop ? 'Stop generation' : 'Send message (Enter)'}
                        aria-label={showStop ? 'Stop generation' : 'Send message'}
                    >
                        {showStop ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true">
                                <rect x="4" y="4" width="16" height="16" rx="2"/>
                            </svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                                <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                            </svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
