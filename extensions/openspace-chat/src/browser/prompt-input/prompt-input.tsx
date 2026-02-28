/**
 * PromptInput Component — Facade
 *
 * Multi-part prompt input supporting text, file/image attachments,
 * @mention typeahead, slash commands, shell mode, and keyboard navigation.
 *
 * Decomposed from the 1,186-line monolith into focused sub-modules (Phase 4c).
 * This facade wires together the extracted hooks and renders the JSX.
 */

import * as React from '@theia/core/shared/react';
import { parseFromDOM } from './parse-from-dom';
import { buildRequestParts } from './build-request-parts';
import type { PromptInputProps, Prompt } from './types';
import { PromptSessionStore } from '../prompt-session-store';
import { sanitizeHtml } from './sanitize-html';
import { BUILTIN_SLASH_COMMANDS } from './prompt-constants';
import { usePromptHistory } from './use-prompt-history';
import { useTypeahead, useSlashMenu } from './use-typeahead';
import { useAttachments } from './use-attachments';
import { isCursorAtStart, isCursorAtEnd, getTextBeforeCursor } from './cursor-utils';
import { AgentSelector } from './agent-selector';
import '../style/prompt-input.css';

// P1-C: module-level singleton — one store shared across all PromptInput mounts
const promptSessionStore = new PromptSessionStore();

export const PromptInput: React.FC<PromptInputProps> = ({
    onSend,
    onCommand,
    onBuiltinCommand,
    onShellCommand,
    onStop,
    isStreaming = false,
    disabled = false,
    placeholder = 'Type your message, @mention files/agents, or attach images...',
    workspaceRoot: workspaceRootProp,
    openCodeService,
    sessionId,
    agentSelectorAgents,
    agentSelectorSelected,
    onAgentSelect
}) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [hasContent, setHasContent] = React.useState(false);
    const [shellMode, setShellMode] = React.useState(false);

    // ─── Sub-module hooks ─────────────────────────────────────────────────
    const history = usePromptHistory();
    const typeahead = useTypeahead(openCodeService, sessionId);
    const slashMenu = useSlashMenu(openCodeService);
    const attachments = useAttachments();

    // ─── Session draft persistence (P1-C) ─────────────────────────────────
    const prevSessionIdRef = React.useRef<string | undefined>(undefined);
    React.useEffect(() => {
        const prev = prevSessionIdRef.current;
        const next = sessionId;
        if (prev === next) return;

        if (prev !== undefined && editorRef.current) {
            const html = editorRef.current.innerHTML;
            const text = editorRef.current.textContent ?? '';
            if (text.trim()) {
                promptSessionStore.save(prev, { text: html });
            }
        }

        if (next !== undefined && editorRef.current) {
            const snapshot = promptSessionStore.restore(next);
            if (snapshot) {
                editorRef.current.innerHTML = sanitizeHtml(snapshot.text);
                const range = document.createRange();
                range.selectNodeContents(editorRef.current);
                range.collapse(false);
                const sel = window.getSelection();
                sel?.removeAllRanges();
                sel?.addRange(range);
                setHasContent(true);
            } else {
                editorRef.current.innerHTML = '';
                setHasContent(false);
            }
        }

        prevSessionIdRef.current = next;
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [sessionId]);

    // ─── Helpers ──────────────────────────────────────────────────────────

    const getCurrentPrompt = (): Prompt => {
        if (!editorRef.current) {
            return [...attachments.fileAttachments, ...attachments.imageAttachments];
        }
        const editorParts = parseFromDOM(editorRef.current);
        return [...editorParts, ...attachments.fileAttachments, ...attachments.imageAttachments];
    };

    const clearEditor = React.useCallback(() => {
        if (editorRef.current) editorRef.current.innerHTML = '';
        attachments.clearAttachments();
        typeahead.setShowTypeahead(false);
        slashMenu.setShowSlashMenu(false);
        setHasContent(false);
        history.resetIndex();
        setShellMode(false);
    }, [attachments, typeahead, slashMenu, history]);

    const handleEditorInput = React.useCallback(() => {
        if (!editorRef.current) { setHasContent(false); return; }
        const text = editorRef.current.textContent ?? '';
        const hasAtt = attachments.imageAttachments.length > 0 || attachments.fileAttachments.length > 0;
        setHasContent(text.trim().length > 0 || hasAtt);
    }, [attachments.imageAttachments, attachments.fileAttachments]);

    React.useEffect(() => { handleEditorInput(); }, [attachments.imageAttachments, attachments.fileAttachments, handleEditorInput]);

    // ─── Input detection (@ mentions, / commands) ─────────────────────────

    const handleInputRef = React.useRef<() => void>(() => { /* noop */ });

    const handleInput = React.useCallback(() => {
        if (!editorRef.current) return;
        history.resetIndex();

        // Save current cursor position so insertTypeaheadItem can restore it
        // even after onMouseDown+preventDefault on the dropdown item.
        const sel = window.getSelection();
        if (sel && sel.rangeCount > 0) {
            const r = sel.getRangeAt(0);
            if (r.startContainer.nodeType === Node.TEXT_NODE) {
                typeahead.savedRangeRef.current = { node: r.startContainer, start: r.startOffset };
            }
        }

        if (shellMode) {
            typeahead.setShowTypeahead(false);
            slashMenu.setShowSlashMenu(false);
            return;
        }

        const beforeCursor = getTextBeforeCursor(editorRef);
        const atMatch = beforeCursor.match(/@([^\s@]*)$/);
        if (atMatch) {
            typeahead.setTypeaheadQuery(atMatch[1]);
            typeahead.setTypeaheadType('agent');
            typeahead.setShowTypeahead(true);
            slashMenu.setShowSlashMenu(false);
            typeahead.setSelectedTypeaheadIndex(0);
            return;
        }
        typeahead.setShowTypeahead(false);

        const fullText = editorRef.current.textContent || '';
        const slashMatch = fullText.match(/^\/(\S*)$/);
        if (slashMatch) {
            slashMenu.setSlashQuery(slashMatch[1]);
            slashMenu.setShowSlashMenu(true);
            slashMenu.setSelectedSlashIndex(0);
            return;
        }
        slashMenu.setShowSlashMenu(false);
    }, [shellMode, history, typeahead, slashMenu]);

    React.useEffect(() => { handleInputRef.current = handleInput; });
    React.useEffect(() => {
        const el = editorRef.current;
        if (!el) return;
        const handler = () => handleInputRef.current();
        el.addEventListener('input', handler);
        return () => el.removeEventListener('input', handler);
    }, []);

    const handleAllInput = React.useCallback(() => { handleInput(); handleEditorInput(); }, [handleEditorInput, handleInput]);

    // ─── Keyboard handling ────────────────────────────────────────────────

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key.toLowerCase() === 'u' && (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey) {
            e.preventDefault(); clearEditor(); return;
        }

        if (typeahead.showTypeahead) {
            switch (e.key) {
                case 'ArrowDown': e.preventDefault(); typeahead.setSelectedTypeaheadIndex(prev => (prev + 1) % typeahead.typeaheadItems.length); return;
                case 'ArrowUp': e.preventDefault(); typeahead.setSelectedTypeaheadIndex(prev => (prev - 1 + typeahead.typeaheadItems.length) % typeahead.typeaheadItems.length); return;
                case 'Enter': case 'Tab': e.preventDefault(); if (typeahead.typeaheadItems[typeahead.selectedTypeaheadIndex]) typeahead.insertTypeaheadItem(typeahead.typeaheadItems[typeahead.selectedTypeaheadIndex], editorRef); return;
                case 'Escape': e.preventDefault(); typeahead.setShowTypeahead(false); return;
            }
        }

        if (slashMenu.showSlashMenu) {
            switch (e.key) {
                case 'ArrowDown': e.preventDefault(); slashMenu.setSelectedSlashIndex(prev => (prev + 1) % slashMenu.filteredSlashCommands.length); return;
                case 'ArrowUp': e.preventDefault(); slashMenu.setSelectedSlashIndex(prev => (prev - 1 + slashMenu.filteredSlashCommands.length) % slashMenu.filteredSlashCommands.length); return;
                case 'Enter': case 'Tab': e.preventDefault(); if (slashMenu.filteredSlashCommands[slashMenu.selectedSlashIndex]) slashMenu.selectSlashCommand(slashMenu.filteredSlashCommands[slashMenu.selectedSlashIndex], editorRef, setHasContent, onBuiltinCommand); return;
                case 'Escape': e.preventDefault(); slashMenu.setShowSlashMenu(false); return;
            }
        }

        if (shellMode) {
            if (e.key === 'Escape') { e.preventDefault(); setShellMode(false); clearEditor(); return; }
            if (e.key === 'Backspace') {
                const editorText = editorRef.current?.textContent || '';
                if (editorText.length === 0) { e.preventDefault(); setShellMode(false); return; }
            }
        }

        if (e.key === '!' && !shellMode && !typeahead.showTypeahead && !slashMenu.showSlashMenu) {
            const editorText = editorRef.current?.textContent || '';
            if (editorText.length === 0) { e.preventDefault(); setShellMode(true); return; }
        }

        if (!typeahead.showTypeahead && !slashMenu.showSlashMenu) {
            if (e.key === 'ArrowUp' && !e.shiftKey) {
                if (history.navigateUp(editorRef, () => isCursorAtStart(editorRef), handleEditorInput)) { e.preventDefault(); return; }
            }
            if (e.key === 'ArrowDown' && !e.shiftKey && history.historyIndex >= 0) {
                if (history.navigateDown(editorRef, () => isCursorAtEnd(editorRef), handleEditorInput)) { e.preventDefault(); return; }
            }
        }

        if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSendClick(); }
    };

    // ─── Send ─────────────────────────────────────────────────────────────

    const handleSendClick = () => {
        if (isStreaming && !hasContent) { onStop?.(); return; }
        if (disabled) return;

        const rawText = editorRef.current?.textContent?.trim() || '';
        const rawHtml = editorRef.current?.innerHTML || '';
        if (rawText) history.pushEntry(rawText, rawHtml);

        const prompt = getCurrentPrompt();
        const hasText = prompt.some(p => p.type === 'text' && p.content.trim().length > 0);
        const hasAtt = prompt.some(p => p.type === 'file' || p.type === 'agent' || p.type === 'image');
        if (!hasText && !hasAtt) return;

        if (shellMode && rawText) { clearEditor(); setShellMode(false); onShellCommand?.(rawText); return; }

        if (rawText.startsWith('/')) {
            const [cmdToken, ...argTokens] = rawText.split(' ');
            const commandName = cmdToken.slice(1);
            const matchedCmd = slashMenu.allSlashCommands.find(c =>
                (c.name.startsWith('/') ? c.name.slice(1) : c.name) === commandName && !c.local
            );
            if (matchedCmd) {
                clearEditor(); onCommand?.(commandName, argTokens.join(' ').trim(), matchedCmd.agent);
                if (shellMode) setShellMode(false); return;
            }
            const builtinMatch = BUILTIN_SLASH_COMMANDS.find(c => c.name === `/${commandName}` || c.name === commandName);
            if (builtinMatch) { clearEditor(); onBuiltinCommand?.(commandName); if (shellMode) setShellMode(false); return; }
        }

        const workspaceRoot = workspaceRootProp ?? '';
        onSend(buildRequestParts(prompt, workspaceRoot));
        clearEditor();
        if (shellMode) setShellMode(false);
    };

    const showStop = isStreaming && !hasContent;

    // ─── JSX ──────────────────────────────────────────────────────────────

    return (
        <div className="prompt-input-container" onDragOver={attachments.handleDragOver} onDragLeave={attachments.handleDragLeave} onDrop={attachments.handleDrop}>
            {/* File Attachments Preview */}
            {attachments.fileAttachments.length > 0 && (
                <div className="prompt-input-file-attachments">
                    {attachments.fileAttachments.map(file => (
                        <div key={file.path} className="prompt-input-file-item">
                            <span className="file-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" aria-hidden="true">
                                    <path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/>
                                </svg>
                            </span>
                            <span className="file-name">{file.path}</span>
                            <button type="button" className="file-remove" onClick={() => attachments.removeFile(file.path)} aria-label={`Remove ${file.path}`}>×</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Image Attachments Preview */}
            {attachments.imageAttachments.length > 0 && (
                <div className="prompt-input-images">
                    {attachments.imageAttachments.map(image => (
                        <div key={image.id} className="prompt-input-image-item">
                            <img src={image.dataUrl} alt={image.filename} />
                            <button type="button" className="prompt-input-image-remove" onClick={() => attachments.removeImage(image.id)} aria-label={`Remove ${image.filename}`}>×</button>
                        </div>
                    ))}
                </div>
            )}

            {/* Typeahead Dropdown */}
            {typeahead.showTypeahead && (typeahead.typeaheadItems.length > 0 || (typeahead.typeaheadResolved && typeahead.typeaheadQuery.length > 0)) && (
                <div className="prompt-input-typeahead">
                    {typeahead.typeaheadItems.length === 0 && typeahead.typeaheadResolved ? (
                        <div className="typeahead-item typeahead-empty">
                            <div className="typeahead-content"><div className="typeahead-description">{`No agents or files matching "${typeahead.typeaheadQuery}"`}</div></div>
                        </div>
                    ) : (
                        typeahead.typeaheadItems.map((item, index) => (
                            <div key={`${item.type}-${item.name}`} className={`typeahead-item ${index === typeahead.selectedTypeaheadIndex ? 'selected' : ''}`}
                                onMouseDown={(e) => { e.preventDefault(); typeahead.insertTypeaheadItem(item, editorRef); }} onMouseEnter={() => typeahead.setSelectedTypeaheadIndex(index)}
                                onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); typeahead.insertTypeaheadItem(item, editorRef); } }}
                                role="button" tabIndex={0}>
                                <span className={`typeahead-icon ${item.type}`}>
                                    {item.type === 'agent' ? (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg>
                                    ) : (
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><polyline points="14 2 14 8 20 8"/></svg>
                                    )}
                                </span>
                                <div className="typeahead-content">
                                    <div className="typeahead-name">{item.type === 'agent' ? `@${item.name}` : item.name}</div>
                                    {item.description && <div className="typeahead-description">{item.description}</div>}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Slash Command Menu */}
            {slashMenu.showSlashMenu && slashMenu.filteredSlashCommands.length > 0 && (
                <div className="prompt-input-typeahead" role="listbox" aria-label="Commands">
                    {slashMenu.filteredSlashCommands.map((cmd, index) => (
                        <div key={cmd.name} className={`typeahead-item ${index === slashMenu.selectedSlashIndex ? 'selected' : ''}`}
                            onMouseDown={(e) => { e.preventDefault(); slashMenu.selectSlashCommand(cmd, editorRef, setHasContent, onBuiltinCommand); }}
                            onMouseEnter={() => slashMenu.setSelectedSlashIndex(index)} role="option" tabIndex={0}>
                            <span className="typeahead-icon">
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
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
                {shellMode && (
                    <div className="prompt-input-shell-indicator">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true"><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></svg>
                        <span>Shell mode</span>
                        <span style={{ opacity: 0.6 }}>press Esc to exit</span>
                    </div>
                )}

                <div ref={editorRef} className="prompt-input-editor" contentEditable={!disabled}
                    data-placeholder={shellMode ? 'Run a shell command...' : placeholder}
                    data-shell-mode={shellMode ? 'true' : undefined}
                    onKeyDown={handleKeyDown} onInput={handleAllInput} onPaste={attachments.handlePaste}
                    role="textbox" aria-multiline="true" aria-label="Message input" tabIndex={0} />

                {attachments.isDragging && (
                    <div className="prompt-input-drag-overlay" aria-hidden="true">
                        <svg className="prompt-input-drag-overlay-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" width="28" height="28"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        <div className="prompt-input-drag-overlay-text">Drop files or images</div>
                    </div>
                )}

                <div className="prompt-input-toolbar">
                    {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                    <input ref={attachments.fileInputRef as any} type="file" multiple style={{ display: 'none' }} onChange={attachments.handleFileSelect}
                        accept="image/*,.txt,.md,.json,.ts,.js,.tsx,.jsx,.css,.scss,.html,.py,.rs,.go,.java,.c,.cpp,.h,.hpp" />

                    <div className="prompt-toolbar-left-group">
                        <AgentSelector
                            agents={agentSelectorAgents ?? []}
                            selectedAgent={agentSelectorSelected ?? null}
                            onSelect={onAgentSelect ?? (() => {})}
                            disabled={disabled}
                        />
                    </div>

                    <button type="button" className="prompt-input-icon-btn" onClick={() => {
                        const el = editorRef.current; if (!el) return; el.focus();
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) { const r = sel.getRangeAt(0); r.deleteContents(); const t = document.createTextNode('@'); r.insertNode(t); r.setStartAfter(t); r.setEndAfter(t); sel.removeAllRanges(); sel.addRange(r); }
                        else { el.appendChild(document.createTextNode('@')); }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }} disabled={disabled} title="Mention agent or file (@)">@</button>

                    <button type="button" className="prompt-input-icon-btn" onClick={() => {
                        const el = editorRef.current; if (!el) return; el.focus();
                        const sel = window.getSelection();
                        if (sel && sel.rangeCount > 0) { const r = sel.getRangeAt(0); r.deleteContents(); const t = document.createTextNode('/'); r.insertNode(t); r.setStartAfter(t); r.setEndAfter(t); sel.removeAllRanges(); sel.addRange(r); }
                        else { el.appendChild(document.createTextNode('/')); }
                        el.dispatchEvent(new Event('input', { bubbles: true }));
                    }} disabled={disabled} title="Commands (/)">/</button>

                    <button type="button" className="prompt-input-icon-btn" onClick={attachments.handleFileButtonClick} disabled={disabled} title="Attach file or image">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"/></svg>
                    </button>

                    <button type="button" className={showStop ? 'prompt-input-send-button prompt-input-stop-button' : 'prompt-input-send-button'}
                        onClick={handleSendClick} disabled={disabled && !showStop}
                        title={showStop ? 'Stop generation' : 'Send message (Enter)'} aria-label={showStop ? 'Stop generation' : 'Send message'}>
                        {showStop ? (
                            <svg viewBox="0 0 24 24" fill="currentColor" width="14" height="14" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="2"/></svg>
                        ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
                        )}
                    </button>
                </div>
            </div>
        </div>
    );
};
