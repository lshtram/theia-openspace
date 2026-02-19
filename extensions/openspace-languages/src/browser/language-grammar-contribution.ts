import { injectable } from '@theia/core/shared/inversify';
import { LanguageGrammarDefinitionContribution } from '@theia/monaco/lib/browser/textmate/textmate-contribution';
import { TextmateRegistry } from '@theia/monaco/lib/browser/textmate/textmate-registry';
// eslint-disable-next-line @typescript-eslint/no-unused-vars
import * as _monaco from '@theia/monaco-editor-core';

@injectable()
export class LanguageGrammarContribution implements LanguageGrammarDefinitionContribution {
    registerTextmateLanguage(registry: TextmateRegistry): void {
        // Tasks 2–4 will fill this in
    }
}
