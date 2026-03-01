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

    it('should export MODELS_ENABLED key', () => {
        expect(OpenspacePreferences.MODELS_ENABLED).to.equal('openspace.models.enabled');
    });

    it('should have correct default for models enabled (empty array)', () => {
        expect(OpenspacePreferenceDefaults[OpenspacePreferences.MODELS_ENABLED]).to.deep.equal([]);
    });

    describe('N1-C: notification preferences', () => {
        it('exports NOTIFICATIONS_TURN_COMPLETE key', () => {
            expect(OpenspacePreferences.NOTIFICATIONS_TURN_COMPLETE).to.equal('openspace.notifications.turnComplete');
        });

        it('exports NOTIFICATIONS_ERRORS key', () => {
            expect(OpenspacePreferences.NOTIFICATIONS_ERRORS).to.equal('openspace.notifications.errors');
        });

        it('exports SOUNDS_ENABLED key', () => {
            expect(OpenspacePreferences.SOUNDS_ENABLED).to.equal('openspace.sounds.enabled');
        });

        it('has default true for NOTIFICATIONS_TURN_COMPLETE', () => {
            expect(OpenspacePreferenceDefaults[OpenspacePreferences.NOTIFICATIONS_TURN_COMPLETE]).to.equal(true);
        });

        it('has default true for NOTIFICATIONS_ERRORS', () => {
            expect(OpenspacePreferenceDefaults[OpenspacePreferences.NOTIFICATIONS_ERRORS]).to.equal(true);
        });

        it('has default false for SOUNDS_ENABLED', () => {
            expect(OpenspacePreferenceDefaults[OpenspacePreferences.SOUNDS_ENABLED]).to.equal(false);
        });
    });
});
