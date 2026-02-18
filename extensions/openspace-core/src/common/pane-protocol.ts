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

import { Disposable } from '@theia/core/lib/common/disposable';
import { Event } from '@theia/core/lib/common/event';

/**
 * PaneService Symbol for dependency injection.
 */
export const PaneService = Symbol('PaneService');

/**
 * Open content request interface.
 */
export interface OpenContentRequest {
    readonly uri: string;
    readonly options?: OpenContentOptions;
}

export interface OpenContentOptions {
    readonly mode?: 'tab' | 'split' | 'replace';
    readonly column?: 'left' | 'main' | 'right';
    readonly activate?: boolean;
    readonly reveal?: boolean;
}

/**
 * Pane layout interface.
 */
export interface PaneLayout {
    readonly type: 'single' | 'split-h' | 'split-v' | 'tabs';
    readonly children?: PaneLayout[];
    readonly active?: string;
}

/**
 * Pane info interface.
 */
export interface PaneInfo {
    readonly id: string;
    readonly title: string;
    readonly iconClass?: string;
    readonly geometry?: PaneGeometry;
    readonly tabs?: TabInfo[];
    readonly activeTab?: string;
    readonly layout?: PaneLayout;
}

export interface TabInfo {
    readonly id: string;
    readonly title: string;
    readonly iconClass?: string;
    readonly tooltip?: string;
    readonly closable?: boolean;
    readonly content?: ContentInfo;
}

/**
 * Pane geometry interface.
 */
export interface PaneGeometry {
    readonly x: number;
    readonly y: number;
    readonly width: number;
    readonly height: number;
}

/**
 * Content info interface.
 */
export interface ContentInfo {
    readonly uri: string;
    readonly contentType?: string;
    readonly options?: Record<string, unknown>;
}

/**
 * Streaming update interface for real-time content updates.
 */
export interface StreamingUpdate {
    readonly paneId: string;
    readonly tabId: string;
    readonly type: 'content' | 'progress' | 'complete' | 'error';
    readonly data?: string;
    readonly progress?: number;
    readonly error?: string;
}

/**
 * PaneService interface for pane management.
 */
export interface PaneService extends Disposable {
    /**
     * Event emitted when a pane is opened.
     */
    readonly onPaneDidOpen: Event<PaneInfo>;

    /**
     * Event emitted when a pane is closed.
     */
    readonly onPaneDidClose: Event<string>;

    /**
     * Event emitted when a pane's title changes.
     */
    readonly onPaneTitleDidChange: Event<{ paneId: string; title: string }>;

    /**
     * Event emitted when a tab is activated.
     */
    readonly onTabDidActivate: Event<{ paneId: string; tabId: string }>;

    /**
     * Event emitted when a tab is closed.
     */
    readonly onTabDidClose: Event<{ paneId: string; tabId: string }>;

    /**
     * Event emitted for streaming updates.
     */
    readonly onStreamingUpdate: Event<StreamingUpdate>;

    /**
     * Open content in a pane.
     */
    openContent(request: OpenContentRequest): Promise<string>;

    /**
     * Close a pane by ID.
     */
    closePane(paneId: string): Promise<void>;

    /**
     * Close a tab in a pane.
     */
    closeTab(paneId: string, tabId: string): Promise<void>;

    /**
     * Activate a pane.
     */
    activatePane(paneId: string): Promise<void>;

    /**
     * Activate a tab in a pane.
     */
    activateTab(paneId: string, tabId: string): Promise<void>;

    /**
     * Get all pane information.
     */
    getPanes(): Promise<PaneInfo[]>;

    /**
     * Get pane information by ID.
     */
    getPane(paneId: string): Promise<PaneInfo | undefined>;

    /**
     * Set pane title.
     */
    setPaneTitle(paneId: string, title: string): Promise<void>;

    /**
     * Set pane layout.
     */
    setPaneLayout(paneId: string, layout: PaneLayout): Promise<void>;

    /**
     * Split a pane.
     */
    splitPane(paneId: string, direction: 'horizontal' | 'vertical'): Promise<string>;

    /**
     * Get the active pane.
     */
    getActivePane(): Promise<PaneInfo | undefined>;

    /**
     * Check if a pane exists.
     */
    hasPane(paneId: string): Promise<boolean>;

    /**
     * Get pane geometry.
     */
    getPaneGeometry(paneId: string): Promise<PaneGeometry | undefined>;
}
