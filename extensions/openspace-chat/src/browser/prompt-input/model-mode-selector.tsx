/**
 * ModelModeSelector — inline dropdown for the prompt toolbar.
 * Shows the active model mode (e.g. "Default", "Think") and allows switching.
 * Always renders with at least "Default" mode. Shows dropdown only when >1 modes.
 * Renders dropdown via a portal at document.body to escape overflow clipping.
 */
import * as React from '@theia/core/shared/react';
import * as ReactDOM from '@theia/core/shared/react-dom';

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
    const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});
    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Hide only if no modes at all
    if (modes.length === 0) return null;

    // If only one mode, render as a non-interactive badge (no dropdown)
    const hasMultiple = modes.length > 1;

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

    const dropdown = isOpen && hasMultiple ? (
        <div ref={dropdownRef} className="mode-selector-portal-dropdown" style={dropdownStyle} role="listbox">
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
    ) : null;

    return (
        <div className="model-mode-selector">
            <button
                ref={triggerRef}
                type="button"
                className="prompt-toolbar-pill"
                onClick={() => hasMultiple && !disabled && (isOpen ? setIsOpen(false) : openDropdown())}
                disabled={disabled || !hasMultiple}
                title={hasMultiple ? 'Select model mode' : 'Model mode'}
                aria-haspopup={hasMultiple ? 'listbox' : undefined}
                aria-expanded={hasMultiple ? isOpen : undefined}
            >
                {modeLabel(selected)}
                {hasMultiple && (
                    <svg className="prompt-toolbar-pill-chevron" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" width="10" height="10"><polyline points="6 9 12 15 18 9"/></svg>
                )}
            </button>
            {ReactDOM.createPortal(dropdown, document.body)}
        </div>
    );
};
