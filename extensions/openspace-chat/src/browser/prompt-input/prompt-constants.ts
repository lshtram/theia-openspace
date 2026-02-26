/**
 * Shared constants, types, and utility functions for the prompt-input module.
 *
 * Extracted from the prompt-input monolith during god-object decomposition (Phase 4c).
 */

// Simple unique ID generator
export const generateId = (): string => crypto.randomUUID();

/**
 * Structured history entry — stores both plain text (for dedup) and innerHTML
 * (for pill restoration). (B07)
 */
export interface HistoryEntry {
    text: string;   // plain text content (for dedup comparison)
    html: string;   // innerHTML snapshot (for full restoration with pills)
}

// Maximum number of prompt history entries to keep
export const MAX_HISTORY = 100;

// Available agents (hardcoded for now — could come from configuration)
export const AVAILABLE_AGENTS = [
    { name: 'oracle', description: 'System architect and requirements analyst' },
    { name: 'builder', description: 'Code implementation specialist' },
    { name: 'analyst', description: 'Requirements discovery and investigation' },
    { name: 'janitor', description: 'QA and validation' },
];

// Builtin slash commands (handled client-side, always shown first)
export const BUILTIN_SLASH_COMMANDS: Array<{ name: string; description: string; local: true }> = [
    { name: '/clear', description: 'Clear the current session messages', local: true },
    { name: '/compact', description: 'Compact conversation to save context', local: true },
    { name: '/help', description: 'Show available commands', local: true },
];

/**
 * Case-insensitive substring match. Used consistently throughout the UI for
 * all typeahead/search filtering (agents, slash commands, model selector).
 * Prefer this over hand-rolled fuzzy matching — see CODING_STANDARDS.md.
 */
export const matchesQuery = (query: string, target: string): boolean =>
    target.toLowerCase().includes(query.toLowerCase());
