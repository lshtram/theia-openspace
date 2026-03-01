// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import * as React from '@theia/core/shared/react';
import * as ReactDOM from '@theia/core/shared/react-dom';
import { SessionService } from 'openspace-core/lib/browser/session-service/session-service';
import { ProviderWithModels } from 'openspace-core/lib/common/opencode-protocol';

interface ModelSelectorProps {
    sessionService: SessionService;
    enabledModels: string[];
    onManageModels: () => void;
}

interface FlatModel {
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
    fullId: string; // provider/model
    status?: string; // 'deprecated' | 'preview' | 'experimental'
    free?: boolean;
    latest?: boolean;
    inputPrice?: number;
    outputPrice?: number;
    contextLength?: number;
}

const LS_RECENT = 'openspace.recentModels';
const LS_FAVORITES = 'openspace.favoriteModels';
const MAX_RECENT = 10;

function loadFromStorage(key: string): string[] {
    try {
        const raw = localStorage.getItem(key);
        return raw ? (JSON.parse(raw) as string[]) : [];
    } catch {
        return [];
    }
}

function saveToStorage(key: string, value: string[]): void {
    try {
        localStorage.setItem(key, JSON.stringify(value));
    } catch {
        // ignore storage errors
    }
}

/**
 * ModelSelector Component
 *
 * Displays the current model and allows selecting from available models.
 * Features:
 * - Search/filter functionality
 * - Grouped by provider with separator headers
 * - Favorites and Recent sections (persisted to localStorage)
 * - Free/Latest badges, status tags (deprecated/preview)
 * - Tooltip on hover showing pricing and context length
 * - Keyboard navigation (ArrowDown/ArrowUp/Enter/Escape)
 * - "Manage Providers" footer button
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({ sessionService, enabledModels, onManageModels }) => {
    const [providers, setProviders] = React.useState<ProviderWithModels[]>([]);
    const [activeModel, setActiveModel] = React.useState<string | undefined>(sessionService.activeModel);
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | undefined>();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [favorites, setFavorites] = React.useState<string[]>(() => loadFromStorage(LS_FAVORITES));
    const [recentModels, setRecentModels] = React.useState<string[]>(() => loadFromStorage(LS_RECENT));
    const [hoveredModel, setHoveredModel] = React.useState<string | undefined>();

    const triggerRef = React.useRef<HTMLButtonElement>(null);
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);
    const [dropdownStyle, setDropdownStyle] = React.useState<React.CSSProperties>({});

    // Flatten and filter models based on search and enabled list
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
                    const raw = model as unknown as Record<string, unknown>;
                    models.push({
                        providerId: provider.id,
                        providerName: provider.name,
                        modelId: model.id,
                        modelName: model.name,
                        fullId,
                        status: raw['status'] as string | undefined,
                        free: raw['free'] as boolean | undefined,
                        latest: raw['latest'] as boolean | undefined,
                        inputPrice: raw['inputPrice'] as number | undefined,
                        outputPrice: raw['outputPrice'] as number | undefined,
                        contextLength: raw['contextLength'] as number | undefined,
                    });
                }
            }
        }
        return models;
    }, [providers, searchQuery, enabledModels]);

    // Group filtered models by provider (sorted alphabetically by provider name)
    const groupedModels = React.useMemo(() => {
        const groups: Record<string, FlatModel[]> = {};
        for (const model of filteredModels) {
            if (!groups[model.providerName]) {
                groups[model.providerName] = [];
            }
            groups[model.providerName].push(model);
        }
        return Object.fromEntries(
            Object.entries(groups).sort(([a], [b]) => a.localeCompare(b))
        );
    }, [filteredModels]);

    // Favorites section: models that are favorited AND pass the current filter
    const favoriteModels = React.useMemo(() => {
        return filteredModels.filter(m => favorites.includes(m.fullId));
    }, [filteredModels, favorites]);

    // Recent section: models that are in recentModels AND pass the current filter, not already in favorites
    const recentFilteredModels = React.useMemo(() => {
        return recentModels
            .map(id => filteredModels.find(m => m.fullId === id))
            .filter((m): m is FlatModel => m !== undefined && !favorites.includes(m.fullId));
    }, [filteredModels, recentModels, favorites]);

    // Subscribe to active model changes
    React.useEffect(() => {
        const disposable = sessionService.onActiveModelChanged(model => {
            setActiveModel(model);
        });
        return () => disposable.dispose();
    }, [sessionService]);

    // Focus search input when dropdown opens
    React.useEffect(() => {
        if (isOpen && searchInputRef.current) {
            setTimeout(() => searchInputRef.current?.focus(), 50);
        }
    }, [isOpen]);

    // Fetch models when dropdown opens
    const fetchModels = React.useCallback(async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            const fetchedProviders = await sessionService.getAvailableModels();
            setProviders(fetchedProviders);

            if (!sessionService.activeModel && fetchedProviders.length > 0) {
                type ModelEntry = { providerId: string; modelId: string };
                const firstAvailable = fetchedProviders.reduce<ModelEntry | undefined>((found, provider) => {
                    if (found) return found;
                    const firstModel = Object.values(provider.models)[0];
                    return firstModel ? { providerId: provider.id, modelId: firstModel.id } : undefined;
                }, undefined);

                if (firstAvailable) {
                    const defaultModel = `${firstAvailable.providerId}/${firstAvailable.modelId}`;
                    sessionService.setActiveModel(defaultModel);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load models');
        } finally {
            setIsLoading(false);
        }
    }, [sessionService]);

    // Open dropdown as centered modal dialog
    const handleOpen = React.useCallback(async () => {
        const modalWidth = Math.min(440, window.innerWidth - 48);
        setDropdownStyle({
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            width: modalWidth,
            zIndex: 9999,
        });
        setIsOpen(true);
        setSearchQuery('');
        fetchModels();
    }, [fetchModels]);

    // Handle dropdown close
    const handleClose = React.useCallback(() => {
        setIsOpen(false);
        setError(undefined);
        setSearchQuery('');
        setHoveredModel(undefined);
    }, []);

    // Toggle dropdown
    const handleToggle = React.useCallback(() => {
        if (isOpen) {
            handleClose();
        } else {
            handleOpen();
        }
    }, [isOpen, handleOpen, handleClose]);

    // Handle model selection
    const handleSelect = React.useCallback((fullId: string) => {
        sessionService.setActiveModel(fullId);
        setActiveModel(fullId);
        setIsOpen(false);
        // Persist to recent models
        setRecentModels(prev => {
            const updated = [fullId, ...prev.filter(id => id !== fullId)].slice(0, MAX_RECENT);
            saveToStorage(LS_RECENT, updated);
            return updated;
        });
    }, [sessionService]);

    // Toggle favorite
    const handleFavorite = React.useCallback((fullId: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setFavorites(prev => {
            const updated = prev.includes(fullId)
                ? prev.filter(id => id !== fullId)
                : [...prev, fullId];
            saveToStorage(LS_FAVORITES, updated);
            return updated;
        });
    }, []);

    // Track focused option index for keyboard navigation
    const [focusedIndex, setFocusedIndex] = React.useState(-1);

    // Reset focused index when dropdown opens/closes or filtered models change
    React.useEffect(() => {
        if (!isOpen) {
            setFocusedIndex(-1);
        }
    }, [isOpen]);

    React.useEffect(() => {
        setFocusedIndex(-1);
    }, [filteredModels]);

    // Scroll focused option into view
    React.useEffect(() => {
        if (focusedIndex >= 0 && dropdownRef.current) {
            const options = dropdownRef.current.querySelectorAll('.model-option');
            if (options[focusedIndex]) {
                const el = options[focusedIndex] as HTMLElement;
                el.scrollIntoView({ block: 'nearest' });
                el.focus();
            }
        }
    }, [focusedIndex]);

    // Handle keyboard navigation on the outer wrapper
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (!isOpen) {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                handleOpen();
            }
            return;
        }

        if (e.key === 'Escape') {
            e.preventDefault();
            handleClose();
            return;
        }

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setFocusedIndex(prev => {
                const count = filteredModels.length;
                if (count === 0) return -1;
                return prev < count - 1 ? prev + 1 : 0;
            });
            return;
        }

        if (e.key === 'ArrowUp') {
            e.preventDefault();
            setFocusedIndex(prev => {
                const count = filteredModels.length;
                if (count === 0) return -1;
                return prev > 0 ? prev - 1 : count - 1;
            });
            return;
        }

        if (e.key === 'Enter' && focusedIndex >= 0 && focusedIndex < filteredModels.length) {
            e.preventDefault();
            handleSelect(filteredModels[focusedIndex].fullId);
        }
    }, [isOpen, handleOpen, handleClose, filteredModels, focusedIndex, handleSelect]);

    // Close on outside click
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            const target = event.target as Node;
            if (
                triggerRef.current && !triggerRef.current.contains(target) &&
                dropdownRef.current && !dropdownRef.current.contains(target)
            ) {
                handleClose();
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
        return undefined;
    }, [isOpen, handleClose]);

    // Get display name for current model
    const currentModelDisplay = React.useMemo(() => {
        if (!activeModel) return 'Select Model';
        const [providerId, ...modelParts] = activeModel.split('/');
        const modelId = modelParts.join('/');
        const provider = providers.find(p => p.id === providerId);
        const model = provider?.models[modelId];
        if (model) {
            return model.name;
        }
        // Providers not yet fetched — show the model ID part only (skip provider prefix)
        return modelId || activeModel;
    }, [activeModel, providers]);

    const providerEntries = Object.entries(groupedModels);
    const hasModels = filteredModels.length > 0;

    // Find hovered model data for tooltip
    const hoveredModelData = hoveredModel
        ? filteredModels.find(m => m.fullId === hoveredModel)
        : undefined;

    return (
        <div
            className="model-selector"
            onKeyDown={handleKeyDown}
        >
            <button
                ref={triggerRef}
                type="button"
                className="model-selector-pill"
                onClick={handleToggle}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                title={activeModel || 'Select a model'}
            >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="11" height="11" style={{ flexShrink: 0, opacity: 0.6 }} aria-hidden="true">
                    <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>
                    {currentModelDisplay}
                </span>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="9" height="9" style={{ flexShrink: 0, opacity: 0.5 }} aria-hidden="true">
                    <path d="m6 9 6 6 6-6"/>
                </svg>
            </button>

            {ReactDOM.createPortal(
                isOpen ? (
                    <>
                        {/* Backdrop overlay */}
                        <div
                            className="model-dialog-backdrop"
                            onClick={handleClose}
                        />
                        {/* Main dropdown — uses both test-required class and new visual class */}
                        <div
                            ref={dropdownRef}
                            className="model-dropdown model-dialog"
                            role="dialog"
                            aria-label="Select a model"
                            aria-modal="true"
                            style={dropdownStyle}
                        >
                            {/* Search Input */}
                            <div className="model-dialog-search">
                                <svg className="model-dialog-search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
                                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                                </svg>
                                <input
                                    ref={searchInputRef}
                                    type="text"
                                    className="model-search-input model-dialog-search-input"
                                    placeholder="Search models..."
                                    value={searchQuery}
                                    autoFocus
                                    autoComplete="off"
                                    spellCheck={false}
                                    onChange={(e) => setSearchQuery(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Escape') {
                                            e.stopPropagation();
                                            if (searchQuery) {
                                                setSearchQuery('');
                                            } else {
                                                handleClose();
                                            }
                                        }
                                    }}
                                />
                                {searchQuery && (
                                    <button
                                        type="button"
                                        className="model-dialog-search-clear"
                                        onClick={() => { setSearchQuery(''); searchInputRef.current?.focus(); }}
                                        aria-label="Clear search"
                                    >
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" width="10" height="10">
                                            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
                                        </svg>
                                    </button>
                                )}
                            </div>

                            {/* Scrollable model list */}
                            <div className="model-dialog-list" role="listbox" aria-label="Available models">
                                {isLoading && (
                                    <div className="model-dialog-status">
                                        <svg className="oc-spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
                                            <path d="M21 12a9 9 0 1 1-6.219-8.56"/>
                                        </svg>
                                        Loading models...
                                    </div>
                                )}

                                {error && (
                                    <div className="model-dropdown-error model-dialog-error">
                                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="13" height="13" aria-hidden="true">
                                            <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
                                        </svg>
                                        <span>{error}</span>
                                        <button type="button" className="model-dialog-retry" onClick={fetchModels}>Retry</button>
                                    </div>
                                )}

                                {!isLoading && !error && !hasModels && (
                                    searchQuery ? (
                                        <div className="model-dropdown-empty model-dialog-status">No models match your search</div>
                                    ) : (
                                        <div className="model-dropdown-empty model-dialog-status">
                                            No models configured.{' '}
                                            <button
                                                type="button"
                                                className="model-selector-empty-cta model-dialog-link"
                                                onClick={() => { handleClose(); onManageModels(); }}
                                            >
                                                Open Settings
                                            </button>
                                        </div>
                                    )
                                )}

                                {/* Favorites section */}
                                {!isLoading && !error && favoriteModels.length > 0 && (
                                    <div className="model-dialog-group">
                                        <div className="model-section-header model-provider-header model-dialog-separator" aria-hidden="true">
                                            <span className="model-dialog-separator-label">Favorites</span>
                                        </div>
                                        {favoriteModels.map(model => {
                                            const flatIdx = filteredModels.indexOf(model);
                                            return (
                                                <ModelRow
                                                    key={`fav-${model.fullId}`}
                                                    model={model}
                                                    isSelected={model.fullId === activeModel}
                                                    isFocused={flatIdx === focusedIndex}
                                                    isFavorited={true}
                                                    onSelect={handleSelect}
                                                    onFavorite={handleFavorite}
                                                    onHover={setHoveredModel}
                                                />
                                            );
                                        })}
                                    </div>
                                )}

                                {/* Recent section */}
                                {!isLoading && !error && recentFilteredModels.length > 0 && (
                                    <div className="model-dialog-group">
                                        <div className="model-section-header model-provider-header model-dialog-separator" aria-hidden="true">
                                            <span className="model-dialog-separator-label">Recent</span>
                                        </div>
                                        {recentFilteredModels.map(model => {
                                            const flatIdx = filteredModels.indexOf(model);
                                            return (
                                                <ModelRow
                                                    key={`recent-${model.fullId}`}
                                                    model={model}
                                                    isSelected={model.fullId === activeModel}
                                                    isFocused={flatIdx === focusedIndex}
                                                    isFavorited={favorites.includes(model.fullId)}
                                                    onSelect={handleSelect}
                                                    onFavorite={handleFavorite}
                                                    onHover={setHoveredModel}
                                                />
                                            );
                                        })}
                                    </div>
                                )}

                                {/* All models grouped by provider */}
                                {!isLoading && !error && providerEntries.map(([providerName, models], groupIdx) => (
                                    <div key={providerName} className="model-dialog-group">
                                        {/* Provider separator — has both test class and visual class */}
                                        <div className="model-provider-header model-dialog-separator" aria-hidden="true">
                                            <span className="model-dialog-separator-label">{providerName}</span>
                                        </div>
                                        {/* Model rows */}
                                        {models.map(model => {
                                            const flatIdx = filteredModels.indexOf(model);
                                            return (
                                                <ModelRow
                                                    key={model.fullId}
                                                    model={model}
                                                    isSelected={model.fullId === activeModel}
                                                    isFocused={flatIdx === focusedIndex}
                                                    isFavorited={favorites.includes(model.fullId)}
                                                    onSelect={handleSelect}
                                                    onFavorite={handleFavorite}
                                                    onHover={setHoveredModel}
                                                />
                                            );
                                        })}
                                        {/* Thin divider between provider groups */}
                                        {groupIdx < providerEntries.length - 1 && (
                                            <div className="model-dialog-group-divider" aria-hidden="true" />
                                        )}
                                    </div>
                                ))}
                            </div>

                            {/* Footer: Manage Providers */}
                            <div className="model-dialog-footer">
                                <button
                                    type="button"
                                    className="model-manage-btn model-dialog-manage-btn"
                                    onClick={() => { handleClose(); onManageModels(); }}
                                >
                                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                                        <circle cx="12" cy="12" r="3"/>
                                        <path d="M19.07 4.93a10 10 0 0 1 0 14.14M4.93 4.93a10 10 0 0 0 0 14.14"/>
                                    </svg>
                                    Manage Providers
                                </button>
                            </div>
                        </div>

                        {/* Tooltip — rendered at portal root, appears on model hover */}
                        {hoveredModelData && (hoveredModelData.inputPrice !== undefined || hoveredModelData.outputPrice !== undefined || hoveredModelData.contextLength !== undefined) && (
                            <div className="model-tooltip" role="tooltip">
                                {hoveredModelData.inputPrice !== undefined && (
                                    <div className="model-tooltip-row">
                                        <span>Input:</span> <span>${hoveredModelData.inputPrice}/M</span>
                                    </div>
                                )}
                                {hoveredModelData.outputPrice !== undefined && (
                                    <div className="model-tooltip-row">
                                        <span>Output:</span> <span>${hoveredModelData.outputPrice}/M</span>
                                    </div>
                                )}
                                {hoveredModelData.contextLength !== undefined && (
                                    <div className="model-tooltip-row">
                                        <span>Context:</span> <span>{hoveredModelData.contextLength.toLocaleString()} tokens</span>
                                    </div>
                                )}
                            </div>
                        )}
                    </>
                ) : null,
                document.body
            )}
        </div>
    );
};

// Compact single-row model option
interface ModelRowProps {
    model: FlatModel;
    isSelected: boolean;
    isFocused?: boolean;
    isFavorited?: boolean;
    onSelect: (fullId: string) => void;
    onFavorite: (fullId: string, e: React.MouseEvent) => void;
    onHover: (fullId: string | undefined) => void;
}

const ModelRow: React.FC<ModelRowProps> = ({ model, isSelected, isFocused, isFavorited, onSelect, onFavorite, onHover }) => {
    const rowRef = React.useRef<HTMLDivElement>(null);

    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(model.fullId);
        }
    }, [model.fullId, onSelect]);

    // Use native event listeners so that jsdom mouseenter events are captured
    React.useEffect(() => {
        const el = rowRef.current;
        if (!el) return;
        const enter = () => onHover(model.fullId);
        const leave = () => onHover(undefined);
        el.addEventListener('mouseenter', enter);
        el.addEventListener('mouseleave', leave);
        return () => {
            el.removeEventListener('mouseenter', enter);
            el.removeEventListener('mouseleave', leave);
        };
    }, [model.fullId, onHover]);

    return (
        <div
            ref={rowRef}
            className={`model-option model-dialog-row${isSelected ? ' selected' : ''}${isFocused ? ' focused' : ''}`}
            onClick={() => onSelect(model.fullId)}
            onKeyDown={handleKeyDown}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
        >
            <span className="model-dialog-row-check" aria-hidden="true">
                {isSelected && (
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" width="11" height="11">
                        <polyline points="20 6 9 17 4 12"/>
                    </svg>
                )}
            </span>
            <span className="model-dialog-row-name">{model.modelName}</span>

            {/* Status tags */}
            {model.status === 'deprecated' && (
                <span className="model-status-tag--deprecated model-dialog-row-tag model-dialog-row-tag--deprecated">
                    deprecated
                </span>
            )}
            {model.status === 'preview' && (
                <span className="model-status-tag--preview model-dialog-row-tag model-dialog-row-tag--preview">
                    preview
                </span>
            )}

            {/* Free badge */}
            {model.free && (
                <span className="model-free-badge" aria-label="Free model">free</span>
            )}

            {/* Latest badge */}
            {model.latest && (
                <span className="model-latest-badge" aria-label="Latest model">latest</span>
            )}

            {/* Favorite button */}
            <button
                type="button"
                className={`model-favorite-btn${isFavorited ? ' active' : ''}`}
                onClick={(e) => onFavorite(model.fullId, e)}
                aria-label={isFavorited ? 'Remove from favorites' : 'Add to favorites'}
                aria-pressed={isFavorited}
            >
                <svg viewBox="0 0 24 24" fill={isFavorited ? 'currentColor' : 'none'} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" width="12" height="12" aria-hidden="true">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                </svg>
            </button>
        </div>
    );
};
