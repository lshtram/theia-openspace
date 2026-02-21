import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

export const OpenspacePreferences = {
    WHITEBOARDS_PATH: 'openspace.paths.whiteboards' as const,
    DECKS_PATH: 'openspace.paths.decks' as const,
    MODELS_ENABLED: 'openspace.models.enabled' as const,
};

export const OpenspacePreferenceDefaults: Record<string, unknown> = {
    [OpenspacePreferences.WHITEBOARDS_PATH]: 'openspace/whiteboards',
    [OpenspacePreferences.DECKS_PATH]: 'openspace/decks',
    [OpenspacePreferences.MODELS_ENABLED]: [],
};

export const OpenspacePreferenceSchema: PreferenceSchema = {
    properties: {
        [OpenspacePreferences.WHITEBOARDS_PATH]: {
            type: 'string',
            default: 'openspace/whiteboards',
            description: 'Folder (relative to workspace root) where new whiteboard files are created.',
        },
        [OpenspacePreferences.DECKS_PATH]: {
            type: 'string',
            default: 'openspace/decks',
            description: 'Folder (relative to workspace root) where new presentation deck files are created.',
        },
        [OpenspacePreferences.MODELS_ENABLED]: {
            type: 'array',
            items: { type: 'string' },
            default: [],
            description: 'List of enabled model IDs in "providerId/modelId" format. Empty means all models are enabled.',
        },
    },
};
