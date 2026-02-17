import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { WhiteboardWidget, WhiteboardUtils } from './whiteboard-widget';

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

  console.log('[OpenSpaceWhiteboard] Frontend module loaded');
});
