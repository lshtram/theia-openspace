import * as React from '@theia/core/shared/react';

export interface Toast {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    message: string;
}

export interface ToastStackProps {
    toasts: Toast[];
    onDismiss?: (id: string) => void;
}

export const ToastStack: React.FC<ToastStackProps> = ({ toasts, onDismiss }) => {
    if (toasts.length === 0) {
        return null;
    }

    return (
        <div className="toast-stack">
            {toasts.map(toast => (
                <div key={toast.id} className={`toast toast--${toast.type}`}>
                    <span className="toast-message">{toast.message}</span>
                    <button
                        className="toast-dismiss"
                        onClick={() => onDismiss?.(toast.id)}
                        aria-label="Dismiss"
                    >
                        ×
                    </button>
                </div>
            ))}
        </div>
    );
};
