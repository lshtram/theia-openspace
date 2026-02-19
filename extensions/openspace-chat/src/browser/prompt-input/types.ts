/**
 * Type definitions for multi-part prompt input.
 * 
 * This module defines the data structures used to represent user prompts
 * that can contain text, file references, agent mentions, and images.
 */

/**
 * A prompt is an array of content parts representing a complete user message.
 */
export type Prompt = ContentPart[];

/**
 * A content part is one segment of a prompt.
 * Can be text, a file reference, an agent mention, or an image attachment.
 */
export type ContentPart = TextPart | FilePart | AgentPart | ImagePart;

/**
 * A text segment in the prompt.
 * `start` and `end` track character offsets for history navigation.
 */
export interface TextPart {
    type: 'text';
    content: string;
    start: number;  // Character offset in concatenated text
    end: number;
}

/**
 * A file reference in the prompt.
 * Displays as a pill (e.g., "@src/auth.ts") in the editor.
 */
export interface FilePart {
    type: 'file';
    path: string;          // Workspace-relative or absolute path
    content: string;       // Display text (e.g., "@src/auth.ts")
    start: number;
    end: number;
    selection?: {          // Optional line selection
        startLine: number;
        endLine: number;
    };
}

/**
 * An agent mention in the prompt.
 * Displays as a colored pill (e.g., "@oracle") in the editor.
 */
export interface AgentPart {
    type: 'agent';
    name: string;          // Agent name (e.g., "oracle")
    content: string;       // Display text (e.g., "@oracle")
    start: number;
    end: number;
}

/**
 * An image attachment in the prompt.
 * Images are displayed as thumbnails outside the editor.
 */
export interface ImagePart {
    type: 'image';
    id: string;            // Unique ID (UUID)
    filename: string;      // Original filename
    mime: string;          // MIME type (e.g., "image/png")
    dataUrl: string;       // Base64-encoded data URL
}

/**
 * Message part formats for sending to the opencode server.
 * These match the openspace-core protocol types.
 */
export type MessagePart = TextMessagePart | FileMessagePart | ImageMessagePart;

export interface TextMessagePart {
    readonly type: 'text';
    readonly text: string;
}

export interface FileMessagePart {
    readonly type: 'file';
    readonly path: string;
    readonly content?: string;
}

export interface ImageMessagePart {
    readonly type: 'image';
    readonly path: string;
    readonly mime_type?: string;
}

/**
 * Props for the PromptInput component.
 * T3-9: Added workspaceRoot prop to avoid hardcoded path.
 */
export interface PromptInputProps {
    onSend: (parts: MessagePart[]) => void | Promise<void>;
    onStop?: () => void;
    isStreaming?: boolean;
    disabled?: boolean;
    placeholder?: string;
    workspaceRoot?: string;
}
