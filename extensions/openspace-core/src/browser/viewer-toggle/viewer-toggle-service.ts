// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable, named } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler } from '@theia/core/lib/browser';
import { ContributionProvider } from '@theia/core/lib/common/contribution-provider';

const DEFAULT_EXCLUDED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.wav', '.avi', '.mkv',
];

const DEFAULT_VIEWER_PATTERN = /viewer/i;
const SELF_ID = 'openspace-viewer-toggle-open-handler';

@injectable()
export class ViewerToggleService {
    protected toggleState = new Map<string, 'preview' | 'edit'>();
    protected readonly viewerPattern: RegExp = DEFAULT_VIEWER_PATTERN;
    protected readonly excludedExtensions: string[] = DEFAULT_EXCLUDED_EXTENSIONS;

    @inject(ContributionProvider) @named(OpenHandler)
    protected readonly handlersProvider!: ContributionProvider<OpenHandler>;

    async canToggle(uri: URI): Promise<boolean> {
        if (this.isExcludedExtension(uri)) {
            return false;
        }
        const viewerHandler = await this.findViewerHandler(uri);
        return viewerHandler !== undefined;
    }

    getToggleState(uri: URI): 'preview' | 'edit' {
        return this.toggleState.get(uri.toString()) ?? 'preview';
    }

    toggle(uri: URI): 'preview' | 'edit' {
        const current = this.getToggleState(uri);
        const next = current === 'preview' ? 'edit' : 'preview';
        this.toggleState.set(uri.toString(), next);
        return next;
    }

    /**
     * Finds a viewer handler for the given URI without going through OpenerService.getOpeners().
     *
     * We deliberately inject ContributionProvider<OpenHandler> directly instead of using
     * OpenerService.getOpeners(), because getOpeners() calls canHandle() on every handler —
     * including ViewerToggleOpenHandler itself — which in turn calls canToggle() here,
     * creating infinite recursion / a deadlock.
     *
     * By iterating handlers directly and calling canHandle() only on non-self candidates,
     * we break the cycle.
     */
    protected async findViewerHandler(uri: URI): Promise<OpenHandler | undefined> {
        const handlers = this.handlersProvider.getContributions();
        for (const h of handlers) {
            if (h.id === SELF_ID || !this.isViewerHandler(h)) {
                continue;
            }
            const priority = await h.canHandle(uri);
            if (priority > 0) {
                return h;
            }
        }
        return undefined;
    }

    protected isViewerHandler(handler: OpenHandler): boolean {
        return this.viewerPattern.test(handler.id);
    }

    protected isExcludedExtension(uri: URI): boolean {
        const ext = uri.path.ext.toLowerCase();
        return this.excludedExtensions.includes(ext);
    }
}
