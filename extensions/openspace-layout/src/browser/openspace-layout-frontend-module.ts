import { ContainerModule } from '@theia/core/shared/inversify';
import './style/index.css';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
  // TODO: Phase 1+ implementations
  console.log('[OpenSpaceLayout] Frontend module loaded');
});
