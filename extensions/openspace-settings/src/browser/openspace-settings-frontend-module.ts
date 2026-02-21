import { ContainerModule } from '@theia/core/shared/inversify';
import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { PreferenceNodeRendererContribution } from '@theia/preferences/lib/browser/views/components/preference-node-renderer-creator';
import { OpenspacePreferenceSchema } from './openspace-preferences';
import { AiModelsPreferenceRendererContribution } from './ai-models-preference-renderer';

export default new ContainerModule((bind) => {
    bind(PreferenceContribution).toConstantValue({ schema: OpenspacePreferenceSchema });
    bind(AiModelsPreferenceRendererContribution).toSelf().inSingletonScope();
    bind(PreferenceNodeRendererContribution).toService(AiModelsPreferenceRendererContribution);
});
