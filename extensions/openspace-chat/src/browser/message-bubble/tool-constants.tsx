/* eslint-disable @typescript-eslint/no-explicit-any */
/********************************************************************************
 * Copyright (C) 2024 OpenSpace contributors.
 *
 * This program and the accompanying materials are made available under the
 * terms of the Eclipse Public License v. 2.0 which is available at
 * http://www.eclipse.org/legal/epl-2.0.
 *
 * This Source Code may also be made available under the following Secondary
 * Licenses when the conditions for such availability set forth in the Eclipse
 * Public License v. 2.0 are satisfied: GNU General Public License, version 2
 * with the GNU Classpath Exception which is available at
 * https://www.gnu.org/software/classpath/license.html.
 *
 * SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
 ********************************************************************************/

import * as React from '@theia/core/shared/react';

// ─── Tool name regexes ──────────────────────────────────────────────────────
export const CONTEXT_TOOL_NAMES = /^(read|glob|grep|list|list_files|search|find|rg|ripgrep)$/i;
export const BASH_TOOL_NAMES = /^(bash|bash_\d+|execute|run_command|run|shell|cmd|terminal)$/i;
export const TASK_TOOL_NAMES = /^(task|Task)$/;
export const READ_TOOL_NAMES = /^(read|Read)$/;
export const SEARCH_TOOL_NAMES = /^(grep|Grep|glob|Glob|rg|ripgrep|search|find|list|list_files|ripgrep_search|ripgrep_advanced-search|ripgrep_count-matches|ripgrep_list-files)$/i;
export const EDIT_WRITE_TOOL_NAMES = /^(edit|Edit|write|Write)$/;
export const WEBFETCH_TOOL_NAMES = /^(webfetch|WebFetch|web_fetch)$/i;
export const TODOWRITE_TOOL_NAMES = /^(todowrite|TodoWrite|todo_write)$/i;
export const EDIT_TOOL_NAMES = /^(edit|Edit)$/;
export const WRITE_TOOL_NAMES = /^(write|Write|write_file)$/;

/** Returns true if the string looks like an absolute file path (no whitespace — excludes shell commands). */
export const isFilePath = (s: string): boolean =>
    (s.startsWith('/') || /^[A-Za-z]:\\/.test(s)) && !/\s/.test(s);

/** Icon React nodes for tool display (avoids dangerouslySetInnerHTML). */
export const ToolIcons: Record<string, React.ReactNode> = {
    console: <><polyline points="4 17 10 11 4 5"/><line x1="12" y1="19" x2="20" y2="19"/></>,
    glasses: <><circle cx="6" cy="15" r="4"/><circle cx="18" cy="15" r="4"/><path d="M14 15a2 2 0 0 0-4 0"/><path d="M2.5 13 5 7c.7-1.3 1.4-2 3-2"/><path d="M21.5 13 19 7c-.7-1.3-1.4-2-3-2"/></>,
    search: <><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></>,
    code: <><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></>,
    task: <><rect width="8" height="4" x="8" y="2" rx="1" ry="1"/><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><path d="m9 14 2 2 4-4"/></>,
    window: <><rect width="18" height="18" x="3" y="3" rx="2"/><path d="M3 9h18"/><path d="M9 21V9"/></>,
    mcp: <><circle cx="12" cy="12" r="3"/><path d="M12 3v6"/><path d="M12 15v6"/><path d="m3 12 6 0"/><path d="m15 12 6 0"/></>,
};

/** Map tool name → display info (icon React node, display name, subtitle extractor). */
export function getToolInfo(part: any): { icon: React.ReactNode; name: string; subtitle: string } {
    const toolName: string = part.tool || 'tool';
    const state = part.state;
    const input = typeof state === 'object' && state !== null && 'input' in state ? state.input : undefined;

    let iconKey = 'mcp';
    let displayName = toolName;
    let subtitle = '';

    if (BASH_TOOL_NAMES.test(toolName)) {
        iconKey = 'console';
        displayName = 'Shell';
        const desc = typeof input === 'object' && input !== null ? (input as any).description : undefined;
        subtitle = desc || (typeof input === 'string' ? input : (typeof input === 'object' && input !== null ? (input as any).command || '' : ''));
    } else if (READ_TOOL_NAMES.test(toolName)) {
        iconKey = 'glasses';
        displayName = 'Read';
        subtitle = typeof input === 'object' && input !== null ? (input as any).filePath || (input as any).path || '' : '';
    } else if (SEARCH_TOOL_NAMES.test(toolName)) {
        iconKey = 'search';
        displayName = toolName.charAt(0).toUpperCase() + toolName.slice(1).replace(/_/g, ' ');
        subtitle = typeof input === 'object' && input !== null ? (input as any).pattern || (input as any).query || '' : '';
    } else if (EDIT_WRITE_TOOL_NAMES.test(toolName)) {
        iconKey = 'code';
        displayName = toolName.charAt(0).toUpperCase() + toolName.slice(1);
        subtitle = typeof input === 'object' && input !== null ? (input as any).filePath || (input as any).path || '' : '';
    } else if (TASK_TOOL_NAMES.test(toolName)) {
        iconKey = 'task';
        const agentType: string = typeof input === 'object' && input !== null ? ((input as any).subagent_type || '') : '';
        const desc: string = typeof input === 'object' && input !== null ? ((input as any).description || '') : '';
        displayName = agentType ? `@${agentType}` : 'Task';
        subtitle = desc;
    } else if (WEBFETCH_TOOL_NAMES.test(toolName)) {
        iconKey = 'window';
        displayName = 'Web Fetch';
        subtitle = typeof input === 'object' && input !== null ? (input as any).url || '' : '';
    } else if (TODOWRITE_TOOL_NAMES.test(toolName)) {
        iconKey = 'task';
        displayName = 'Todo';
    }

    const icon = ToolIcons[iconKey] || ToolIcons.mcp;
    return { icon, name: displayName, subtitle };
}
