// extensions/openspace-core/src/browser/__tests__/filter-contribution.spec.ts
//
// Tests for OpenSpaceFilterContribution — verifies that Debug, SCM, and Git
// contributions are correctly identified and filtered.

import { expect } from 'chai';
import { OpenSpaceFilterContribution } from '../filter-contribution';

// Access private methods via cast for unit testing
type FilterContributionTestable = {
    isDebugContribution(contrib: unknown): boolean;
    isScmContribution(contrib: unknown): boolean;
};

function makeFc(): FilterContributionTestable {
    const fc = new OpenSpaceFilterContribution() as unknown as FilterContributionTestable;
    return fc;
}

function namedClass(name: string): unknown {
    const obj = {};
    Object.defineProperty(obj, 'constructor', { value: { name }, writable: false });
    return obj;
}

describe('OpenSpaceFilterContribution', () => {

    // ── isDebugContribution ───────────────────────────────────────────────

    describe('isDebugContribution', () => {
        it('returns true for a class with "Debug" in its name', () => {
            const fc = makeFc();
            expect(fc.isDebugContribution(namedClass('DebugFrontendApplicationContribution'))).to.be.true;
            expect(fc.isDebugContribution(namedClass('DebugCommandContribution'))).to.be.true;
            expect(fc.isDebugContribution(namedClass('SomeDebugWidget'))).to.be.true;
        });

        it('returns false for classes without "Debug" in their name', () => {
            const fc = makeFc();
            expect(fc.isDebugContribution(namedClass('ChatCommandContribution'))).to.be.false;
            expect(fc.isDebugContribution(namedClass('PaneService'))).to.be.false;
        });

        it('returns false for objects without a constructor name', () => {
            const fc = makeFc();
            expect(fc.isDebugContribution({})).to.be.false;
            expect(fc.isDebugContribution(null)).to.be.false;
        });
    });

    // ── isScmContribution ─────────────────────────────────────────────────

    describe('isScmContribution', () => {
        it('returns true for classes with "Scm" in their name', () => {
            const fc = makeFc();
            expect(fc.isScmContribution(namedClass('ScmCommandContribution'))).to.be.true;
            expect(fc.isScmContribution(namedClass('DefaultScmContribution'))).to.be.true;
        });

        it('returns true for classes with "Git" in their name', () => {
            const fc = makeFc();
            expect(fc.isScmContribution(namedClass('GitCommandContribution'))).to.be.true;
            expect(fc.isScmContribution(namedClass('GitHistoryContribution'))).to.be.true;
        });

        it('returns true for lowercase "git" in class name', () => {
            const fc = makeFc();
            expect(fc.isScmContribution(namedClass('gitContribution'))).to.be.true;
        });

        it('returns false for unrelated classes', () => {
            const fc = makeFc();
            expect(fc.isScmContribution(namedClass('BridgeContribution'))).to.be.false;
            expect(fc.isScmContribution(namedClass('MarkdownViewerWidget'))).to.be.false;
        });
    });

    // ── registerContributionFilters wiring ────────────────────────────────

    describe('registerContributionFilters', () => {
        it('registers filters without throwing', () => {
            const fc = new OpenSpaceFilterContribution();
            const added: Array<[unknown[], ((c: unknown) => boolean)[]]> = [];
            const registry = {
                addFilters: (
                    contributions: unknown[] | string,
                    filters: ((c: unknown) => boolean)[]
                ) => { added.push([contributions as unknown[], filters]); }
            };
            expect(() => fc.registerContributionFilters(registry as never)).to.not.throw();
            expect(added.length).to.be.greaterThan(0);
        });

        it('debug contributions are rejected by all registered filters', () => {
            const fc = new OpenSpaceFilterContribution();
            const filters: ((c: unknown) => boolean)[] = [];
            const registry = {
                addFilters: (_: unknown, fns: ((c: unknown) => boolean)[]) => {
                    filters.push(...fns);
                }
            };
            fc.registerContributionFilters(registry as never);

            const debugContrib = namedClass('DebugCommandContribution');
            // At least one filter should reject the debug contribution
            const allPass = filters.every(f => f(debugContrib));
            expect(allPass).to.be.false;
        });

        it('normal contributions pass all filters', () => {
            const fc = new OpenSpaceFilterContribution();
            const filters: ((c: unknown) => boolean)[] = [];
            const registry = {
                addFilters: (_: unknown, fns: ((c: unknown) => boolean)[]) => {
                    filters.push(...fns);
                }
            };
            fc.registerContributionFilters(registry as never);

            const normalContrib = namedClass('ChatCommandContribution');
            const allPass = filters.every(f => f(normalContrib));
            expect(allPass).to.be.true;
        });
    });
});
