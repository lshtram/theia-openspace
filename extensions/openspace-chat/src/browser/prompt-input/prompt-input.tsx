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
import '../style/prompt-input.css';

// Simple unique ID generator
const generateId = () => crypto.randomUUID();

// Available agents (hardcoded for now - could come from configuration)
const AVAILABLE_AGENTS = [
    { name: 'oracle', description: 'System architect and requirements analyst' },
    { name: 'builder', description: 'Code implementation specialist' },
    { name: 'analyst', description: 'Requirements discovery and investigation' },
    { name: 'janitor', description: 'QA and validation' },
];

export const PromptInput: React.FC<PromptInputProps> = ({
    onSend,
    disabled = false,
    placeholder = 'Type your message, @mention files/agents, or attach images...',
    workspaceRoot: workspaceRootProp
}) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imageAttachments, setImageAttachments] = React.useState<ImagePart[]>([]);
    const [fileAttachments, setFileAttachments] = React.useState<FilePart[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);
    const [showTypeahead, setShowTypeahead] = React.useState(false);
    const [typeaheadQuery, setTypeaheadQuery] = React.useState('');
    const [typeaheadPosition, setTypeaheadPosition] = React.useState({ top: 0, left: 0 });
    const [selectedTypeaheadIndex, setSelectedTypeaheadIndex] = React.useState(0);
    const [typeaheadType, setTypeaheadType] = React.useState<'agent' | 'file' | null>(null);

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
    const clearEditor = () => {
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        setImageAttachments([]);
        setFileAttachments([]);
        setShowTypeahead(false);
    };

    /**
     * Handle keyboard events.
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        // Handle typeahead navigation
        if (showTypeahead) {
            const items = getTypeaheadItems();
            
            switch (e.key) {
                case 'ArrowDown':
                    e.preventDefault();
                    setSelectedTypeaheadIndex(prev => (prev + 1) % items.length);
                    return;
                case 'ArrowUp':
                    e.preventDefault();
                    setSelectedTypeaheadIndex(prev => (prev - 1 + items.length) % items.length);
                    return;
                case 'Enter':
                case 'Tab':
                    e.preventDefault();
                    if (items[selectedTypeaheadIndex]) {
                        insertTypeaheadItem(items[selectedTypeaheadIndex]);
                    }
                    return;
                case 'Escape':
                    e.preventDefault();
                    setShowTypeahead(false);
                    return;
            }
        }

        // Handle Enter to send (Shift+Enter for newline)
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    /**
     * Handle input to detect @ mentions.
     */
    const handleInput = () => {
        if (!editorRef.current) return;

        const selection = window.getSelection();
        if (!selection || selection.rangeCount === 0) return;

        const range = selection.getRangeAt(0);
        const textNode = range.startContainer;
        
        if (textNode.nodeType !== Node.TEXT_NODE) return;

        const text = textNode.textContent || '';
        const cursorPosition = range.startOffset;
        
        // Check if we're typing @ or after @
        const beforeCursor = text.slice(0, cursorPosition);
        const atIndex = beforeCursor.lastIndexOf('@');
        
        if (atIndex >= 0) {
            const query = beforeCursor.slice(atIndex + 1);
            
            // Don't show if there's a space in the query
            if (!query.includes(' ')) {
                setTypeaheadQuery(query);
                setTypeaheadType(query.length === 0 || /^[a-zA-Z]/.test(query) ? 'agent' : 'file');
                setShowTypeahead(true);
                setSelectedTypeaheadIndex(0);
                
                // Calculate position for dropdown
                const rect = range.getBoundingClientRect();
                const editorRect = editorRef.current.getBoundingClientRect();
                setTypeaheadPosition({
                    top: rect.bottom - editorRect.top + 5,
                    left: rect.left - editorRect.left
                });
                return;
            }
        }
        
        setShowTypeahead(false);
    };

    /**
     * Get items for typeahead based on query and type.
     */
    const getTypeaheadItems = (): Array<{ type: 'agent' | 'file'; name: string; description?: string }> => {
        if (!typeaheadType) return [];

        if (typeaheadType === 'agent') {
            return AVAILABLE_AGENTS
                .filter(agent => agent.name.toLowerCase().includes(typeaheadQuery.toLowerCase()))
                .map(agent => ({ type: 'agent' as const, name: agent.name, description: agent.description }));
        }

        // For files, we would search the workspace - mock for now
        return [];
    };

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
                pill.dataset.name = item.name;

                const newText = document.createTextNode(beforeAt + ' ');
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
     * Handle send button click.
     * T3-9: Use workspaceRoot prop instead of hardcoded '/workspace'
     */
    const handleSendClick = () => {
        if (disabled) return;

        const prompt = getCurrentPrompt();
        
        const hasText = prompt.some(p => p.type === 'text' && p.content.trim().length > 0);
        const hasAttachments = prompt.some(p => p.type === 'file' || p.type === 'agent' || p.type === 'image');

        if (!hasText && !hasAttachments) return;

        // Use prop or fallback to empty string (buildRequestParts handles it)
        const workspaceRoot = workspaceRootProp ?? '';
        const parts = buildRequestParts(prompt, workspaceRoot);

        onSend(parts);
        clearEditor();
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
     * Handle paste event for images.
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        const items = e.clipboardData.items;
        
        for (const item of Array.from(items)) {
            if (item.type.startsWith('image/')) {
                e.preventDefault();
                const file = item.getAsFile();
                if (file) {
                    handleImageFile(file);
                }
            }
        }
    };

    /**
     * Handle drag events.
     */
    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(true);
    };

    const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragging(false);
    };

    const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
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

    const typeaheadItems = getTypeaheadItems();

    return (
        <div className="prompt-input-container">
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

            <div className="prompt-input-editor-wrapper">
                {/* Contenteditable Editor */}
                <div
                    ref={editorRef}
                    className="prompt-input-editor"
                    contentEditable={!disabled}
                    data-placeholder={placeholder}
                    onKeyDown={handleKeyDown}
                    onInput={handleInput}
                    onPaste={handlePaste}
                    onDragOver={handleDragOver}
                    onDragLeave={handleDragLeave}
                    onDrop={handleDrop}
                    role="textbox"
                    aria-multiline="true"
                    aria-label="Message input"
                    tabIndex={0}
                />

                {/* Drag Overlay */}
                {isDragging && (
                    <div className="prompt-input-drag-overlay">
                        <div className="prompt-input-drag-overlay-text">
                            Drop files or images here
                        </div>
                    </div>
                )}

                {/* Typeahead Dropdown */}
                {showTypeahead && typeaheadItems.length > 0 && (
                    <div 
                        className="prompt-input-typeahead"
                        style={{ top: typeaheadPosition.top, left: typeaheadPosition.left }}
                    >
                        {typeaheadItems.map((item, index) => (
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
                                    {item.type === 'agent' ? '🤖' : '📄'}
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
                        ))}
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
                        onClick={() => { /* trigger @mention */ }}
                        disabled={disabled}
                        title="Mention agent or file (@)"
                    >
                        @
                    </button>
                    <button
                        type="button"
                        className="prompt-input-icon-btn"
                        onClick={() => { /* trigger / command menu */ }}
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
                        className="prompt-input-send-button"
                        onClick={handleSendClick}
                        disabled={disabled}
                        title="Send message (Enter)"
                    >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="14" height="14" aria-hidden="true">
                            <line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/>
                        </svg>
                    </button>
                </div>
            </div>
        </div>
    );
};
