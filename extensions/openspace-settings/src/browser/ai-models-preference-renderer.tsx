// extensions/openspace-settings/src/browser/ai-models-preference-renderer.tsx

import * as React from '@theia/core/shared/react';
import { createRoot, Root } from '@theia/core/shared/react-dom/client';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { interfaces } from '@theia/core/shared/inversify';
import { PreferenceService, PreferenceScope } from '@theia/core/lib/common/preferences';
import { PreferenceNodeRenderer } from '@theia/preferences/lib/browser/views/components/preference-node-renderer';
import {
    PreferenceNodeRendererContribution,
    PreferenceNodeRendererCreatorRegistry,
    PreferenceNodeRendererCreator,
} from '@theia/preferences/lib/browser/views/components/preference-node-renderer-creator';
import { Preference } from '@theia/preferences/lib/browser/util/preference-types';
import { SessionService } from 'openspace-core/lib/browser/session-service';
import { ProviderWithModels } from 'openspace-core/lib/common/opencode-protocol';
import { OpenspacePreferences } from './openspace-preferences';

// ─── React Component ──────────────────────────────────────────────────────────

interface AiModelsManagerProps {
    preferenceService: PreferenceService;
    sessionService: SessionService;
}

const AiModelsManager: React.FC<AiModelsManagerProps> = ({ preferenceService, sessionService }) => {
    const [providers, setProviders] = React.useState<ProviderWithModels[]>([]);
    const [enabled, setEnabled] = React.useState<string[]>([]);
    const [loading, setLoading] = React.useState(true);
    const [error, setError] = React.useState<string | undefined>();

    // Load providers from server
    React.useEffect(() => {
        setLoading(true);
        sessionService.getAvailableModels()
            .then(setProviders)
            .catch(e => setError(e instanceof Error ? e.message : 'Failed to load models'))
            .finally(() => setLoading(false));
    }, [sessionService]);

    // Read current preference value
    React.useEffect(() => {
        const current = preferenceService.get<string[]>(OpenspacePreferences.MODELS_ENABLED, []);
        setEnabled(current ?? []);
        const disposable = preferenceService.onPreferenceChanged(change => {
            if (change.preferenceName === OpenspacePreferences.MODELS_ENABLED) {
                // PreferenceChange omits newValue — re-read from service
                const updated = preferenceService.get<string[]>(OpenspacePreferences.MODELS_ENABLED, []);
                setEnabled(updated ?? []);
            }
        });
        return () => disposable.dispose();
    }, [preferenceService]);

    const save = (newEnabled: string[]) => {
        preferenceService.set(OpenspacePreferences.MODELS_ENABLED, newEnabled, PreferenceScope.User);
        setEnabled(newEnabled);
    };

    // Derive all model fullIds
    const allModelIds = React.useMemo(() =>
        providers.flatMap(p => Object.keys(p.models).map(mId => `${p.id}/${mId}`)),
        [providers]
    );

    // Effective enabled set: empty = all enabled
    const effectiveEnabled = React.useMemo(() =>
        enabled.length === 0 ? new Set(allModelIds) : new Set(enabled),
        [enabled, allModelIds]
    );

    const isAllEnabled = enabled.length === 0 || enabled.length === allModelIds.length;

    const toggleModel = (fullId: string) => {
        const current = enabled.length === 0 ? allModelIds : [...enabled];
        const next = current.includes(fullId)
            ? current.filter(id => id !== fullId)
            : [...current, fullId];
        // If all are enabled, store as empty (canonical default)
        save(next.length === allModelIds.length ? [] : next);
    };

    const toggleAll = (on: boolean) => save(on ? [] : []);

    const toggleProvider = (providerId: string, on: boolean) => {
        const providerModelIds = Object.keys(
            providers.find(p => p.id === providerId)?.models ?? {}
        ).map(mId => `${providerId}/${mId}`);
        const base = enabled.length === 0 ? allModelIds : [...enabled];
        let next: string[];
        if (on) {
            next = [...new Set([...base, ...providerModelIds])];
        } else {
            next = base.filter(id => !providerModelIds.includes(id));
        }
        save(next.length === allModelIds.length ? [] : next);
    };

    if (loading) {
        return <div className="ai-models-manager ai-models-loading">Loading models...</div>;
    }
    if (error) {
        return <div className="ai-models-manager ai-models-error">{error}</div>;
    }

    return (
        <div className="ai-models-manager">
            <div className="ai-models-global-controls">
                <button
                    className={`ai-models-bulk-btn ${isAllEnabled ? 'active' : ''}`}
                    onClick={() => toggleAll(true)}
                    title="Enable all models"
                >All</button>
                <button
                    className="ai-models-bulk-btn"
                    onClick={() => toggleAll(false)}
                    title="Disable all models"
                >None</button>
            </div>

            {providers.map(provider => {
                const providerModelIds = Object.keys(provider.models).map(mId => `${provider.id}/${mId}`);
                const providerEnabledCount = providerModelIds.filter(id => effectiveEnabled.has(id)).length;

                return (
                    <div key={provider.id} className="ai-models-provider-group">
                        <div className="ai-models-provider-header">
                            <span className="ai-models-provider-name">{provider.name}</span>
                            <span className="ai-models-provider-count">
                                {providerEnabledCount}/{providerModelIds.length}
                            </span>
                            <button
                                className="ai-models-bulk-btn ai-models-provider-all"
                                onClick={() => toggleProvider(provider.id, true)}
                            >All</button>
                            <button
                                className="ai-models-bulk-btn ai-models-provider-none"
                                onClick={() => toggleProvider(provider.id, false)}
                            >None</button>
                        </div>
                        {Object.entries(provider.models).map(([modelId, model]) => {
                            const fullId = `${provider.id}/${modelId}`;
                            const isEnabled = effectiveEnabled.has(fullId);
                            return (
                                <div
                                    key={fullId}
                                    className={`ai-models-row ${isEnabled ? 'enabled' : 'disabled'}`}
                                >
                                    <label className="ai-models-toggle-label">
                                        <input
                                            type="checkbox"
                                            checked={isEnabled}
                                            onChange={() => toggleModel(fullId)}
                                            className="ai-models-checkbox"
                                        />
                                        <span className="ai-models-model-name">{model.name}</span>
                                        <span className="ai-models-model-id">{fullId}</span>
                                    </label>
                                </div>
                            );
                        })}
                    </div>
                );
            })}
        </div>
    );
};

// ─── Renderer (Theia DOM integration) ────────────────────────────────────────

@injectable()
export class AiModelsPreferenceRenderer extends PreferenceNodeRenderer {
    @inject(PreferenceService)
    protected readonly preferenceService!: PreferenceService;

    @inject(SessionService)
    protected readonly sessionService!: SessionService;

    private _root: Root | undefined;

    @postConstruct()
    protected override init(): void {
        super.init();
        this.mountReact();
    }

    protected createDomNode(): HTMLElement {
        const el = document.createElement('li');
        el.classList.add('single-pref', 'ai-models-preference-root');
        el.id = 'openspace.models.enabled-editor';
        return el;
    }

    private mountReact(): void {
        this._root = createRoot(this.domNode);
        this._root.render(
            <AiModelsManager
                preferenceService={this.preferenceService}
                sessionService={this.sessionService}
            />
        );
    }

    override dispose(): void {
        this._root?.unmount();
        this._root = undefined;
        super.dispose();
    }
}

// ─── Contribution ─────────────────────────────────────────────────────────────

const AI_MODELS_PREFERENCE_RENDERER_CREATOR_ID = 'openspace-ai-models-renderer';

@injectable()
export class AiModelsPreferenceRendererContribution implements PreferenceNodeRendererContribution {

    registerPreferenceNodeRendererCreator(registry: PreferenceNodeRendererCreatorRegistry): void {
        const creator: PreferenceNodeRendererCreator = {
            id: AI_MODELS_PREFERENCE_RENDERER_CREATOR_ID,
            canHandle: (node: Preference.TreeNode) => {
                // Only intercept the leaf node for our specific preference
                // LeafNode.preferenceId contains the raw preference key
                if (Preference.LeafNode.is(node) && node.preferenceId === OpenspacePreferences.MODELS_ENABLED) {
                    return 1000; // High priority to override default array renderer
                }
                return -1;
            },
            createRenderer: (node: Preference.TreeNode, container: interfaces.Container) => {
                const child = container.createChild();
                child.bind(Preference.Node).toConstantValue(node as Preference.LeafNode);
                child.bind(AiModelsPreferenceRenderer).toSelf();
                return child.get(AiModelsPreferenceRenderer);
            },
        };
        registry.registerPreferenceNodeRendererCreator(creator);
    }
}
