# Generic Viewer Toggle Design

**Date:** 2026-02-22  
**Status:** Draft  
**Related:** 2026-02-19-markdown-viewer.md, 2026-02-20-presentation-tab-dblclick-edit-toggle.md

## Summary

Implement a generic mechanism that automatically provides toggle functionality between "pretty viewer" mode and raw text mode for any viewer widget, without requiring viewer authors to implement anything. This extends the pattern used for Markdown files to work with any viewer extension (CSV, JSON, YAML, etc.) including third-party extensions.

## Problem Statement

Currently, the toggle between preview/edit mode is implemented individually:
- **Markdown viewer**: Has explicit `toggleMode()` and `attachTabDblClickToggle` integration
- **Presentation viewer**: Needs similar functionality (tracked separately)

This requires each viewer to:
1. Implement toggle logic
2. Integrate with `attachTabDblClickToggle`
3. Maintain toggle state

For third-party extensions (e.g., CSV viewer), this creates friction - users would need to request the extension author to implement this behavior.

## Goals

1. **Automatic detection**: Identify viewer widgets without manual configuration
2. **Transparent operation**: Works with any viewer without code changes to the viewer
3. **Consistent behavior**: Same UX across all file types (double-click tab to toggle)
4. **Per-session state**: Toggle state is in-memory, resets on app restart
5. **Graceful fallback**: Skip toggle for file types that can't be displayed as text

## Architecture

### Component Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                      OpenHandler Registry                        │
│  (Theia core - manages all OpenHandler implementations)         │
└─────────────────────────────────────────────────────────────────┘
                                │
        ┌───────────────────────┼───────────────────────┐
        ▼                       ▼                       ▼
┌───────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ ViewerToggle  │    │ MarkdownViewer  │    │ Other Viewer   │
│ OpenHandler   │    │ OpenHandler     │    │ OpenHandler    │
│ (priority:150)│    │ (priority:200)  │    │ (priority:100) │
└───────────────┘    └─────────────────┘    └─────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                    ViewerToggleService                          │
│  - toggleState: Map<URI, 'preview' | 'edit'>                   │
│  - viewerPattern: RegExp (default: /viewer/i)                   │
│  - excludedExtensions: string[]                                 │
└─────────────────────────────────────────────────────────────────┘
        │
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                  TabDblClickHandler (reuse)                     │
│  - Uses existing attachTabDblClickToggle from openspace-core    │
└─────────────────────────────────────────────────────────────────┘
```

### Components

#### 1. ViewerToggleService

Central service that tracks toggle state and determines if a file type is toggleable.

```typescript
@injectable()
export class ViewerToggleService {
    // Map from URI string to current mode
    protected toggleState = new Map<string, 'preview' | 'edit'>();
    
    // Pattern to identify viewer widgets (configurable)
    protected viewerPattern: RegExp = /viewer/i;
    
    // Extensions that cannot be displayed as text
    protected excludedExtensions = ['.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.pdf', '.bin', '.exe', '.zip'];
    
    @inject(OpenHandlerRegistry)
    protected readonly openHandlerRegistry!: OpenHandlerRegistry;
    
    @inject(WidgetManager)
    protected readonly widgetManager!: WidgetManager;
    
    /**
     * Check if a URI can be toggled between viewer and raw text.
     */
    canToggle(uri: URI): boolean {
        // 1. Check if file extension is excluded
        if (this.isExcludedExtension(uri)) {
            return false;
        }
        
        // 2. Check if there's a viewer handler for this URI
        const viewerHandler = this.findViewerHandler(uri);
        if (!viewerHandler) {
            return false;
        }
        
        // 3. Check if file can be read as text (basic check)
        return this.canReadAsText(uri);
    }
    
    /**
     * Get the current toggle state for a URI.
     */
    getToggleState(uri: URI): 'preview' | 'edit' {
        return this.toggleState.get(uri.toString()) ?? 'preview';
    }
    
    /**
     * Toggle the state for a URI and return the new state.
     */
    toggle(uri: URI): 'preview' | 'edit' {
        const current = this.getToggleState(uri);
        const next = current === 'preview' ? 'edit' : 'preview';
        this.toggleState.set(uri.toString(), next);
        return next;
    }
    
    /**
     * Find the highest-priority viewer OpenHandler for a URI.
     */
    protected findViewerHandler(uri: URI): OpenHandler | undefined {
        const handlers = this.openHandlerRegistry.getOpenHandlers(uri);
        // Sort by priority descending and find first with viewer widget
        const sorted = handlers.sort((a, b) => b.canHandle(uri) - a.canHandle(uri));
        return sorted.find(h => this.isViewerHandler(h, uri));
    }
    
    /**
     * Check if an OpenHandler produces a viewer widget.
     */
    protected isViewerHandler(handler: OpenHandler, uri: URI): boolean {
        // Check handler ID or widget factory ID for "viewer" pattern
        const handlerId = handler.id;
        return this.viewerPattern.test(handlerId);
    }
    
    protected isExcludedExtension(uri: URI): boolean {
        const ext = uri.path.ext.toLowerCase();
        return this.excludedExtensions.includes(ext);
    }
    
    protected canReadAsText(uri: URI): boolean {
        // Simple check - could be enhanced with FileService stat
        const ext = uri.path.ext.toLowerCase();
        const textExtensions = ['.txt', '.md', '.markdown', '.csv', '.json', '.yaml', '.yml', '.xml', '.html', '.css', '.js', '.ts', '.py', '.sh', '.bat', '.ps1', '.log'];
        return textExtensions.includes(ext) || !this.excludedExtensions.includes(ext);
    }
}
```

#### 2. ViewerToggleOpenHandler

High-priority OpenHandler that intercepts file opens and delegates to either the viewer or the text editor based on toggle state.

```typescript
@injectable()
export class ViewerToggleOpenHandler implements OpenHandler {
    readonly id = 'openspace-viewer-toggle-open-handler';
    
    // Priority: 150 (higher than default editor 100, lower than specific viewers 200)
    static readonly PRIORITY = 150;
    
    @inject(ViewerToggleService)
    protected readonly toggleService!: ViewerToggleService;
    
    @inject(OpenHandlerRegistry)
    protected readonly openHandlerRegistry!: OpenHandlerRegistry;
    
    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;
    
    canHandle(uri: URI): number {
        // Only handle if toggle is possible for this URI
        if (this.toggleService.canToggle(uri)) {
            return ViewerToggleOpenHandler.PRIORITY;
        }
        return 0;
    }
    
    async open(uri: URI, options?: OpenerOptions): Promise<Widget> {
        const state = this.toggleService.getToggleState(uri);
        
        if (state === 'edit') {
            // Open as plain text editor
            return this.openAsTextEditor(uri, options);
        } else {
            // Open with viewer (delegate to next highest priority handler)
            return this.openWithViewer(uri, options);
        }
    }
    
    protected async openAsTextEditor(uri: URI, options?: OpenerOptions): Promise<Widget> {
        // Use Theia's built-in opener for text files
        const opener = await this.openHandlerRegistry.getOpener(uri, { ...options, widgetOptions: options?.widgetOptions ?? { area: 'main' } });
        return opener.open(uri, options);
    }
    
    protected async openWithViewer(uri: URI, options?: OpenerOptions): Promise<Widget> {
        // Find the viewer handler and delegate to it
        const handlers = this.openHandlerRegistry.getOpenHandlers(uri);
        const viewerHandler = handlers.find(h => h.id !== this.id && h.canHandle(uri) > 0);
        
        if (viewerHandler) {
            return viewerHandler.open(uri, options);
        }
        
        // Fallback to text editor if no viewer found
        return this.openAsTextEditor(uri, options);
    }
}
```

#### 3. TabDoubleClickHandler Integration

Reuse the existing `attachTabDblClickToggle` from `openspace-core`:

```typescript
@injectable()
export class ViewerToggleContribution implements WidgetLifecycleListener {
    @inject(ViewerToggleService)
    protected readonly toggleService!: ViewerToggleService;
    
    @inject(ApplicationShell)
    protected readonly shell!: ApplicationShell;
    
    @postConstruct()
    protected init(): void {
        // Listen for widget activation to attach dbl-click handler
        this.shell.onDidActivateWidget(({ widget }) => {
            this.attachToggleHandler(widget);
        });
    }
    
    protected attachToggleHandler(widget: Widget): void {
        // Check if this widget is toggleable (is a viewer for a toggleable URI)
        const uri = this.getWidgetUri(widget);
        if (!uri || !this.toggleService.canToggle(new URI(uri))) {
            return;
        }
        
        // Attach the double-click handler
        const disposable = attachTabDblClickToggle(
            widget.node,
            () => widget.title.label,
            () => {
                const uri = new URI(widget.uri);
                const newState = this.toggleService.toggle(uri);
                // Re-open with the new state
                this.reopenWithState(uri, newState, widget);
            }
        );
        
        widget.toDisposeOnDetach.push(disposable);
    }
    
    protected async reopenWithState(uri: URI, state: 'preview' | 'edit', oldWidget: Widget): Promise<void> {
        // Get the open handler and re-open with new state
        const handlers = this.openHandlerRegistry.getOpenHandlers(uri);
        const toggleHandler = handlers.find(h => h.id === 'openspace-viewer-toggle-open-handler');
        
        if (toggleHandler) {
            await toggleHandler.open(uri, {
                widgetOptions: { mode: 'replace', ref: oldWidget }
            });
        }
    }
}
```

## Data Flow

### Initial Open (Preview Mode)

1. User clicks on `file.csv` in file explorer
2. OpenHandlerRegistry queries all handlers for `file.csv`
3. `ViewerToggleOpenHandler.canHandle()` returns 150 (can toggle)
4. `ViewerToggleOpenHandler.open()` checks toggle state → `preview`
5. Delegates to actual viewer handler (MarkdownViewerOpenHandler or CSV viewer)
6. Widget created and attached
7. `ViewerToggleContribution` attaches dbl-click handler to tab

### Toggle to Edit Mode

1. User double-clicks tab title
2. `attachTabDblClickToggle` callback fires
3. `ViewerToggleService.toggle(uri)` flips state → `edit`
4. `reopenWithState()` called with new state
5. `ViewerToggleOpenHandler.open()` now returns `edit` state
6. Opens with standard text editor instead of viewer
7. Tab dbl-click handler re-attached for toggling back

## Configuration

### Excluded Extensions

Default list of binary/non-text formats that won't get toggle:

```typescript
const DEFAULT_EXCLUDED_EXTENSIONS = [
    '.png', '.jpg', '.jpeg', '.gif', '.bmp', '.ico', '.webp',  // Images
    '.pdf', '.doc', '.docx', '.xls', '.xlsx',                   // Documents
    '.zip', '.tar', '.gz', '.rar', '.7z',                       // Archives
    '.exe', '.dll', '.so', '.dylib',                            // Binaries
    '.mp3', '.mp4', '.wav', '.avi', '.mkv',                     // Media
];
```

### Viewer Pattern

Default pattern to identify viewer widgets: `/viewer/i`

This matches:
- `openspace-markdown-viewer-widget`
- `csv-viewer-widget`
- `any-extension-viewer`

Override via configuration if needed.

## Edge Cases

1. **No viewer available**: If only text editor can handle the file, toggle handler returns 0
2. **File not readable as text**: Checked via extension allowlist
3. **Widget already open**: `replace` mode in widgetOptions ensures same tab
4. **Multiple instances**: Toggle state is per-URI, works correctly with splits
5. **Viewer with built-in edit mode**: Works fine - both states use text editor

## Testing Strategy

1. **Unit tests for ViewerToggleService**:
   - `canToggle()` returns false for excluded extensions
   - `canToggle()` returns true for viewer-handled text files
   - `toggle()` correctly flips state

2. **Unit tests for ViewerToggleOpenHandler**:
   - `canHandle()` returns correct priority for toggleable URIs
   - `open()` delegates to viewer in preview mode
   - `open()` delegates to text editor in edit mode

3. **Integration tests**:
   - Open CSV file → shows in viewer
   - Double-click tab → switches to text editor
   - Double-click again → switches back to viewer

## File Locations

New files to create in `extensions/openspace-core/src/browser/`:

```
src/browser/
├── viewer-toggle/
│   ├── viewer-toggle-service.ts       # Core service
│   ├── viewer-toggle-open-handler.ts  # OpenHandler interceptor
│   ├── viewer-toggle-contribution.ts # Tab dbl-click attachment
│   ├── viewer-toggle-module.ts        # DI bindings
│   └── __tests__/
│       ├── viewer-toggle-service.spec.ts
│       └── viewer-toggle-open-handler.spec.ts
```

## Compatibility with Existing Viewers

### Markdown Viewer
- Already has `toggleMode()` but will be superseded by generic toggle
- Can remove duplicate code after migration
- Priority: MarkdownViewerOpenHandler (200) > ViewerToggleOpenHandler (150)
- When in edit mode, opens as text editor (same as before)

### Presentation Viewer
- Will automatically get toggle functionality
- Currently has no toggle - will gain it transparently

### Third-Party Extensions
- Will automatically get toggle if:
  1. Handler ID contains "viewer"
  2. File extension is text-readable
  3. No special code needed in the extension

## Open Questions

1. **Should we allow disabling toggle per file type?**
   - Could add configuration option
   - Defer to future if needed

2. **Should we preserve toggle state across workspace sessions?**
   - Currently per-session (in-memory Map)
   - Could persist to workspace state if requested

3. **How to handle viewers that need special text editor configuration?**
   - Current approach uses default text editor
   - Could extend to support custom editor options per file type

## Related Design Docs

- [2026-02-19-markdown-viewer.md](./2026-02-19-markdown-viewer.md) - Original markdown viewer implementation
- [2026-02-20-presentation-tab-dblclick-edit-toggle.md](./2026-02-20-presentation-tab-dblclick-edit-toggle.md) - Presentation toggle design
