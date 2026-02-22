// *****************************************************************************
// Copyright (C) 2026 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { inject, injectable } from '@theia/core/shared/inversify';
import { URI } from '@theia/core/lib/common/uri';
import { OpenHandler, OpenerService } from '@theia/core/lib/browser';

const DEFAULT_EXCLUDED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',
    '.zip', '.tar', '.gz', '.rar', '.7z',
    '.exe', '.dll', '.so', '.dylib',
    '.mp3', '.mp4', '.wav', '.avi', '.mkv',
];

const TEXT_EXTENSIONS = [
    '.txt', '.md', '.markdown', '.mdown', '.csv', '.json', '.yaml', '.yml',
    '.xml', '.html', '.css', '.js', '.ts', '.tsx', '.jsx', '.py', '.sh',
    '.bat', '.ps1', '.log', '.ini', '.conf', '.cfg', '.toml', '.sql',
];

const DEFAULT_VIEWER_PATTERN = /viewer/i;

@injectable()
export class ViewerToggleService {
    protected toggleState = new Map<string, 'preview' | 'edit'>();
    protected readonly viewerPattern: RegExp = DEFAULT_VIEWER_PATTERN;
    protected readonly excludedExtensions: string[] = DEFAULT_EXCLUDED_EXTENSIONS;

    @inject(OpenerService)
    protected readonly openerService!: OpenerService;

    async canToggle(uri: URI): Promise<boolean> {
        if (this.isExcludedExtension(uri)) {
            return false;
        }
        const viewerHandler = await this.findViewerHandler(uri);
        if (!viewerHandler) {
            return false;
        }
        return this.canReadAsText(uri);
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

    protected async findViewerHandler(uri: URI): Promise<OpenHandler | undefined> {
        // getOpeners returns handlers sorted by priority (highest first)
        const handlers = await this.openerService.getOpeners(uri);
        return handlers.find(h => this.isViewerHandler(h));
    }

    protected isViewerHandler(handler: OpenHandler): boolean {
        return this.viewerPattern.test(handler.id);
    }

    protected isExcludedExtension(uri: URI): boolean {
        const ext = uri.path.ext.toLowerCase();
        return this.excludedExtensions.includes(ext);
    }

    protected canReadAsText(uri: URI): boolean {
        const ext = uri.path.ext.toLowerCase();
        return TEXT_EXTENSIONS.includes(ext) || !this.isExcludedExtension(uri);
    }
}
