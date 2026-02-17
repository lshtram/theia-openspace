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
import { ProviderWithModels, Model } from 'openspace-core/lib/common/opencode-protocol';

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
 * Models are grouped by provider in the dropdown.
 */
export const ModelSelector: React.FC<ModelSelectorProps> = ({ sessionService }) => {
    const [providers, setProviders] = React.useState<ProviderWithModels[]>([]);
    const [activeModel, setActiveModel] = React.useState<string | undefined>(sessionService.activeModel);
    const [isOpen, setIsOpen] = React.useState(false);
    const [isLoading, setIsLoading] = React.useState(false);
    const [error, setError] = React.useState<string | undefined>();
    const [selectedIndex, setSelectedIndex] = React.useState(0);
    
    const dropdownRef = React.useRef<HTMLDivElement>(null);

    // Flatten models for keyboard navigation
    const flatModels = React.useMemo<FlatModel[]>(() => {
        const models: FlatModel[] = [];
        for (const provider of providers) {
            for (const [, model] of Object.entries(provider.models)) {
                models.push({
                    providerId: provider.id,
                    providerName: provider.name,
                    modelId: model.id,
                    modelName: model.name,
                    fullId: `${provider.id}/${model.id}`
                });
            }
        }
        return models;
    }, [providers]);

    // Subscribe to active model changes
    React.useEffect(() => {
        const disposable = sessionService.onActiveModelChanged(model => {
            setActiveModel(model);
        });
        return () => disposable.dispose();
    }, [sessionService]);

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
        fetchModels();
        // Reset selection to current model
        const currentIndex = flatModels.findIndex(m => m.fullId === activeModel);
        setSelectedIndex(currentIndex >= 0 ? currentIndex : 0);
    }, [fetchModels, activeModel, flatModels]);

    // Handle dropdown close
    const handleClose = React.useCallback(() => {
        setIsOpen(false);
        setError(undefined);
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

        switch (e.key) {
            case 'Escape':
                e.preventDefault();
                handleClose();
                break;
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev + 1) % flatModels.length);
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev - 1 + flatModels.length) % flatModels.length);
                break;
            case 'Enter':
                e.preventDefault();
                if (flatModels[selectedIndex]) {
                    handleSelect(flatModels[selectedIndex].fullId);
                }
                break;
            case 'Tab':
                handleClose();
                break;
            default:
                // Do nothing for other keys
                break;
        }
    }, [isOpen, flatModels, selectedIndex, handleOpen, handleClose, handleSelect]);

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

    // Scroll selected item into view
    React.useEffect(() => {
        if (isOpen && flatModels.length > 0) {
            const selectedElement = document.querySelector('.model-option.selected');
            selectedElement?.scrollIntoView({ block: 'nearest' });
        }
    }, [selectedIndex, isOpen, flatModels.length]);

    // Get display name for current model
    const currentModelDisplay = React.useMemo(() => {
        if (!activeModel) return 'Select Model';
        const [providerId, modelId] = activeModel.split('/');
        const provider = providers.find(p => p.id === providerId);
        const model = provider?.models[modelId];
        if (provider && model) {
            return `${provider.name} ${model.name}`;
        }
        return activeModel;
    }, [activeModel, providers]);

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

                    {!isLoading && !error && providers.length === 0 && (
                        <div className="model-dropdown-empty">
                            No models available
                        </div>
                    )}

                    {!isLoading && !error && providers.map(provider => (
                        <div key={provider.id} className="model-provider-group">
                            <div className="model-provider-header">
                                {provider.name}
                            </div>
                            {Object.values(provider.models).map((model: Model) => {
                                const fullId = `${provider.id}/${model.id}`;
                                const isSelected = fullId === activeModel;
                                const index = flatModels.findIndex(m => m.fullId === fullId);
                                const isHighlighted = index === selectedIndex;

                                return (
                                    <div
                                        key={model.id}
                                        className={`model-option ${isSelected ? 'selected' : ''} ${isHighlighted ? 'highlighted' : ''}`}
                                        onClick={() => handleSelect(fullId)}
                                        onMouseEnter={() => setSelectedIndex(index)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' || e.key === ' ') {
                                                e.preventDefault();
                                                handleSelect(fullId);
                                            }
                                        }}
                                        role="option"
                                        aria-selected={isSelected}
                                        tabIndex={-1}
                                    >
                                        <span className="model-option-name">
                                            {isSelected && <span className="model-option-indicator">●</span>}
                                            {model.name}
                                        </span>
                                        {model.limit && (
                                            <span className="model-option-limit">
                                                {model.limit.context >= 1000 
                                                    ? `${Math.round(model.limit.context / 1000)}k` 
                                                    : model.limit.context} ctx
                                            </span>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
};
