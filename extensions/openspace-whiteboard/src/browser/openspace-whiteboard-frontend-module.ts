import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory, OpenHandler } from '@theia/core/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import './style/whiteboard-widget.css';
import { WhiteboardWidget, WhiteboardUtils } from './whiteboard-widget';
import { WhiteboardOpenHandler } from './whiteboard-open-handler';
import { WhiteboardService } from './whiteboard-service';
import { WhiteboardCommandContribution } from './whiteboard-command-contribution';

export default new ContainerModule((bind, _unbind, _isBound, _rebind) => {
  // Register the Whiteboard Widget
  // Task 27: Do NOT bind as singleton — factory creates a new instance per URI.
  bind(WhiteboardWidget).toSelf();
  bind(WidgetFactory)
    .toDynamicValue((context) => ({
      id: WhiteboardWidget.ID,
      createWidget: () => {
        const child = context.container.createChild();
        child.bind(WhiteboardWidget).toSelf();
        return child.get(WhiteboardWidget);
      },
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
