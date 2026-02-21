// extensions/openspace-settings/src/browser/__tests__/ai-models-toggle-logic.spec.ts

import { expect } from 'chai';
import {
    resolveEffectiveEnabled,
    canonicalize,
    toggleModel,
    toggleAll,
    toggleProvider,
} from '../ai-models-toggle-logic';

const ALL_MODELS = ['openai/gpt-4o', 'openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet', 'anthropic/claude-3-haiku'];
const OPENAI_MODELS = ['openai/gpt-4o', 'openai/gpt-4o-mini'];
const ANTHROPIC_MODELS = ['anthropic/claude-3-5-sonnet', 'anthropic/claude-3-haiku'];

describe('ai-models-toggle-logic', () => {

    // ── resolveEffectiveEnabled ────────────────────────────────────────────

    describe('resolveEffectiveEnabled', () => {
        it('empty array means all models are enabled', () => {
            const result = resolveEffectiveEnabled([], ALL_MODELS);
            expect(result).to.deep.equal(new Set(ALL_MODELS));
        });

        it('non-empty array returns only the listed models', () => {
            const result = resolveEffectiveEnabled(OPENAI_MODELS, ALL_MODELS);
            expect(result).to.deep.equal(new Set(OPENAI_MODELS));
            expect(result.has('anthropic/claude-3-5-sonnet')).to.be.false;
        });

        it('single model in list returns set with just that model', () => {
            const result = resolveEffectiveEnabled(['openai/gpt-4o'], ALL_MODELS);
            expect(result.size).to.equal(1);
            expect(result.has('openai/gpt-4o')).to.be.true;
        });
    });

    // ── canonicalize ──────────────────────────────────────────────────────

    describe('canonicalize', () => {
        it('returns [] when all models are in the list', () => {
            expect(canonicalize(ALL_MODELS, ALL_MODELS)).to.deep.equal([]);
        });

        it('returns the list unchanged when not all models are present', () => {
            expect(canonicalize(OPENAI_MODELS, ALL_MODELS)).to.deep.equal(OPENAI_MODELS);
        });

        it('returns [] for an already-empty list', () => {
            expect(canonicalize([], ALL_MODELS)).to.deep.equal([]);
        });
    });

    // ── toggleModel ───────────────────────────────────────────────────────

    describe('toggleModel', () => {
        it('disabling a model from "all enabled" (empty) produces all-minus-one', () => {
            const result = toggleModel('openai/gpt-4o', [], ALL_MODELS);
            expect(result).to.not.include('openai/gpt-4o');
            expect(result).to.include('openai/gpt-4o-mini');
            expect(result.length).to.equal(3);
        });

        it('enabling a previously-disabled model adds it back', () => {
            const result = toggleModel('openai/gpt-4o', ANTHROPIC_MODELS, ALL_MODELS);
            expect(result).to.include('openai/gpt-4o');
        });

        it('enabling the last disabled model canonicalizes back to empty', () => {
            // All minus one openai model
            const withOneDisabled = ['openai/gpt-4o-mini', 'anthropic/claude-3-5-sonnet', 'anthropic/claude-3-haiku'];
            const result = toggleModel('openai/gpt-4o', withOneDisabled, ALL_MODELS);
            expect(result).to.deep.equal([]);
        });

        it('disabling a model from a partial list removes it', () => {
            const result = toggleModel('openai/gpt-4o', ALL_MODELS, ALL_MODELS);
            // ALL_MODELS.length === ALL_MODELS.length so result should be canonical: []
            // Actually toggleModel with full list: current = ALL_MODELS (not empty so stays as is),
            // next = ALL_MODELS minus gpt-4o = 3 items, which is not all => returned as-is
            expect(result).to.include('openai/gpt-4o-mini');
            expect(result).to.not.include('openai/gpt-4o');
        });
    });

    // ── toggleAll ─────────────────────────────────────────────────────────

    describe('toggleAll', () => {
        it('enable all returns [] (canonical all-enabled)', () => {
            expect(toggleAll(true)).to.deep.equal([]);
        });

        it('disable all returns [] (stored as empty, UI treats as none when explicitly chosen)', () => {
            // The component calls save([]) for "none" too — storage is identical;
            // the distinction is handled at the display layer.
            expect(toggleAll(false)).to.deep.equal([]);
        });
    });

    // ── toggleProvider ────────────────────────────────────────────────────

    describe('toggleProvider', () => {
        it('enabling a provider from all-enabled keeps all enabled (canonical [])', () => {
            const result = toggleProvider('openai', true, [], ALL_MODELS, OPENAI_MODELS);
            expect(result).to.deep.equal([]);
        });

        it('disabling a provider from all-enabled (empty) removes that provider', () => {
            const result = toggleProvider('openai', false, [], ALL_MODELS, OPENAI_MODELS);
            expect(result).to.deep.equal(ANTHROPIC_MODELS);
        });

        it('enabling a provider when it was fully disabled adds it back', () => {
            const result = toggleProvider('openai', true, ANTHROPIC_MODELS, ALL_MODELS, OPENAI_MODELS);
            // All 4 models enabled → canonical []
            expect(result).to.deep.equal([]);
        });

        it('disabling an already-disabled provider is a no-op', () => {
            const result = toggleProvider('openai', false, ANTHROPIC_MODELS, ALL_MODELS, OPENAI_MODELS);
            expect(result).to.deep.equal(ANTHROPIC_MODELS);
        });

        it('disabling one provider from partial list removes only that provider', () => {
            const partial = ['openai/gpt-4o', 'anthropic/claude-3-5-sonnet'];
            const result = toggleProvider('openai', false, partial, ALL_MODELS, OPENAI_MODELS);
            expect(result).to.deep.equal(['anthropic/claude-3-5-sonnet']);
        });
    });
});
