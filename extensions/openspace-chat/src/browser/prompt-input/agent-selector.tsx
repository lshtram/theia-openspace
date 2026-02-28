/**
 * AgentSelector — inline dropdown for the prompt toolbar.
 * Displays the active agent (e.g. "Build") and allows switching.
 */
import * as React from '@theia/core/shared/react';
import type { AgentInfo } from 'openspace-core/lib/common/opencode-protocol';

export interface AgentSelectorProps {
    agents: AgentInfo[];
    selectedAgent: AgentInfo | null;
    onSelect: (agent: AgentInfo | null) => void;
    disabled?: boolean;
}

export const AgentSelector: React.FC<AgentSelectorProps> = ({ agents, selectedAgent, onSelect, disabled }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    // Close on outside click
    React.useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    const label = selectedAgent?.name ?? 'Default';

    return (
        <div className="agent-selector" ref={ref}>
            <button
                type="button"
                className="prompt-toolbar-pill"
                onClick={() => !disabled && setIsOpen(o => !o)}
                disabled={disabled}
                aria-haspopup="listbox"
                aria-expanded={isOpen}
                title="Select agent"
            >
                {label}
                <svg className="prompt-toolbar-pill-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {isOpen && (
                <div className="agent-selector-dropdown prompt-toolbar-dropdown" role="listbox">
                    <button
                        className={`agent-selector-option${!selectedAgent ? ' active' : ''}`}
                        role="option"
                        aria-selected={!selectedAgent}
                        onClick={() => { onSelect(null); setIsOpen(false); }}
                    >
                        <span className="agent-option-name">Default</span>
                        <span className="agent-option-desc">Use session default</span>
                    </button>
                    {agents.map(agent => (
                        <button
                            key={agent.name}
                            className={`agent-selector-option${selectedAgent?.name === agent.name ? ' active' : ''}`}
                            role="option"
                            aria-selected={selectedAgent?.name === agent.name}
                            onClick={() => { onSelect(agent); setIsOpen(false); }}
                        >
                            <span className="agent-option-name">{agent.name}</span>
                            {agent.description && <span className="agent-option-desc">{agent.description}</span>}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
