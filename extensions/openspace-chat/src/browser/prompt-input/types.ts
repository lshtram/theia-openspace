/**
 * Type definitions for multi-part prompt input.
 * 
 * This module defines the data structures used to represent user prompts
 * that can contain text, file references, agent mentions, and images.
 */

import type { OpenCodeService } from 'openspace-core/lib/common/opencode-protocol';

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
 * These match the openspace-core protocol types (SDK FilePartInput / AgentPartInput).
 */
export type MessagePart = TextMessagePart | FileMessagePart | AgentMessagePart;

export interface TextMessagePart {
    readonly type: 'text';
    readonly text: string;
}

export interface FileMessagePart {
    readonly type: 'file';
    /** MIME type, e.g. "text/plain" or "image/png" */
    readonly mime: string;
    /** file:// URL or data: URL for images */
    readonly url: string;
    /** Optional display filename */
    readonly filename?: string;
}

export interface AgentMessagePart {
    readonly type: 'agent';
    readonly name: string;
}

/**
 * Props for the PromptInput component.
 * T3-9: Added workspaceRoot prop to avoid hardcoded path.
 * B03: Added openCodeService to fetch server slash commands.
 * B04/B05: Added sessionId for file search.
 */
export interface PromptInputProps {
    onSend: (parts: MessagePart[]) => void | Promise<void>;
    /** Called when a server-side slash command is submitted (routed to POST /session/:id/command). */
    onCommand?: (command: string, args: string, agent?: string) => void | Promise<void>;
    /** Called when a builtin slash command is selected (e.g., 'clear', 'compact', 'help'). */
    onBuiltinCommand?: (command: string) => void;
    /** Called when a shell command is submitted via ! shell mode. */
    onShellCommand?: (command: string) => void | Promise<void>;
    onStop?: () => void;
    isStreaming?: boolean;
    disabled?: boolean;
    placeholder?: string;
    workspaceRoot?: string;
    openCodeService?: OpenCodeService;
    /** Active session ID for file search via @mention */
    sessionId?: string;
}
