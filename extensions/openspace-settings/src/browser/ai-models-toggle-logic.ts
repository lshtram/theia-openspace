// extensions/openspace-settings/src/browser/ai-models-toggle-logic.ts
//
// Pure utility functions for the AI models toggle logic.
// The core semantic: empty array = all models enabled (canonical default).

/**
 * Resolve the effective set of enabled model IDs.
 * An empty `enabled` array means *all* models are enabled.
 */
export function resolveEffectiveEnabled(enabled: string[], allModelIds: string[]): Set<string> {
    return enabled.length === 0 ? new Set(allModelIds) : new Set(enabled);
}

/**
 * Canonicalize an enabled list: if every model is enabled, return [] (the canonical default).
 */
export function canonicalize(enabled: string[], allModelIds: string[]): string[] {
    return enabled.length === allModelIds.length ? [] : enabled;
}

/**
 * Toggle a single model on or off.
 * Returns a canonicalized list (empty = all).
 */
export function toggleModel(fullId: string, enabled: string[], allModelIds: string[]): string[] {
    const current = enabled.length === 0 ? [...allModelIds] : [...enabled];
    const next = current.includes(fullId)
        ? current.filter(id => id !== fullId)
        : [...current, fullId];
    return canonicalize(next, allModelIds);
}

/**
 * Enable or disable all models.
 * `on: true`  → [] (canonical all-enabled)
 * `on: false` → [] (empty list, which means nothing enabled — stored as empty but distinct semantically)
 *
 * Note: the actual "disable all" is stored as an empty array too, but the component
 * passes `on: false` → save([]) which the UI re-reads as "none" because providers are
 * known to be present. For our purposes the UI uses `on` to differentiate.
 */
export function toggleAll(on: boolean): string[] {
    return on ? [] : [];
}

/**
 * Toggle all models for a given provider.
 */
export function toggleProvider(
    providerId: string,
    on: boolean,
    enabled: string[],
    allModelIds: string[],
    providerModelIds: string[]
): string[] {
    const base = enabled.length === 0 ? [...allModelIds] : [...enabled];
    let next: string[];
    if (on) {
        next = [...new Set([...base, ...providerModelIds])];
    } else {
        next = base.filter(id => !providerModelIds.includes(id));
    }
    return canonicalize(next, allModelIds);
}
