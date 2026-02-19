import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

export const OpenspacePreferences = {
    WHITEBOARDS_PATH: 'openspace.paths.whiteboards' as const,
    DECKS_PATH: 'openspace.paths.decks' as const,
};

export const OpenspacePreferenceDefaults: Record<string, string> = {
    [OpenspacePreferences.WHITEBOARDS_PATH]: 'openspace/whiteboards',
    [OpenspacePreferences.DECKS_PATH]: 'openspace/decks',
};

export const OpenspacePreferenceSchema: PreferenceSchema = {
    properties: {
        [OpenspacePreferences.WHITEBOARDS_PATH]: {
            type: 'string',
            default: OpenspacePreferenceDefaults[OpenspacePreferences.WHITEBOARDS_PATH],
            description: 'Folder (relative to workspace root) where new whiteboard files are created.',
        },
        [OpenspacePreferences.DECKS_PATH]: {
            type: 'string',
            default: OpenspacePreferenceDefaults[OpenspacePreferences.DECKS_PATH],
            description: 'Folder (relative to workspace root) where new presentation deck files are created.',
        },
    },
};
