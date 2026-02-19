// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { injectable } from '@theia/core/shared/inversify';
import { ReactWidget } from '@theia/core/lib/browser/widgets/react-widget';
import * as React from '@theia/core/shared/react';

@injectable()
export class MarkdownViewerWidget extends ReactWidget {
    static readonly ID = 'openspace-markdown-viewer-widget';
    static readonly LABEL = 'Markdown Viewer';

    public uri: string = '';

    setContent(_content: string): void {
        // stub
    }

    toggleMode(): void {
        // stub
    }

    getMode(): 'preview' | 'edit' {
        return 'preview';
    }

    protected render(): React.ReactNode {
        return null;
    }
}
