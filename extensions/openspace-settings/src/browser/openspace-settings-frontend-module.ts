import { ContainerModule } from '@theia/core/shared/inversify';
import { PreferenceContribution } from '@theia/core/lib/common/preferences/preference-schema';
import { OpenspacePreferenceSchema } from './openspace-preferences';

export default new ContainerModule((bind) => {
    bind(PreferenceContribution).toConstantValue({ schema: OpenspacePreferenceSchema });
});
