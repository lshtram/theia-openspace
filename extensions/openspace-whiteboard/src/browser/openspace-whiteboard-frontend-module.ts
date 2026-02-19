import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import './style/whiteboard-widget.css';
import { WhiteboardWidget, WhiteboardUtils } from './whiteboard-widget';
import { WhiteboardOpenHandler } from './whiteboard-open-handler';
import { WhiteboardService } from './whiteboard-service';
import { WhiteboardCommandContribution } from './whiteboard-command-contribution';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  // Register the Whiteboard Widget
  bind(WhiteboardWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: WhiteboardWidget.ID,
      createWidget: () => context.container.get<WhiteboardWidget>(WhiteboardWidget),
    }))
    .whenTargetNamed(WhiteboardWidget.ID);

  // Register utility class
  bind(WhiteboardUtils).toSelf();

  // Register the Open Handler for .whiteboard.json files
  bind(WhiteboardOpenHandler).toSelf();
  bind(OpenHandler).toService(WhiteboardOpenHandler);

  // Register the Whiteboard Service
  bind(WhiteboardService).toSelf();

  // Register the Command Contribution
  bind(WhiteboardCommandContribution).toSelf();
  bind(CommandContribution).toService(WhiteboardCommandContribution);
});
