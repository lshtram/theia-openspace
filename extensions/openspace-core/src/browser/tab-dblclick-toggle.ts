/**
 * Attaches a double-click listener to the Luminous tab bar that contains
 * the given widget node. When a tab whose label matches `getLabel()` is
 * double-clicked, `onToggle()` is called.
 *
 * @param widgetNode  The widget's root DOM node (`this.node` inside a Theia widget).
 * @param getLabel    Returns the current tab label to match against.
 * @param onToggle    Callback invoked on a matching double-click.
 * @returns           A Disposable that removes the event listener.
 */
export function attachTabDblClickToggle(
    widgetNode: HTMLElement,
    getLabel: () => string,
    onToggle: () => void,
): { dispose(): void } {
    const dockPanel = widgetNode.closest('.lm-DockPanel');
    if (!dockPanel) { return { dispose: () => undefined }; }

    const tabBarContent = dockPanel.querySelector('.lm-TabBar-content');
    if (!tabBarContent) { return { dispose: () => undefined }; }

    const handler = (e: Event): void => {
        const tab = (e.target as HTMLElement).closest('.lm-TabBar-tab');
        if (!tab) { return; }
        const label = tab.querySelector('.lm-TabBar-tabLabel');
        if (label && label.textContent === getLabel()) {
            onToggle();
        }
    };

    tabBarContent.addEventListener('dblclick', handler);
    return { dispose: () => tabBarContent.removeEventListener('dblclick', handler) };
}
