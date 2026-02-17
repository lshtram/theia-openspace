/**
 * PromptInput Component
 * 
 * Multi-part prompt input supporting text, file mentions, agent mentions, and images.
 * This is Phase 1 implementation: core contenteditable input with text support.
 */

import * as React from 'react';
import { parseFromDOM } from './parse-from-dom';
import { buildRequestParts } from './build-request-parts';
import type { PromptInputProps, Prompt, ImagePart } from './types';
import '../style/prompt-input.css';

export const PromptInput: React.FC<PromptInputProps> = ({
    onSend,
    disabled = false,
    placeholder = 'Type your message...'
}) => {
    const editorRef = React.useRef<HTMLDivElement>(null);
    const [imageAttachments, setImageAttachments] = React.useState<ImagePart[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);

    /**
     * Parse the current editor content into a Prompt.
     */
    const getCurrentPrompt = (): Prompt => {
        if (!editorRef.current) {
            return [];
        }

        const editorParts = parseFromDOM(editorRef.current);
        const allParts: Prompt = [...editorParts, ...imageAttachments];
        return allParts;
    };

    /**
     * Clear the editor content.
     */
    const clearEditor = () => {
        if (editorRef.current) {
            editorRef.current.innerHTML = '';
        }
        setImageAttachments([]);
    };

    /**
     * Handle Enter key to send message.
     * Shift+Enter inserts newline.
     */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            handleSendClick();
        }
    };

    /**
     * Handle send button click.
     */
    const handleSendClick = () => {
        if (disabled) {
            return;
        }

        const prompt = getCurrentPrompt();
        
        // Check if there's any content
        const hasText = prompt.some(p => p.type === 'text' && p.content.trim().length > 0);
        const hasAttachments = prompt.some(p => p.type === 'file' || p.type === 'agent' || p.type === 'image');

        if (!hasText && !hasAttachments) {
            return; // Don't send empty messages
        }

        // TODO: Get workspace root from Theia service
        const workspaceRoot = '/workspace';
        const parts = buildRequestParts(prompt, workspaceRoot);

        onSend(parts);
        clearEditor();
    };

    /**
     * Handle input event to normalize DOM structure.
     */
    const handleInput = () => {
        // In Phase 1, we don't need to do anything special
        // In later phases, this will normalize the DOM structure
    };

    /**
     * Handle paste event to intercept image pastes.
     * (Phase 3 feature - placeholder for now)
     */
    const handlePaste = (e: React.ClipboardEvent<HTMLDivElement>) => {
        // Phase 3: Handle image paste
        // For now, allow default paste behavior
    };

    /**
     * Handle drag events for file/image drop.
     * (Phase 2/3 feature - placeholder for now)
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
        // Phase 2/3: Handle file/image drop
    };

    /**
     * Remove an image attachment.
     */
    const removeImage = (imageId: string) => {
        setImageAttachments(prev => prev.filter(img => img.id !== imageId));
    };

    return (
        <div className="prompt-input-container">
            <div className="prompt-input-editor-wrapper">
                {/* Image Preview Area (Phase 3) */}
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

                {/* Drag Overlay (Phase 2/3) */}
                {isDragging && (
                    <div className="prompt-input-drag-overlay">
                        <div className="prompt-input-drag-overlay-text">
                            Drop file or image here
                        </div>
                    </div>
                )}

                {/* Toolbar */}
                <div className="prompt-input-toolbar">
                    {/* Attach File Button (Phase 2) */}
                    <button
                        type="button"
                        className="prompt-input-button"
                        disabled={disabled}
                        aria-label="Attach file"
                    >
                        📎 Attach
                    </button>

                    {/* Send Button */}
                    <button
                        type="button"
                        className="prompt-input-button prompt-input-send-button"
                        onClick={handleSendClick}
                        disabled={disabled}
                        aria-label="Send message"
                    >
                        Send
                    </button>
                </div>
            </div>

            {/* Typeahead Dropdown (Phase 4) */}
            {/* Will be added in Phase 4 */}
        </div>
    );
};
