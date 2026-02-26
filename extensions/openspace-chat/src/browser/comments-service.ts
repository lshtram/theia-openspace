/**
 * CommentsService — in-memory per-file line comment store.
 *
 * Mirrors opencode's CommentsContext pattern for storing and managing
 * line-level comments on diff views.
 */

export interface LineComment {
    id: string;
    file: string;
    selection: { startLine: number; endLine: number };
    comment: string;
    time: number;
}

/**
 * In-memory service for managing per-file line comments.
 * Pure class, no DI.
 */
export class CommentsService {
    private readonly _comments: Map<string, LineComment[]> = new Map();
    private readonly _listeners: Array<() => void> = [];
    private _idCounter = 0;

    /**
     * Add a line comment. Returns the created comment (with generated id and time).
     */
    add(input: Omit<LineComment, 'id' | 'time'>): LineComment {
        const id = `comment-${++this._idCounter}-${Date.now()}`;
        const comment: LineComment = {
            ...input,
            id,
            time: Date.now(),
        };
        const existing = this._comments.get(input.file) ?? [];
        this._comments.set(input.file, [...existing, comment]);
        this._notifyListeners();
        return comment;
    }

    /**
     * Remove a comment by file and id. Silently ignores unknown file or id.
     */
    remove(file: string, id: string): void {
        const existing = this._comments.get(file);
        if (!existing) return;
        const filtered = existing.filter(c => c.id !== id);
        if (filtered.length !== existing.length) {
            this._comments.set(file, filtered);
            this._notifyListeners();
        }
    }

    /**
     * List all comments for a specific file.
     */
    list(file: string): LineComment[] {
        return this._comments.get(file) ?? [];
    }

    /**
     * Get all comments across all files.
     */
    all(): LineComment[] {
        const result: LineComment[] = [];
        for (const comments of this._comments.values()) {
            result.push(...comments);
        }
        return result;
    }

    /**
     * Register a callback to be called whenever comments change.
     */
    onCommentsChanged(cb: () => void): void {
        this._listeners.push(cb);
    }

    private _notifyListeners(): void {
        for (const cb of this._listeners) {
            cb();
        }
    }
}
