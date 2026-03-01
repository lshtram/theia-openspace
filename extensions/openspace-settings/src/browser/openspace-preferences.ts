import { PreferenceSchema } from '@theia/core/lib/common/preferences/preference-schema';

export const OpenspacePreferences = {
    WHITEBOARDS_PATH: 'openspace.paths.whiteboards' as const,
    DECKS_PATH: 'openspace.paths.decks' as const,
    MODELS_ENABLED: 'openspace.models.enabled' as const,
    NOTIFICATIONS_TURN_COMPLETE: 'openspace.notifications.turnComplete' as const,
    NOTIFICATIONS_ERRORS: 'openspace.notifications.errors' as const,
    SOUNDS_ENABLED: 'openspace.sounds.enabled' as const,
};

export const OpenspacePreferenceDefaults: Record<string, unknown> = {
    [OpenspacePreferences.WHITEBOARDS_PATH]: 'openspace/whiteboards',
    [OpenspacePreferences.DECKS_PATH]: 'openspace/decks',
    [OpenspacePreferences.MODELS_ENABLED]: [],
    [OpenspacePreferences.NOTIFICATIONS_TURN_COMPLETE]: true,
    [OpenspacePreferences.NOTIFICATIONS_ERRORS]: true,
    [OpenspacePreferences.SOUNDS_ENABLED]: false,
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
        [OpenspacePreferences.NOTIFICATIONS_TURN_COMPLETE]: {
            type: 'boolean',
            default: true,
            description: 'Show a notification when an agent finishes in a background session.',
        },
        [OpenspacePreferences.NOTIFICATIONS_ERRORS]: {
            type: 'boolean',
            default: true,
            description: 'Show a notification when a session encounters an error.',
        },
        [OpenspacePreferences.SOUNDS_ENABLED]: {
            type: 'boolean',
            default: false,
            description: 'Play sounds for agent events (turn complete, errors).',
        },
    },
};
