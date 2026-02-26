/**
 * Custom hooks for typeahead (@ mentions, file search) and slash command menu.
 *
 * Extracted from the prompt-input monolith during god-object decomposition (Phase 4c).
 */

import * as React from '@theia/core/shared/react';
import type { CommandInfo, AgentInfo } from 'openspace-core/lib/common/opencode-protocol';
import { AVAILABLE_AGENTS, BUILTIN_SLASH_COMMANDS, matchesQuery } from './prompt-constants';

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TypeaheadItem {
    type: 'agent' | 'file';
    name: string;
    description?: string;
}

interface SlashCommand {
    name: string;
    description: string;
    local?: boolean;
    agent?: string;
}

// ─── useTypeahead ─────────────────────────────────────────────────────────────

export interface TypeaheadState {
    showTypeahead: boolean;
    typeaheadQuery: string;
    selectedTypeaheadIndex: number;
    typeaheadItems: TypeaheadItem[];
    typeaheadResolved: boolean;
    setShowTypeahead: React.Dispatch<React.SetStateAction<boolean>>;
    setTypeaheadQuery: React.Dispatch<React.SetStateAction<string>>;
    setTypeaheadType: React.Dispatch<React.SetStateAction<'agent' | 'file' | null>>;
    setSelectedTypeaheadIndex: React.Dispatch<React.SetStateAction<number>>;
    /** Insert a typeahead item (pill) into the contenteditable editor at the cursor. */
    insertTypeaheadItem: (item: TypeaheadItem, editorRef: React.RefObject<HTMLDivElement | null>) => void;
}

export function useTypeahead(
    openCodeService: { searchFiles?: (sessionId: string, query: string) => Promise<string[]>; listAgents?: () => Promise<AgentInfo[]> } | undefined,
    sessionId: string | undefined
): TypeaheadState {
    const [showTypeahead, setShowTypeahead] = React.useState(false);
    const [typeaheadQuery, setTypeaheadQuery] = React.useState('');
    const [selectedTypeaheadIndex, setSelectedTypeaheadIndex] = React.useState(0);
    const [typeaheadType, setTypeaheadType] = React.useState<'agent' | 'file' | null>(null);
    const [typeaheadItems, setTypeaheadItems] = React.useState<TypeaheadItem[]>([]);
    const [typeaheadResolved, setTypeaheadResolved] = React.useState(false);

    // B04/B05: Server agents fetched from GET /agent
    const [serverAgents, setServerAgents] = React.useState<AgentInfo[]>([]);

    React.useEffect(() => {
        let cancelled = false;
        openCodeService?.listAgents?.()
            .then(agents => { if (!cancelled) setServerAgents(agents); })
            .catch(() => { /* use hardcoded fallback */ });
        return () => { cancelled = true; };
    }, [openCodeService]);

    // Typeahead item computation (agent + file search)
    React.useEffect(() => {
        if (!typeaheadType) {
            setTypeaheadItems([]);
            setTypeaheadResolved(false);
            return;
        }

        const agentSource = serverAgents.length > 0 ? serverAgents : AVAILABLE_AGENTS;
        const matchedAgents = agentSource
            .filter(agent => matchesQuery(typeaheadQuery, agent.name))
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
            setTypeaheadResolved(true);
            return;
        }

        // Debounce file search by 250ms to avoid a request per keystroke
        let cancelled = false;
        const debounceTimer = setTimeout(() => {
            openCodeService!.searchFiles!(sessionId, typeaheadQuery)
                .then(files => {
                    if (cancelled) return;
                    const fileItems = files.map(f => ({ type: 'file' as const, name: f }));
                    setTypeaheadItems([...matchedAgents, ...fileItems]);
                    setTypeaheadResolved(true);
                })
                .catch(() => {
                    if (!cancelled) setTypeaheadResolved(true);
                });
        }, 250);

        return () => {
            cancelled = true;
            clearTimeout(debounceTimer);
        };
    }, [typeaheadType, typeaheadQuery, serverAgents, sessionId, openCodeService]);

    const insertTypeaheadItem = React.useCallback((item: TypeaheadItem, editorRef: React.RefObject<HTMLDivElement | null>) => {
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
                const afterCursor = text.slice(cursorPosition);
                const beforeAt = text.slice(0, atIndex);

                const pill = document.createElement('span');
                pill.className = `prompt-pill prompt-pill-${item.type}`;
                pill.contentEditable = 'false';
                pill.textContent = item.type === 'agent' ? `@${item.name}` : item.name;
                pill.dataset.type = item.type;

                if (item.type === 'file') {
                    pill.dataset.path = item.name;
                } else {
                    pill.dataset.name = item.name;
                }

                const prefixText = beforeAt.length > 0 ? beforeAt + ' ' : '\u200B';
                const newText = document.createTextNode(prefixText);
                const spaceAfter = document.createTextNode(' ' + afterCursor);

                const parent = textNode.parentNode;
                if (parent) {
                    parent.replaceChild(spaceAfter, textNode);
                    parent.insertBefore(pill, spaceAfter);
                    parent.insertBefore(newText, pill);

                    const newRange = document.createRange();
                    newRange.setStart(spaceAfter, 1);
                    newRange.collapse(true);
                    selection.removeAllRanges();
                    selection.addRange(newRange);
                }
            }
        }

        setShowTypeahead(false);
    }, []);

    return {
        showTypeahead, typeaheadQuery, selectedTypeaheadIndex, typeaheadItems, typeaheadResolved,
        setShowTypeahead, setTypeaheadQuery, setTypeaheadType, setSelectedTypeaheadIndex,
        insertTypeaheadItem
    };
}

// ─── useSlashMenu ─────────────────────────────────────────────────────────────

export interface SlashMenuState {
    showSlashMenu: boolean;
    slashQuery: string;
    selectedSlashIndex: number;
    allSlashCommands: SlashCommand[];
    filteredSlashCommands: SlashCommand[];
    setShowSlashMenu: React.Dispatch<React.SetStateAction<boolean>>;
    setSlashQuery: React.Dispatch<React.SetStateAction<string>>;
    setSelectedSlashIndex: React.Dispatch<React.SetStateAction<number>>;
    /** Select a slash command from the popover (B03). */
    selectSlashCommand: (
        cmd: SlashCommand,
        editorRef: React.RefObject<HTMLDivElement | null>,
        setHasContent: React.Dispatch<React.SetStateAction<boolean>>,
        onBuiltinCommand?: (name: string) => void
    ) => void;
}

export function useSlashMenu(
    openCodeService: { listCommands?: () => Promise<CommandInfo[]> } | undefined
): SlashMenuState {
    const [showSlashMenu, setShowSlashMenu] = React.useState(false);
    const [slashQuery, setSlashQuery] = React.useState('');
    const [selectedSlashIndex, setSelectedSlashIndex] = React.useState(0);

    // B03: Server-side slash commands fetched from GET /command
    const [serverCommands, setServerCommands] = React.useState<CommandInfo[]>([]);

    React.useEffect(() => {
        let cancelled = false;
        openCodeService?.listCommands?.()
            .then(cmds => { if (!cancelled) setServerCommands(cmds); })
            .catch(() => { /* use builtin fallback only */ });
        return () => { cancelled = true; };
    }, [openCodeService]);

    const allSlashCommands = React.useMemo<SlashCommand[]>(() => [
        ...BUILTIN_SLASH_COMMANDS,
        ...serverCommands.map(c => ({ name: `/${c.name}`, description: c.description || '', local: false as const, agent: c.agent }))
    ], [serverCommands]);

    const filteredSlashCommands = React.useMemo(
        () => allSlashCommands.filter(c => matchesQuery(slashQuery, c.name)),
        [allSlashCommands, slashQuery]
    );

    const selectSlashCommand = React.useCallback((
        cmd: SlashCommand,
        editorRef: React.RefObject<HTMLDivElement | null>,
        setHasContent: React.Dispatch<React.SetStateAction<boolean>>,
        onBuiltinCommand?: (name: string) => void
    ) => {
        setShowSlashMenu(false);

        if (cmd.local) {
            if (editorRef.current) {
                editorRef.current.textContent = '';
            }
            setHasContent(false);
            const commandName = cmd.name.startsWith('/') ? cmd.name.slice(1) : cmd.name;
            onBuiltinCommand?.(commandName);
        } else {
            const trigger = cmd.name.startsWith('/') ? cmd.name : `/${cmd.name}`;
            const text = `${trigger} `;
            if (editorRef.current) {
                editorRef.current.textContent = text;
                const range = document.createRange();
                const sel = window.getSelection();
                range.selectNodeContents(editorRef.current);
                range.collapse(false);
                sel?.removeAllRanges();
                sel?.addRange(range);
            }
            setHasContent(true);
        }
    }, []);

    return {
        showSlashMenu, slashQuery, selectedSlashIndex,
        allSlashCommands, filteredSlashCommands,
        setShowSlashMenu, setSlashQuery, setSelectedSlashIndex,
        selectSlashCommand
    };
}
