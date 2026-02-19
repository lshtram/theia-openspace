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
import { SessionService } from 'openspace-core/lib/browser/session-service';
import { ProviderWithModels } from 'openspace-core/lib/common/opencode-protocol';

interface ModelSelectorProps {
    sessionService: SessionService;
}

interface FlatModel {
    providerId: string;
    providerName: string;
    modelId: string;
    modelName: string;
    fullId: string; // provider/model
}

/**
 * ModelSelector Component
 * 
 * Displays the current model and allows selecting from available models.
 * Features:
 * - Search/filter functionality
 * - Grouped by provider
 * - Keyboard navigation
 * - Recently used models section
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({ sessionService }) => {
    const [providers, setProviders] = React.useState<ProviderWithModels[]>([]);
    const [activeModel, setActiveModel] = React.useState<string | undefined>(sessionService.activeModel);
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | undefined>();
    const [searchQuery, setSearchQuery] = React.useState('');
    const [recentModels, setRecentModels] = React.useState<string[]>([]);
    
    const dropdownRef = React.useRef<HTMLDivElement>(null);
    const searchInputRef = React.useRef<HTMLInputElement>(null);

    // Flatten and filter models based on search
    const filteredModels = React.useMemo<FlatModel[]>(() => {
        const models: FlatModel[] = [];
        const query = searchQuery.toLowerCase();
        
        for (const provider of providers) {
            for (const [, model] of Object.entries(provider.models)) {
                const fullId = `${provider.id}/${model.id}`;
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
    }, [providers, searchQuery]);

    // Group filtered models by provider
    const groupedModels = React.useMemo(() => {
        const groups: Record<string, FlatModel[]> = {};
        for (const model of filteredModels) {
            if (!groups[model.providerName]) {
                groups[model.providerName] = [];
            }
            groups[model.providerName].push(model);
        }
        return groups;
    }, [filteredModels]);

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
            setTimeout(() => searchInputRef.current?.focus(), 100);
        }
    }, [isOpen]);

    // Fetch models when dropdown opens
    const fetchModels = React.useCallback(async () => {
        setIsLoading(true);
        setError(undefined);
        try {
            const providers = await sessionService.getAvailableModels();
            setProviders(providers);
            
            // Set default model if none selected
            if (!sessionService.activeModel && providers.length > 0) {
                const firstProvider = providers[0];
                const firstModel = Object.values(firstProvider.models)[0];
                if (firstModel) {
                    const defaultModel = `${firstProvider.id}/${firstModel.id}`;
                    sessionService.setActiveModel(defaultModel);
                }
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to load models');
        } finally {
            setIsLoading(false);
        }
    }, [sessionService]);

    // Handle dropdown open
    const handleOpen = React.useCallback(() => {
        setIsOpen(true);
        setSearchQuery('');
        fetchModels();
    }, [fetchModels]);

    // Handle dropdown close
    const handleClose = React.useCallback(() => {
        setIsOpen(false);
        setError(undefined);
        setSearchQuery('');
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
        
        // Add to recent models
        setRecentModels(prev => {
            const updated = [fullId, ...prev.filter(m => m !== fullId)].slice(0, 5);
            return updated;
        });
    }, [sessionService]);

    // Handle keyboard navigation
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
        }
    }, [isOpen, handleOpen, handleClose]);

    // Close on outside click
    React.useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
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
        if (provider && model) {
            return `${provider.name} ${model.name}`;
        }
        return activeModel;
    }, [activeModel, providers]);

    // Get recent model objects
    const recentModelObjects = React.useMemo(() => {
        return recentModels
            .map(id => filteredModels.find(m => m.fullId === id))
            .filter((m): m is FlatModel => m !== undefined);
    }, [recentModels, filteredModels]);

    return (
        <div
            className="model-selector"
            ref={dropdownRef}
        >
            <button
                type="button"
                className="model-selector-display"
                onClick={handleToggle}
                onKeyDown={handleKeyDown}
                aria-expanded={isOpen}
                aria-haspopup="listbox"
                title={activeModel || 'Select a model'}
            >
                <span className="model-selector-icon">🤖</span>
                <span className="model-selector-name">{currentModelDisplay}</span>
                <span className="model-selector-arrow">{isOpen ? '▲' : '▼'}</span>
            </button>

            {isOpen && (
                <div 
                    className="model-dropdown"
                    role="listbox"
                    aria-label="Available models"
                >
                    {/* Search Input */}
                    <div className="model-dropdown-search">
                        <input
                            ref={searchInputRef}
                            type="text"
                            className="model-search-input"
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            onKeyDown={(e) => {
                                if (e.key === 'Escape') {
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
                                className="model-search-clear"
                                onClick={() => setSearchQuery('')}
                                title="Clear search"
                            >
                                ×
                            </button>
                        )}
                    </div>

                    {isLoading && (
                        <div className="model-dropdown-loading">
                            <span className="spinner">⏳</span> Loading models...
                        </div>
                    )}

                    {error && (
                        <div className="model-dropdown-error">
                            <div className="error-message">
                                <span className="error-icon">⚠️</span> {error}
                            </div>
                            <button
                                type="button"
                                className="retry-button"
                                onClick={fetchModels}
                            >
                                Retry
                            </button>
                        </div>
                    )}

                    {!isLoading && !error && filteredModels.length === 0 && (
                        <div className="model-dropdown-empty">
                            {searchQuery ? 'No models match your search' : 'No models available'}
                        </div>
                    )}

                    {!isLoading && !error && (
                        <div className="model-dropdown-content">
                            {/* Recent Models Section */}
                            {recentModelObjects.length > 0 && !searchQuery && (
                                <div className="model-section">
                                    <div className="model-section-header">Recent</div>
                                    {recentModelObjects.map(model => (
                                        <ModelOption
                                            key={`recent-${model.fullId}`}
                                            model={model}
                                            isSelected={model.fullId === activeModel}
                                            onSelect={handleSelect}
                                        />
                                    ))}
                                </div>
                            )}

                            {/* All Models Grouped by Provider */}
                            {Object.entries(groupedModels).map(([providerName, models]) => (
                                <div key={providerName} className="model-provider-group">
                                    <div className="model-provider-header">
                                        {providerName}
                                    </div>
                                    {models.map(model => (
                                        <ModelOption
                                            key={model.fullId}
                                            model={model}
                                            isSelected={model.fullId === activeModel}
                                            onSelect={handleSelect}
                                        />
                                    ))}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// Sub-component for model option
interface ModelOptionProps {
    model: FlatModel;
    isSelected: boolean;
    onSelect: (fullId: string) => void;
}

const ModelOption: React.FC<ModelOptionProps> = ({ model, isSelected, onSelect }) => {
    const handleKeyDown = React.useCallback((e: React.KeyboardEvent) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            onSelect(model.fullId);
        }
    }, [model.fullId, onSelect]);

    return (
        <div
            className={`model-option ${isSelected ? 'selected' : ''}`}
            onClick={() => onSelect(model.fullId)}
            onKeyDown={handleKeyDown}
            role="option"
            aria-selected={isSelected}
            tabIndex={0}
        >
            <span className="model-option-name">
                {isSelected && <span className="model-option-indicator">●</span>}
                {model.modelName}
            </span>
            <span className="model-option-id">{model.fullId}</span>
        </div>
    );
};
