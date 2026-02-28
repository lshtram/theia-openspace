/**
 * ModelModeSelector — inline dropdown for the prompt toolbar.
 * Shows the active model mode (e.g. "Default", "Think") and allows switching.
 * Only renders if the current model exposes more than one mode.
 */
import * as React from '@theia/core/shared/react';

const MODE_LABELS: Record<string, string> = {
    default: 'Default',
    think: 'Think',
    thinking: 'Think',
    high: 'High',
    auto: 'Auto',
};

export function modeLabel(mode: string): string {
    return MODE_LABELS[mode.toLowerCase()] ?? (mode.charAt(0).toUpperCase() + mode.slice(1));
}

export interface ModelModeSelectorProps {
    modes: string[];
    selected: string;
    onSelect: (mode: string) => void;
    disabled?: boolean;
}

export const ModelModeSelector: React.FC<ModelModeSelectorProps> = ({ modes, selected, onSelect, disabled }) => {
    const [isOpen, setIsOpen] = React.useState(false);
    const ref = React.useRef<HTMLDivElement>(null);

    React.useEffect(() => {
        if (!isOpen) return;
        const handler = (e: MouseEvent) => {
            if (ref.current && !ref.current.contains(e.target as Node)) setIsOpen(false);
        };
        document.addEventListener('mousedown', handler);
        return () => document.removeEventListener('mousedown', handler);
    }, [isOpen]);

    // Hide if only one mode available
    if (modes.length <= 1) return null;

    return (
        <div className="model-mode-selector" ref={ref}>
            <button
                type="button"
                className="prompt-toolbar-pill"
                onClick={() => !disabled && setIsOpen(o => !o)}
                disabled={disabled}
                title="Select model mode"
                aria-haspopup="listbox"
                aria-expanded={isOpen}
            >
                {modeLabel(selected)}
                <svg className="prompt-toolbar-pill-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
            </button>
            {isOpen && (
                <div className="mode-selector-dropdown prompt-toolbar-dropdown" role="listbox">
                    {modes.map(mode => (
                        <button
                            key={mode}
                            className={`mode-selector-option${selected === mode ? ' active' : ''}`}
                            role="option"
                            aria-selected={selected === mode}
                            onClick={() => { onSelect(mode); setIsOpen(false); }}
                        >
                            {modeLabel(mode)}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
