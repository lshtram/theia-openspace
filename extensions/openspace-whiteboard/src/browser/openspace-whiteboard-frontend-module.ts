import { ContainerModule } from '@theia/core/shared/inversify';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  // TODO: Phase 1+ implementations
  console.log('[OpenSpaceWhiteboard] Frontend module loaded');
});
