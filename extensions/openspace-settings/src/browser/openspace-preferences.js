"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.OpenspacePreferenceSchema = exports.OpenspacePreferenceDefaults = exports.OpenspacePreferences = void 0;
exports.OpenspacePreferences = {
    WHITEBOARDS_PATH: 'openspace.paths.whiteboards',
    DECKS_PATH: 'openspace.paths.decks',
};
exports.OpenspacePreferenceDefaults = {
    [exports.OpenspacePreferences.WHITEBOARDS_PATH]: 'openspace/whiteboards',
    [exports.OpenspacePreferences.DECKS_PATH]: 'openspace/decks',
};
exports.OpenspacePreferenceSchema = {
    properties: {
        [exports.OpenspacePreferences.WHITEBOARDS_PATH]: {
            type: 'string',
            default: exports.OpenspacePreferenceDefaults[exports.OpenspacePreferences.WHITEBOARDS_PATH],
            description: 'Folder (relative to workspace root) where new whiteboard files are created.',
        },
        [exports.OpenspacePreferences.DECKS_PATH]: {
            type: 'string',
            default: exports.OpenspacePreferenceDefaults[exports.OpenspacePreferences.DECKS_PATH],
            description: 'Folder (relative to workspace root) where new presentation deck files are created.',
        },
    },
};
//# sourceMappingURL=openspace-preferences.js.map