# Manage Models Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add an "AI Models" section to Theia Preferences with per-model on/off toggles, and a "Manage Models" footer button in the chat model selector dropdown.

**Architecture:** Store enabled model IDs as a `string[]` preference (`openspace.models.enabled`; empty = all enabled). Register a custom `PreferenceNodeRenderer` contribution that mounts a React toggle tree into the preference editor. `ModelSelector` reads the preference to filter its list and gains a "Manage Models" footer button that opens Preferences with the search term "AI Models".

**Tech Stack:** TypeScript, React (Theia shared), Inversify DI, Theia PreferenceService, Theia `PreferenceNodeRendererContribution`, `CommonCommands.OPEN_PREFERENCES`

---

## Task 1: Add `openspace.models.enabled` preference

**Files:**
- Modify: `extensions/openspace-settings/src/browser/openspace-preferences.ts`
- Test: `extensions/openspace-settings/src/browser/__tests__/openspace-preferences.spec.ts`

**Step 1: Write the failing test**

Add to `openspace-preferences.spec.ts`:

```typescript
it('should export MODELS_ENABLED key', () => {
    expect(OpenspacePreferences.MODELS_ENABLED).to.equal('openspace.models.enabled');
});

it('should have correct default for models enabled (empty array)', () => {
    expect(OpenspacePreferenceDefaults[OpenspacePreferences.MODELS_ENABLED]).to.deep.equal([]);
});
```

**Step 2: Run test to verify it fails**

```bash
yarn test:unit
```
Expected: FAIL — `OpenspacePreferences.MODELS_ENABLED` is undefined.

**Step 3: Implement**

In `openspace-preferences.ts`, add:

```typescript
export const OpenspacePreferences = {
    WHITEBOARDS_PATH: 'openspace.paths.whiteboards' as const,
    DECKS_PATH: 'openspace.paths.decks' as const,
    MODELS_ENABLED: 'openspace.models.enabled' as const,  // <-- add
};

export const OpenspacePreferenceDefaults: Record<string, unknown> = {
    [OpenspacePreferences.WHITEBOARDS_PATH]: 'openspace/whiteboards',
    [OpenspacePreferences.DECKS_PATH]: 'openspace/decks',
    [OpenspacePreferences.MODELS_ENABLED]: [],             // <-- add
};
```

Add to `OpenspacePreferenceSchema.properties`:

```typescript
[OpenspacePreferences.MODELS_ENABLED]: {
    type: 'array',
    items: { type: 'string' },
    default: [],
    description: 'List of enabled model IDs in "providerId/modelId" format. Empty means all models are enabled.',
},
```

Note: change the `OpenspacePreferenceDefaults` type from `Record<string, string>` to `Record<string, unknown>` since the new default is an array.

**Step 4: Run test to verify it passes**

```bash
yarn test:unit
```
Expected: all pass.

**Step 5: Commit**

```bash
git add extensions/openspace-settings/src/browser/openspace-preferences.ts \
        extensions/openspace-settings/src/browser/__tests__/openspace-preferences.spec.ts
git commit -m "feat(settings): add openspace.models.enabled preference schema"
```

---

## Task 2: Create the AI Models custom preference renderer

**Files:**
- Create: `extensions/openspace-settings/src/browser/ai-models-preference-renderer.tsx`

This file renders the custom toggle UI inside Theia's Preferences editor. It extends `PreferenceNodeRenderer` (the abstract base class) and mounts a React root.

**Step 1: Create the file**

```typescript
// extensions/openspace-settings/src/browser/ai-models-preference-renderer.tsx

import * as React from '@theia/core/shared/react';
import * as ReactDOM from '@theia/core/shared/react-dom';
import { injectable, inject, postConstruct } from '@theia/core/shared/inversify';
import { PreferenceService, PreferenceScope } from '@theia/core/lib/common/preferences';
import { PreferenceNodeRenderer } from '@theia/preferences/lib/browser/views/components/preference-node-renderer';
import {
    PreferenceNodeRendererContribution,
    PreferenceNodeRendererCreatorRegistry,
    PreferenceNodeRendererCreator,
} from '@theia/preferences/lib/browser/views/components/preference-node-renderer-creator';
import { Preference } from '@theia/preferences/lib/browser/util/preference-types';
import { interfaces } from '@theia/core/shared/inversify';
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
                setEnabled((change.newValue as string[]) ?? []);
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
                const providerAllOn = providerEnabledCount === providerModelIds.length;

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
    protected readonly preferenceService: PreferenceService;

    @inject(SessionService)
    protected readonly sessionService: SessionService;

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
        ReactDOM.render(
            <AiModelsManager
                preferenceService={this.preferenceService}
                sessionService={this.sessionService}
            />,
            this.domNode
        );
    }

    override dispose(): void {
        ReactDOM.unmountComponentAtNode(this.domNode);
        super.dispose();
    }
}

// ─── Contribution ─────────────────────────────────────────────────────────────

const AI_MODELS_PREFERENCE_RENDERER_CREATOR_ID = 'openspace-ai-models-renderer';

@injectable()
export class AiModelsPreferenceRendererContribution implements PreferenceNodeRendererContribution {
    @inject(interfaces.Container)
    protected readonly container: interfaces.Container;

    registerPreferenceNodeRendererCreator(registry: PreferenceNodeRendererCreatorRegistry): void {
        const creator: PreferenceNodeRendererCreator = {
            id: AI_MODELS_PREFERENCE_RENDERER_CREATOR_ID,
            canHandle: (node: Preference.TreeNode) => {
                // Only intercept the leaf node for our specific preference
                if (Preference.TreeNode.isLeaf(node) && node.id === OpenspacePreferences.MODELS_ENABLED) {
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
```

**Step 2: No automated test for the renderer itself** (it requires a full Theia DOM environment — visual verification is done in Task 5). Skip to commit.

**Step 3: Commit**

```bash
git add extensions/openspace-settings/src/browser/ai-models-preference-renderer.tsx
git commit -m "feat(settings): add AI Models custom preference renderer component"
```

---

## Task 3: Register the renderer contribution in the DI module

**Files:**
- Modify: `extensions/openspace-settings/src/browser/openspace-settings-frontend-module.ts`

**Step 1: Update the module**

Replace the contents of `openspace-settings-frontend-module.ts`:

```typescript
import { ContainerModule } from '@theia/core/shared/inversify';
import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { PreferenceNodeRendererContribution } from '@theia/preferences/lib/browser/views/components/preference-node-renderer-creator';
import { OpenspacePreferenceSchema } from './openspace-preferences';
import { AiModelsPreferenceRendererContribution } from './ai-models-preference-renderer';

export default new ContainerModule((bind) => {
    bind(PreferenceContribution).toConstantValue({ schema: OpenspacePreferenceSchema });
    bind(AiModelsPreferenceRendererContribution).toSelf().inSingletonScope();
    bind(PreferenceNodeRendererContribution).toService(AiModelsPreferenceRendererContribution);
});
```

Note: `SessionService` is already in the DI container globally (bound in `openspace-core`), so the renderer can inject it without re-binding here.

**Step 2: Build the settings extension to check for type errors**

```bash
yarn --cwd extensions/openspace-settings build
```
Expected: builds without errors.

**Step 3: Commit**

```bash
git add extensions/openspace-settings/src/browser/openspace-settings-frontend-module.ts
git commit -m "feat(settings): register AI Models preference renderer contribution"
```

---

## Task 4: Filter ModelSelector by enabled preference + add "Manage Models" button

**Files:**
- Modify: `extensions/openspace-chat/src/browser/model-selector.tsx`
- Modify: `extensions/openspace-chat/src/browser/chat-widget.tsx`

The `ModelSelector` is a pure React functional component — it receives props from `ChatWidget` (which is an injectable class with access to Theia services). The cleanest approach is to pass two new props:
- `enabledModels: string[]` — the current value of `openspace.models.enabled` (read in `ChatWidget`, passed down)
- `onManageModels: () => void` — callback that `ChatWidget` implements using `CommandService`

**Step 1: Update `ModelSelectorProps` interface and filtering**

In `model-selector.tsx`, add to the `ModelSelectorProps` interface:

```typescript
interface ModelSelectorProps {
    sessionService: SessionService;
    enabledModels: string[];           // <-- add
    onManageModels: () => void;        // <-- add
}
```

Update `filteredModels` memo to also apply the enabled filter. After the search filter logic, add:

```typescript
// If enabledModels is non-empty, only show enabled ones
if (enabledModels.length > 0 && !enabledModels.includes(fullId)) {
    continue;
}
```

The full updated `filteredModels` memo:

```typescript
const filteredModels = React.useMemo<FlatModel[]>(() => {
    const models: FlatModel[] = [];
    const query = searchQuery.toLowerCase();
    
    for (const provider of providers) {
        for (const [, model] of Object.entries(provider.models)) {
            const fullId = `${provider.id}/${model.id}`;
            
            // Apply enabled filter (empty = all enabled)
            if (enabledModels.length > 0 && !enabledModels.includes(fullId)) {
                continue;
            }
            
            const matchesSearch = !query || 
                model.name.toLowerCase().includes(query) ||
                provider.name.toLowerCase().includes(query) ||
                fullId.toLowerCase().includes(query);
            
            if (matchesSearch) {
                models.push({
                    providerId: provider.id,
                    providerName: provider.name,
                    modelId: model.id,
                    modelName: model.name,
                    fullId
                });
            }
        }
    }
    return models;
}, [providers, searchQuery, enabledModels]);
```

**Step 2: Add "Manage Models" footer button to the dropdown JSX**

Inside the `model-dropdown` div, after the `model-dropdown-content` div, add:

```tsx
{/* Footer: Manage Models */}
<div className="model-dropdown-footer">
    <button
        type="button"
        className="model-manage-btn"
        onClick={() => { handleClose(); onManageModels(); }}
    >
        Manage Models
    </button>
</div>
```

**Step 3: Update `ChatWidget` to pass the new props**

In `chat-widget.tsx`:

1. Add `CommandService` import and injection:

```typescript
import { CommandService } from '@theia/core/lib/common/command';
import { PreferenceService, PreferenceScope } from '@theia/core/lib/common/preferences';
import { CommonCommands } from '@theia/core/lib/browser/common-frontend-contribution';
```

2. Add injections in the `ChatWidget` class:

```typescript
@inject(CommandService)
protected readonly commandService!: CommandService;

@inject(PreferenceService)
protected readonly preferenceService!: PreferenceService;
```

3. Update `ChatComponentProps` to add:

```typescript
interface ChatComponentProps {
    sessionService: SessionService;
    openCodeService: OpenCodeService;
    workspaceRoot: string;
    messageService: MessageService;
    openerService: OpenerService;
    commandService: CommandService;        // <-- add
    preferenceService: PreferenceService;  // <-- add
}
```

4. Update `ChatWidget.render()` to pass the new props:

```typescript
protected render(): React.ReactNode {
    return <ChatComponent 
        sessionService={this.sessionService} 
        openCodeService={this.openCodeService}
        workspaceRoot={this.getWorkspaceRoot()}
        messageService={this.messageService}
        openerService={this.openerService}
        commandService={this.commandService}
        preferenceService={this.preferenceService}
    />;
}
```

5. In `ChatComponent`, read the preference and wire `onManageModels`. At the top of `ChatComponent`:

```typescript
export const ChatComponent: React.FC<ChatComponentProps> = ({ 
    sessionService, openCodeService, workspaceRoot, messageService, openerService,
    commandService, preferenceService
}) => {
    // ... existing state ...
    
    // Read enabled models from preference
    const [enabledModels, setEnabledModels] = React.useState<string[]>(
        preferenceService.get<string[]>('openspace.models.enabled', []) ?? []
    );
    
    React.useEffect(() => {
        const disposable = preferenceService.onPreferenceChanged(change => {
            if (change.preferenceName === 'openspace.models.enabled') {
                setEnabledModels((change.newValue as string[]) ?? []);
            }
        });
        return () => disposable.dispose();
    }, [preferenceService]);
    
    const handleManageModels = React.useCallback(() => {
        commandService.executeCommand(CommonCommands.OPEN_PREFERENCES.id, 'AI Models');
    }, [commandService]);
```

6. In the `ChatHeaderBar` render call, pass through to `ModelSelector`:

Find where `<ModelSelector sessionService={sessionService} />` is rendered (in `ChatHeaderBar`). Pass the new props through `ChatHeaderBarProps` → `ChatHeaderBar` → `ModelSelector`:

Add to `ChatHeaderBarProps`:
```typescript
enabledModels: string[];
onManageModels: () => void;
```

Add to `ChatHeaderBar` destructuring and pass to `<ModelSelector>`:
```tsx
<ModelSelector 
    sessionService={sessionService}
    enabledModels={enabledModels}
    onManageModels={onManageModels}
/>
```

**Step 4: Build chat extension to check for type errors**

```bash
yarn --cwd extensions/openspace-chat build
```
Expected: builds without errors.

**Step 5: Commit**

```bash
git add extensions/openspace-chat/src/browser/model-selector.tsx \
        extensions/openspace-chat/src/browser/chat-widget.tsx
git commit -m "feat(chat): filter ModelSelector by enabled preference; add Manage Models button"
```

---

## Task 5: Add CSS for the AI Models manager and "Manage Models" button

**Files:**
- Modify: `extensions/openspace-chat/src/browser/style/chat-widget.css`
- Create: `extensions/openspace-settings/src/browser/style/ai-models-manager.css`
- Modify: `extensions/openspace-settings/src/browser/openspace-settings-frontend-module.ts` (import the CSS)

**Step 1: Add "Manage Models" footer styles to `chat-widget.css`**

Append to the end of `chat-widget.css`:

```css
/* ── Model Selector: Manage Models footer ──────────────────────────────── */

.model-dropdown-footer {
    border-top: 1px solid var(--theia-widget-border);
    padding: 6px 8px;
    display: flex;
    justify-content: center;
}

.model-manage-btn {
    background: none;
    border: 1px solid var(--theia-button-secondaryBorder, var(--theia-widget-border));
    color: var(--theia-button-secondaryForeground, var(--theia-foreground));
    border-radius: 4px;
    padding: 4px 12px;
    font-size: 11px;
    cursor: pointer;
    width: 100%;
}

.model-manage-btn:hover {
    background: var(--theia-button-secondaryHoverBackground, var(--theia-list-hoverBackground));
}
```

**Step 2: Create `ai-models-manager.css`**

```
extensions/openspace-settings/src/browser/style/ai-models-manager.css
```

```css
/* ── AI Models Manager (Preferences panel) ─────────────────────────────── */

.ai-models-preference-root {
    list-style: none;
    padding: 0;
}

.ai-models-manager {
    padding: 8px 0;
}

.ai-models-loading,
.ai-models-error {
    padding: 12px 16px;
    color: var(--theia-descriptionForeground);
    font-style: italic;
}

.ai-models-error {
    color: var(--theia-inputValidation-errorForeground, var(--theia-errorForeground));
}

/* Global All/None controls */
.ai-models-global-controls {
    display: flex;
    gap: 6px;
    padding: 4px 16px 12px;
}

.ai-models-bulk-btn {
    background: none;
    border: 1px solid var(--theia-widget-border);
    color: var(--theia-foreground);
    border-radius: 3px;
    padding: 2px 10px;
    font-size: 11px;
    cursor: pointer;
}

.ai-models-bulk-btn:hover,
.ai-models-bulk-btn.active {
    background: var(--theia-list-hoverBackground);
}

/* Provider group */
.ai-models-provider-group {
    margin-bottom: 12px;
}

.ai-models-provider-header {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 16px;
    background: var(--theia-sideBar-background, var(--theia-editor-background));
    border-top: 1px solid var(--theia-widget-border);
    border-bottom: 1px solid var(--theia-widget-border);
    font-weight: 600;
    font-size: 12px;
}

.ai-models-provider-name {
    flex: 1;
}

.ai-models-provider-count {
    font-size: 11px;
    color: var(--theia-descriptionForeground);
    margin-right: 4px;
}

/* Model row */
.ai-models-row {
    padding: 4px 16px;
}

.ai-models-row:hover {
    background: var(--theia-list-hoverBackground);
}

.ai-models-row.disabled {
    opacity: 0.5;
}

.ai-models-toggle-label {
    display: flex;
    align-items: center;
    gap: 8px;
    cursor: pointer;
    width: 100%;
}

.ai-models-checkbox {
    flex-shrink: 0;
    cursor: pointer;
}

.ai-models-model-name {
    font-size: 13px;
    flex: 1;
}

.ai-models-model-id {
    font-size: 11px;
    color: var(--theia-descriptionForeground);
    font-family: var(--theia-code-font-family);
}
```

**Step 3: Import the CSS in the settings frontend module**

Theia extensions load CSS via a `require()` at the top of the frontend module. In `openspace-settings-frontend-module.ts`, add at the top:

```typescript
require('../../src/browser/style/ai-models-manager.css');
```

(Check how `openspace-chat` loads its CSS to confirm the pattern — look for `require('./style/...')` in `openspace-chat`'s frontend module.)

**Step 4: Build both extensions**

```bash
yarn --cwd extensions/openspace-settings build && yarn --cwd extensions/openspace-chat build
```
Expected: both build without errors.

**Step 5: Commit**

```bash
git add extensions/openspace-settings/src/browser/style/ai-models-manager.css \
        extensions/openspace-settings/src/browser/openspace-settings-frontend-module.ts \
        extensions/openspace-chat/src/browser/style/chat-widget.css
git commit -m "feat(settings): add CSS for AI Models manager and Manage Models button"
```

---

## Task 6: Full build and visual verification

**Step 1: Full build**

```bash
yarn build:extensions
```
Expected: all extensions build without errors.

**Step 2: Start the app**

```bash
yarn start
```

**Step 3: Verify "Manage Models" button**

1. Open the Chat panel
2. Click the model selector pill in the header
3. The dropdown opens — a "Manage Models" button appears at the bottom
4. Click it — the dropdown closes and the Preferences panel opens with "AI Models" search applied and the `openspace.models.enabled` preference visible with the custom toggle tree

**Step 4: Verify filtering**

1. In the AI Models preference, disable a few models
2. Close and reopen the model selector dropdown
3. Confirm the disabled models no longer appear in the list
4. Re-enable them and confirm they reappear

**Step 5: Verify All/None controls**

1. Click "None" at the global level — all toggles turn off
2. Click "All" — all toggles turn back on (preference resets to `[]`)
3. Click "None" on a specific provider — only that provider's models are disabled
4. Click "All" on that provider — they are re-enabled

**Step 6: Commit if any CSS tweaks made**

```bash
git add -A
git commit -m "fix(settings): tweak AI Models manager layout after visual review"
```

---

## Notes for the implementer

- **`PreferenceNodeRendererContribution` binding:** The contribution must be bound in the *same container module* that is loaded by the preferences plugin. Our `openspace-settings` frontend module is loaded at app startup, so the binding in Task 3 is correct.
- **`SessionService` injection in the renderer:** `SessionService` is bound in `openspace-core`'s frontend module. Since all extensions share the same Theia DI container at the frontend level, it is available globally.
- **CSS loading:** Check `extensions/openspace-chat/src/browser/openspace-chat-frontend-module.ts` for the exact `require('./style/...')` pattern to replicate in settings.
- **`CommonCommands.OPEN_PREFERENCES`:** imported from `@theia/core/lib/browser/common-frontend-contribution`. The command accepts an optional `string` query arg that calls `widget.setSearchTerm(query)` — this scrolls to matching preference sections.
- **Preference opt-out semantics:** `[]` = all models enabled. This avoids forcing every new user to configure anything. Only when a user explicitly disables something does the array get populated.
