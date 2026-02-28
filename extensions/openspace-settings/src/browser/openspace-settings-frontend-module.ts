import { ContainerModule } from '@theia/core/shared/inversify';
import './style/ai-models-manager.css';
import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { PreferenceLayoutProvider } from '@theia/preferences/lib/browser/util/preference-layout';
import { PreferenceNodeRendererContribution } from '@theia/preferences/lib/browser/views/components/preference-node-renderer-creator';
import { OpenspacePreferenceSchema } from './openspace-preferences';
import { AiModelsPreferenceRendererContribution } from './ai-models-preference-renderer';
import { OpenspacePreferenceLayoutProvider } from './openspace-preference-layout';

export default new ContainerModule((bind, unbind, isBound, rebind) => {
    bind(PreferenceContribution).toConstantValue({ schema: OpenspacePreferenceSchema });
    bind(OpenspacePreferenceLayoutProvider).toSelf().inSingletonScope();
    rebind(PreferenceLayoutProvider).toService(OpenspacePreferenceLayoutProvider);
    bind(AiModelsPreferenceRendererContribution).toSelf().inSingletonScope();
    bind(PreferenceNodeRendererContribution).toService(AiModelsPreferenceRendererContribution);
});
