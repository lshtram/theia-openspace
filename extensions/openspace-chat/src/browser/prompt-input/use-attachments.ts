/**
 * Custom hook for file and image attachments, drag-drop, paste handling.
 *
 * Extracted from the prompt-input monolith during god-object decomposition (Phase 4c).
 */

import * as React from '@theia/core/shared/react';
import type { ImagePart, FilePart } from './types';
import { generateId } from './prompt-constants';

export interface AttachmentsState {
    imageAttachments: ImagePart[];
    fileAttachments: FilePart[];
    isDragging: boolean;
    /** Ref for the hidden <input type="file"> element. */
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    setImageAttachments: React.Dispatch<React.SetStateAction<ImagePart[]>>;
    setFileAttachments: React.Dispatch<React.SetStateAction<FilePart[]>>;
    handleFileSelect: (e: React.ChangeEvent<HTMLInputElement>) => void;
    handleFileButtonClick: () => void;
    handlePaste: (e: React.ClipboardEvent<HTMLDivElement>) => void;
    handleDragOver: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDragLeave: (e: React.DragEvent<HTMLDivElement>) => void;
    handleDrop: (e: React.DragEvent<HTMLDivElement>) => void;
    removeImage: (imageId: string) => void;
    removeFile: (filePath: string) => void;
    clearAttachments: () => void;
}

export function useAttachments(): AttachmentsState {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [imageAttachments, setImageAttachments] = React.useState<ImagePart[]>([]);
    const [fileAttachments, setFileAttachments] = React.useState<FilePart[]>([]);
    const [isDragging, setIsDragging] = React.useState(false);

    const handleImageFile = React.useCallback((file: File) => {
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
    }, []);

    const handleRegularFile = React.useCallback((file: File) => {
        const filePart: FilePart = {
            type: 'file',
            path: file.name,
            content: `@${file.name}`,
            start: 0,
            end: file.name.length
        };
        setFileAttachments(prev => [...prev, filePart]);
    }, []);

    const handleFileSelect = React.useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
        const files = e.target.files;
        if (!files) return;
        Array.from(files).forEach(file => {
            if (file.type.startsWith('image/')) {
                handleImageFile(file);
            } else {
                handleRegularFile(file);
            }
        });
        e.target.value = '';
    }, [handleImageFile, handleRegularFile]);

    const handleFileButtonClick = React.useCallback(() => {
        fileInputRef.current?.click();
    }, []);

    const handlePaste = React.useCallback((e: React.ClipboardEvent<HTMLDivElement>) => {
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
            const selection = window.getSelection();
            if (selection && selection.rangeCount > 0) {
                const range = selection.getRangeAt(0);
                range.deleteContents();
                const textNode = document.createTextNode(plainText);
                range.insertNode(textNode);
                range.setStartAfter(textNode);
                range.setEndAfter(textNode);
                selection.removeAllRanges();
                selection.addRange(range);
            }
        }
    }, [handleImageFile]);

    const handleDragOver = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        e.stopPropagation();
        setIsDragging(true);
    }, []);

    const handleDragLeave = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        const container = e.currentTarget as HTMLDivElement;
        if (!container.contains(e.relatedTarget as Node)) {
            setIsDragging(false);
        }
    }, []);

    const handleDrop = React.useCallback((e: React.DragEvent<HTMLDivElement>) => {
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
    }, [handleImageFile, handleRegularFile]);

    const removeImage = React.useCallback((imageId: string) => {
        setImageAttachments(prev => prev.filter(img => img.id !== imageId));
    }, []);

    const removeFile = React.useCallback((filePath: string) => {
        setFileAttachments(prev => prev.filter(f => f.path !== filePath));
    }, []);

    const clearAttachments = React.useCallback(() => {
        setImageAttachments([]);
        setFileAttachments([]);
    }, []);

    return {
        imageAttachments, fileAttachments, isDragging, fileInputRef,
        setImageAttachments, setFileAttachments,
        handleFileSelect, handleFileButtonClick, handlePaste,
        handleDragOver, handleDragLeave, handleDrop,
        removeImage, removeFile, clearAttachments
    };
}
