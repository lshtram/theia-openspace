import * as React from '@theia/core/shared/react';
import * as path from 'path';

export interface ContextItemSelection {
    startLine: number;
    endLine: number;
}

export interface ContextItem {
    key: string;
    type: 'file';
    path: string;
    selection?: ContextItemSelection;
}

export interface PromptContextItemsProps {
    items: ContextItem[];
    onRemove: (key: string) => void;
}

export const PromptContextItems: React.FC<PromptContextItemsProps> = ({ items, onRemove }) => {
    if (items.length === 0) {
        return null;
    }

    return (
        <div className="prompt-context-items">
            {items.map(item => (
                <div key={item.key} className="context-item">
                    <span className="context-item-name">{path.basename(item.path)}</span>
                    {item.selection && (
                        <span className="context-item-range">
                            {item.selection.startLine}–{item.selection.endLine}
                        </span>
                    )}
                    <button
                        className="context-item-remove"
                        onClick={() => onRemove(item.key)}
                        aria-label="Remove"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
};
