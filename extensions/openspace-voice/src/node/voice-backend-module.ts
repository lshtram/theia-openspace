// extensions/openspace-voice/src/node/voice-backend-module.ts
import { ContainerModule } from '@theia/core/shared/inversify';
import { BackendApplicationContribution } from '@theia/core/lib/node/backend-application';
import { VoiceHubContribution } from './voice-hub-contribution';

export default new ContainerModule((bind) => {
  bind(VoiceHubContribution).toSelf().inSingletonScope();
  bind(BackendApplicationContribution).toService(VoiceHubContribution);
});
