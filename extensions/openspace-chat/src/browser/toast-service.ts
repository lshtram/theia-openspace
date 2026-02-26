/**
 * ToastService — lightweight in-memory observable toast stack.
 *
 * Mirrors opencode's NotificationContext pattern for displaying turn-complete,
 * error, and file operation feedback as transient toast notifications.
 */

export interface Toast {
    id: string;
    type: 'info' | 'success' | 'error' | 'warning';
    message: string;
    ttl?: number;
}

/**
 * A simple in-memory service for managing toast notifications.
 * Pure class, no DI — can be instantiated and used anywhere.
 */
export class ToastService {
    private _toasts: Toast[] = [];
    private readonly _listeners: Array<() => void> = [];
    private _idCounter = 0;

    get toasts(): Toast[] {
        return this._toasts;
    }

    /**
     * Show a new toast notification. Automatically assigns a unique ID.
     */
    show(toast: Omit<Toast, 'id'>): void {
        const id = `toast-${++this._idCounter}-${Date.now()}`;
        this._toasts = [...this._toasts, { ...toast, id }];
        this._notifyListeners();
    }

    /**
     * Dismiss a toast by ID. Silently ignores unknown IDs.
     */
    dismiss(id: string): void {
        const before = this._toasts.length;
        this._toasts = this._toasts.filter(t => t.id !== id);
        if (this._toasts.length !== before) {
            this._notifyListeners();
        }
    }

    /**
     * Register a callback to be called whenever the toast list changes.
     */
    onToastsChanged(cb: () => void): void {
        this._listeners.push(cb);
    }

    private _notifyListeners(): void {
        for (const cb of this._listeners) {
            cb();
        }
    }
}
