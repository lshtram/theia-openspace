/**
 * PromptSessionStore — per-session prompt autosave with 20-entry LRU.
 *
 * Mirrors opencode's PromptContext behaviour: persists the current prompt
 * text when switching sessions and restores it on return.
 */

export interface PromptSnapshot {
    text: string;
}

/**
 * An in-memory LRU store for prompt snapshots, keyed by session ID.
 * Capacity: 20 entries. On restore, the entry is promoted to MRU position.
 */
export class PromptSessionStore {
    private static readonly MAX_SIZE = 20;

    // Insertion-ordered map: oldest entry is the first key
    private readonly cache = new Map<string, PromptSnapshot>();

    /**
     * Save (or overwrite) the prompt snapshot for the given session.
     * When at capacity, the LRU (oldest-accessed) entry is evicted.
     */
    save(sessionId: string, snapshot: PromptSnapshot): void {
        if (this.cache.has(sessionId)) {
            // Delete then re-insert to move to MRU position
            this.cache.delete(sessionId);
        } else if (this.cache.size >= PromptSessionStore.MAX_SIZE) {
            // Evict the LRU entry (first key in insertion order)
            const lruKey = this.cache.keys().next().value;
            if (lruKey !== undefined) {
                this.cache.delete(lruKey);
            }
        }
        this.cache.set(sessionId, snapshot);
    }

    /**
     * Restore the prompt snapshot for the given session.
     * Accessing an entry promotes it to the MRU position (LRU eviction order).
     * Returns undefined if no snapshot exists for the session.
     */
    restore(sessionId: string): PromptSnapshot | undefined {
        const snapshot = this.cache.get(sessionId);
        if (snapshot === undefined) return undefined;

        // Promote to MRU position
        this.cache.delete(sessionId);
        this.cache.set(sessionId, snapshot);
        return snapshot;
    }
}
