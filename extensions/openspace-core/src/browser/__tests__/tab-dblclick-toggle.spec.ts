import { expect } from 'chai';
import { attachTabDblClickToggle } from '../tab-dblclick-toggle';

describe('attachTabDblClickToggle', () => {
    function makeDOM(labelText: string): {
        dockPanel: HTMLElement;
        tabBarContent: HTMLElement;
        tab: HTMLElement;
        labelEl: HTMLElement;
        widgetNode: HTMLElement;
    } {
        // Build the minimal DOM structure that Theia's dock panel produces:
        //   .lm-DockPanel
        //     .lm-TabBar-content
        //       .lm-TabBar-tab
        //         .lm-TabBar-tabLabel  (textContent = labelText)
        //     <widget-node>
        const dockPanel = document.createElement('div');
        dockPanel.className = 'lm-DockPanel';

        const tabBarContent = document.createElement('ul');
        tabBarContent.className = 'lm-TabBar-content';

        const tab = document.createElement('li');
        tab.className = 'lm-TabBar-tab';

        const labelEl = document.createElement('div');
        labelEl.className = 'lm-TabBar-tabLabel';
        labelEl.textContent = labelText;

        tab.appendChild(labelEl);
        tabBarContent.appendChild(tab);

        const widgetNode = document.createElement('div');
        dockPanel.appendChild(tabBarContent);
        dockPanel.appendChild(widgetNode);
        document.body.appendChild(dockPanel);

        return { dockPanel, tabBarContent, tab, labelEl, widgetNode };
    }

    afterEach(() => {
        // Remove all dock panels added during tests
        document.querySelectorAll('.lm-DockPanel').forEach(el => el.remove());
    });

    it('calls onToggle when the correct tab is double-clicked', () => {
        let called = 0;
        const { widgetNode, tab } = makeDOM('My File.md');
        const disposable = attachTabDblClickToggle(widgetNode, () => 'My File.md', () => { called++; });
        tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(called).to.equal(1);
        disposable.dispose();
    });

    it('does NOT call onToggle when a different tab is double-clicked', () => {
        let called = 0;
        const { widgetNode, tabBarContent } = makeDOM('Other File.md');

        // Add a second tab with a different label
        const otherTab = document.createElement('li');
        otherTab.className = 'lm-TabBar-tab';
        const otherLabel = document.createElement('div');
        otherLabel.className = 'lm-TabBar-tabLabel';
        otherLabel.textContent = 'Not My Widget';
        otherTab.appendChild(otherLabel);
        tabBarContent.appendChild(otherTab);

        attachTabDblClickToggle(widgetNode, () => 'Other File.md', () => { called++; });
        otherTab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(called).to.equal(0);
    });

    it('removes the listener after dispose()', () => {
        let called = 0;
        const { widgetNode, tab } = makeDOM('file.deck.md');
        const disposable = attachTabDblClickToggle(widgetNode, () => 'file.deck.md', () => { called++; });
        disposable.dispose();
        tab.dispatchEvent(new MouseEvent('dblclick', { bubbles: true }));
        expect(called).to.equal(0);
    });

    it('returns early without throwing when no .lm-DockPanel ancestor exists', () => {
        const orphan = document.createElement('div');
        document.body.appendChild(orphan);
        expect(() => {
            const d = attachTabDblClickToggle(orphan, () => 'x', () => undefined);
            d.dispose();
        }).to.not.throw();
        orphan.remove();
    });
});
