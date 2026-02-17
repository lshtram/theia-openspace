import { ContainerModule } from '@theia/core/shared/inversify';
import { WidgetFactory } from '@theia/core/lib/browser';
import { PresentationWidget, PresentationNavigationService } from './presentation-widget';

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
  bind(PresentationNavigationService).toSelf();

  console.log('[OpenSpacePresentation] Frontend module loaded');
});
