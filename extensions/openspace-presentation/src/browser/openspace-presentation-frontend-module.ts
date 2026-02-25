import { ContainerModule } from '@theia/core/shared/inversify';
import './style/presentation-widget.css';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { TabBarToolbarContribution } from '@theia/core/lib/browser/shell/tab-bar-toolbar';
import { PresentationWidget, PresentationNavigationService } from './presentation-widget';
import { PresentationOpenHandler } from './presentation-open-handler';
import { PresentationService } from './presentation-service';
import { PresentationCommandContribution } from './presentation-command-contribution';
import { PresentationToolbarContribution } from './presentation-toolbar-contribution';

export default new ContainerModule((bind, _unbind, _isBound, _rebind) => {
  // Register the Presentation Widget
  // Task 27: Do NOT bind as singleton — the factory must create a new instance per URI
  // so multiple .deck.md files can be open simultaneously.
  bind(PresentationWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: PresentationWidget.ID,
      // createWidget receives the options object from getOrCreateWidget (includes { uri })
      // Theia's WidgetManager caches by (factoryId + JSON.stringify(options)), so each
      // distinct URI gets its own widget instance.
      createWidget: (options?: { uri?: string }) => {
        const child = context.container.createChild();
        child.bind(PresentationWidget).toSelf();
        const widget = child.get(PresentationWidget);
        // Propagate URI from construction options so the widget can re-hydrate
        // its content after a page reload (layout restoration path).
        if (options?.uri) {
          widget.uri = options.uri;
        }
        return widget;
      },
    }))
    .whenTargetNamed(PresentationWidget.ID);

  // Register the Navigation Service
  bind(PresentationNavigationService).toSelf().inSingletonScope();

  // Register the Open Handler for .deck.md files
  bind(PresentationOpenHandler).toSelf();
  bind(OpenHandler).toService(PresentationOpenHandler);

  // Register the Presentation Service
  bind(PresentationService).toSelf();

  // Register the Command Contribution
  bind(PresentationCommandContribution).toSelf();
  bind(CommandContribution).toService(PresentationCommandContribution);
  bind(KeybindingContribution).toService(PresentationCommandContribution);

  // Register the Toolbar Contribution
  bind(PresentationToolbarContribution).toSelf().inSingletonScope();
  bind(CommandContribution).toService(PresentationToolbarContribution);
  bind(TabBarToolbarContribution).toService(PresentationToolbarContribution);
});
