import { ContainerModule } from '@theia/core/shared/inversify';
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import { LanguageGrammarContribution } from './language-grammar-contribution';

export default new ContainerModule(bind => {
    bind(LanguageGrammarContribution).toSelf().inSingletonScope();
    bind(LanguageGrammarDefinitionContribution).toService(LanguageGrammarContribution);
    console.log('[OpenSpaceLanguages] Frontend module loaded');
});
