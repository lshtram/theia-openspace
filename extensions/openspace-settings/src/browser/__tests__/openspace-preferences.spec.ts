import { expect } from 'chai';
import { OpenspacePreferences, OpenspacePreferenceDefaults } from '../openspace-preferences';

describe('OpenspacePreferences', () => {
    it('should export WHITEBOARDS_PATH key', () => {
        expect(OpenspacePreferences.WHITEBOARDS_PATH).to.equal('openspace.paths.whiteboards');
    });

    it('should export DECKS_PATH key', () => {
        expect(OpenspacePreferences.DECKS_PATH).to.equal('openspace.paths.decks');
    });

    it('should have correct default for whiteboards', () => {
        expect(OpenspacePreferenceDefaults[OpenspacePreferences.WHITEBOARDS_PATH]).to.equal('openspace/whiteboards');
    });

    it('should have correct default for decks', () => {
        expect(OpenspacePreferenceDefaults[OpenspacePreferences.DECKS_PATH]).to.equal('openspace/decks');
    });
});
