import { ContainerModule } from '@theia/core/shared/inversify';
import './style/presentation-widget.css';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import { KeybindingContribution } from '@theia/core/lib/browser/keybinding';
import { PresentationWidget, PresentationNavigationService } from './presentation-widget';
import { PresentationOpenHandler } from './presentation-open-handler';
import { PresentationService } from './presentation-service';
import { PresentationCommandContribution } from './presentation-command-contribution';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  // Register the Presentation Widget
  bind(PresentationWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: PresentationWidget.ID,
      createWidget: () => context.container.get<PresentationWidget>(PresentationWidget),
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
});
