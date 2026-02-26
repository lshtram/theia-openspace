/**
 * ScrollSpyController — pure logic for tracking the visible message during scroll.
 *
 * Maintains an insertion-ordered registry of message elements and IDs.
 * Provides navigateByOffset() for keyboard-driven message navigation.
 * Fires onNavigate callbacks when navigation occurs.
 *
 * IntersectionObserver integration is handled externally (in MessageTimeline);
 * this class only manages the state and navigation logic.
 */

export class ScrollSpyController {
    private readonly _registry: Array<{ el: Element; id: string }> = [];
    private _visibleMessageId: string | undefined = undefined;
    private readonly _navigateListeners: Array<(id: string) => void> = [];

    get visibleMessageId(): string | undefined {
        return this._visibleMessageId;
    }

    get registeredCount(): number {
        return this._registry.length;
    }

    /**
     * Register a message element with its ID for scroll-spy tracking.
     */
    register(el: Element, id: string): void {
        // Avoid duplicates
        if (!this._registry.find(r => r.id === id)) {
            this._registry.push({ el, id });
        }
    }

    /**
     * Unregister a message by its ID.
     */
    unregister(id: string): void {
        const idx = this._registry.findIndex(r => r.id === id);
        if (idx !== -1) {
            this._registry.splice(idx, 1);
        }
    }

    /**
     * Mark a message as visible (called by IntersectionObserver).
     */
    setVisible(id: string): void {
        this._visibleMessageId = id;
    }

    /**
     * Navigate by offset (+1 = next, -1 = previous).
     * Clamps at the bounds (no wrapping).
     * Fires onNavigate callbacks and returns the target message ID.
     */
    navigateByOffset(offset: number): string {
        if (this._registry.length === 0) {
            return this._visibleMessageId ?? '';
        }

        const currentIndex = this._visibleMessageId
            ? this._registry.findIndex(r => r.id === this._visibleMessageId)
            : -1;

        const baseIndex = currentIndex === -1 ? 0 : currentIndex;
        const targetIndex = Math.max(0, Math.min(this._registry.length - 1, baseIndex + offset));
        const targetId = this._registry[targetIndex].id;

        this._visibleMessageId = targetId;
        for (const cb of this._navigateListeners) {
            cb(targetId);
        }
        return targetId;
    }

    /**
     * Register a callback fired when navigation occurs.
     */
    onNavigate(cb: (id: string) => void): void {
        this._navigateListeners.push(cb);
    }
}
