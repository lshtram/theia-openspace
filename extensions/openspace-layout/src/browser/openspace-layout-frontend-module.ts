import { ContainerModule } from '@theia/core/shared/inversify';
import { FrontendApplicationContribution } from '@theia/core/lib/browser';
import { LayoutContribution } from './layout-contribution';
import './style/index.css';

export default new ContainerModule((bind) => {
    if (process.env.NODE_ENV !== 'production') { console.log('[OpenSpaceLayout] Frontend module loaded'); }
    bind(LayoutContribution).toSelf().inSingletonScope();
    bind(FrontendApplicationContribution).toService(LayoutContribution);
});
