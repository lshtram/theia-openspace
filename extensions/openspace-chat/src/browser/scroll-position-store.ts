/**
 * ScrollPositionStore — per-session scroll position persistence with 50-entry LRU.
 *
 * Mirrors opencode's SessionView.scroll behaviour: saves scrollTop on scroll
 * (debounced) and restores it when returning to a session.
 */

/**
 * An in-memory LRU store for scroll positions, keyed by session ID.
 * Capacity: 50 entries.
 */
export class ScrollPositionStore {
    private static readonly MAX_SIZE = 50;

    // Insertion-ordered map: oldest entry is the first key
    private readonly cache = new Map<string, number>();

    /**
     * Save (or overwrite) the scroll position for the given session.
     * When at capacity, the LRU (oldest) entry is evicted.
     */
    save(sessionId: string, scrollTop: number): void {
        if (this.cache.has(sessionId)) {
            this.cache.delete(sessionId);
        } else if (this.cache.size >= ScrollPositionStore.MAX_SIZE) {
            const lruKey = this.cache.keys().next().value;
            if (lruKey !== undefined) {
                this.cache.delete(lruKey);
            }
        }
        this.cache.set(sessionId, scrollTop);
    }

    /**
     * Get the scroll position for the given session.
     * Returns undefined if no position has been saved.
     */
    get(sessionId: string): number | undefined {
        return this.cache.get(sessionId);
    }
}
