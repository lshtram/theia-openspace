/**
 * AgentSelector — inline dropdown for the prompt toolbar.
 * Displays the active agent (e.g. "Build") and allows switching.
 * Renders dropdown via a portal at document.body to escape overflow clipping.
 */
import * as React from '@theia/core/shared/react';
import * as ReactDOM from '@theia/core/shared/react-dom';
import type { AgentInfo } from 'openspace-core/lib/common/opencode-protocol';

export interface AgentSelectorProps {
    agents: AgentInfo[];
    selectedAgent: AgentInfo | null;
    onSelect: (agent: AgentInfo | null) => void;
    disabled?: boolean;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({ agents, selectedAgent, onSelect, disabled }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Filter out sub-agents (mode === 'subagent' or hidden)
    const topLevelAgents = React.useMemo(
        () => agents.filter(a => (a as unknown as { mode?: string }).mode !== 'subagent'),
        [agents]
    );

    // Position dropdown above the trigger using fixed coordinates
    const openDropdown = React.useCallback(() => {
        if (!triggerRef.current) return;
        const rect = triggerRef.current.getBoundingClientRect();
        setDropdownStyle({
            position: 'fixed',
            bottom: window.innerHeight - rect.top + 4,
            left: rect.left,
            zIndex: 9999,
        });
        setIsOpen(true);
    }, []);

    // Close on outside click
    React.useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            const target = e.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const label = selectedAgent?.name ?? 'Default';

    const dropdown = isOpen ? (
        <div ref={dropdownRef} className="agent-selector-portal-dropdown" style={dropdownStyle} role="listbox">
            <button
                className={`agent-selector-option${!selectedAgent ? ' active' : ''}`}
                role="option"
                aria-selected={!selectedAgent}
                onClick={() => { onSelect(null); setIsOpen(false); }}
            >
                Default
            </button>
            {topLevelAgents.map(agent => (
                <button
                    key={agent.name}
                    className={`agent-selector-option${selectedAgent?.name === agent.name ? ' active' : ''}`}
                    role="option"
                    aria-selected={selectedAgent?.name === agent.name}
                    onClick={() => { onSelect(agent); setIsOpen(false); }}
                >
                    {agent.name}
                </button>
            ))}
        </div>
    ) : null;

    return (
        <div className="agent-selector">
            <button
                ref={triggerRef}
                type="button"
                className="prompt-toolbar-pill"
                onClick={() => !disabled && (isOpen ? setIsOpen(false) : openDropdown())}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                title="Select agent"
            >
                {label}
                <svg className="prompt-toolbar-pill-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {ReactDOM.createPortal(dropdown, document.body)}
        </div>
    );
};
