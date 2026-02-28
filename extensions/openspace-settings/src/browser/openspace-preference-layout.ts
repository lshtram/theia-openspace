import { injectable } from '@theia/core/shared/inversify';
import { PreferenceLayoutProvider, DEFAULT_LAYOUT, PreferenceLayout } from '@theia/preferences/lib/browser/util/preference-layout';

/**
 * Extends Theia's PreferenceLayoutProvider to add the 'openspace' top-level
 * category. Without this, all openspace.* preferences fall through to the
 * 'extensions' fallback category and their section header appears without items.
 */
@injectable()
export class OpenspacePreferenceLayoutProvider extends PreferenceLayoutProvider {
    override getLayout(): PreferenceLayout[] {
        return [
            ...DEFAULT_LAYOUT,
            {
                id: 'openspace',
                label: 'OpenSpace',
                children: [
                    {
                        id: 'openspace.paths',
                        label: 'Paths',
                        settings: ['openspace.paths.*'],
                    },
                    {
                        id: 'openspace.models',
                        label: 'AI Models',
                        settings: ['openspace.models.*'],
                    },
                    {
                        id: 'openspace.voice',
                        label: 'Voice',
                        settings: ['openspace.voice.*'],
                    },
                ],
            },
        ];
    }
}
