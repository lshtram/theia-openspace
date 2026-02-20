/* eslint-disable @typescript-eslint/no-explicit-any */
// *****************************************************************************
// Copyright (C) 2024 OpenSpace contributors.
//
// This program and the accompanying materials are made available under the
// terms of the Eclipse Public License v. 2.0 which is available at
// http://www.eclipse.org/legal/epl-2.0.
//
// This Source Code may also be made available under the following Secondary
// Licenses when the conditions for such availability set forth in the Eclipse
// Public License v. 2.0 are satisfied: GNU General Public License, version 2
// with the GNU Classpath Exception which is available at
// https://www.gnu.org/software/classpath/license.html.
//
// SPDX-License-Identifier: EPL-2.0 OR GPL-2.0-only WITH Classpath-exception-2.0
// *****************************************************************************

import { expect } from 'chai';
import * as monaco from '@theia/monaco-editor-core';
import { LanguageGrammarContribution } from '../language-grammar-contribution';

// ── Mock TextmateRegistry ────────────────────────────────────────────────────

interface LangEntry {
    languageId: string;
    scopeName: string;
}

interface ScopeEntry {
    scopeName: string;
}

function makeMockRegistry() {
    const langs: LangEntry[] = [];
    const scopes: ScopeEntry[] = [];

    return {
        langs,
        scopes,
        registerTextmateGrammarScope(scopeName: string, _provider: unknown): void {
            scopes.push({ scopeName });
        },
        mapLanguageIdToTextmateGrammar(languageId: string, scopeName: string): void {
            langs.push({ languageId, scopeName });
        }
    };
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe('LanguageGrammarContribution', () => {
    let contribution: LanguageGrammarContribution;
    let registry: ReturnType<typeof makeMockRegistry>;
    let originalSetLanguageConfiguration: typeof monaco.languages.setLanguageConfiguration;

    beforeEach(() => {
        // monaco.languages.setLanguageConfiguration requires DOM APIs (CSS global,
        // matchMedia) that are not fully available in jsdom. Stub it to a no-op so
        // tests focus on grammar registration behaviour only.
        originalSetLanguageConfiguration = monaco.languages.setLanguageConfiguration;
        (monaco.languages as unknown as Record<string, unknown>).setLanguageConfiguration = () => { /* no-op */ };

        contribution = new LanguageGrammarContribution();
        registry = makeMockRegistry();
        contribution.registerTextmateLanguage(registry as any);
    });

    afterEach(() => {
        // Restore the original implementation after each test.
        (monaco.languages as unknown as Record<string, unknown>).setLanguageConfiguration = originalSetLanguageConfiguration;
    });

    // ── Individual language registrations ────────────────────────────────────

    it('registers TypeScript with scope source.ts', () => {
        const entry = registry.langs.find(e => e.languageId === 'typescript');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.ts');
    });

    it('registers TSX with scope source.tsx', () => {
        const entry = registry.langs.find(e => e.languageId === 'typescriptreact');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.tsx');
    });

    it('registers JavaScript with scope source.js', () => {
        const entry = registry.langs.find(e => e.languageId === 'javascript');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.js');
    });

    it('registers JSX with scope source.js.jsx', () => {
        const entry = registry.langs.find(e => e.languageId === 'javascriptreact');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.js.jsx');
    });

    it('registers HTML with scope text.html.basic', () => {
        const entry = registry.langs.find(e => e.languageId === 'html');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('text.html.basic');
    });

    it('registers CSS with scope source.css', () => {
        const entry = registry.langs.find(e => e.languageId === 'css');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.css');
    });

    it('registers SCSS with scope source.css.scss', () => {
        const entry = registry.langs.find(e => e.languageId === 'scss');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.css.scss');
    });

    it('registers JSON with scope source.json', () => {
        const entry = registry.langs.find(e => e.languageId === 'json');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.json');
    });

    it('registers Markdown with scope text.html.markdown', () => {
        const entry = registry.langs.find(e => e.languageId === 'markdown');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('text.html.markdown');
    });

    it('registers Python with scope source.python', () => {
        const entry = registry.langs.find(e => e.languageId === 'python');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.python');
    });

    it('registers C with scope source.c', () => {
        const entry = registry.langs.find(e => e.languageId === 'c');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.c');
    });

    it('registers C++ with scope source.cpp', () => {
        const entry = registry.langs.find(e => e.languageId === 'cpp');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.cpp');
    });

    it('registers Rust with scope source.rust', () => {
        const entry = registry.langs.find(e => e.languageId === 'rust');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.rust');
    });

    it('registers Shell script with scope source.shell', () => {
        const entry = registry.langs.find(e => e.languageId === 'shellscript');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.shell');
    });

    it('registers YAML with scope source.yaml', () => {
        const entry = registry.langs.find(e => e.languageId === 'yaml');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.yaml');
    });

    it('registers Go with scope source.go', () => {
        const entry = registry.langs.find(e => e.languageId === 'go');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.go');
    });

    it('registers Java with scope source.java', () => {
        const entry = registry.langs.find(e => e.languageId === 'java');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.java');
    });

    it('registers Ruby with scope source.ruby', () => {
        const entry = registry.langs.find(e => e.languageId === 'ruby');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.ruby');
    });

    it('registers PHP with scope source.php', () => {
        const entry = registry.langs.find(e => e.languageId === 'php');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.php');
    });

    it('registers C# with scope source.cs', () => {
        const entry = registry.langs.find(e => e.languageId === 'csharp');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.cs');
    });

    it('registers Swift with scope source.swift', () => {
        const entry = registry.langs.find(e => e.languageId === 'swift');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.swift');
    });

    it('registers Kotlin with scope source.kotlin', () => {
        const entry = registry.langs.find(e => e.languageId === 'kotlin');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.kotlin');
    });

    it('registers SQL with scope source.sql', () => {
        const entry = registry.langs.find(e => e.languageId === 'sql');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.sql');
    });

    it('registers Lua with scope source.lua', () => {
        const entry = registry.langs.find(e => e.languageId === 'lua');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.lua');
    });

    it('registers Dart with scope source.dart', () => {
        const entry = registry.langs.find(e => e.languageId === 'dart');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.dart');
    });

    it('registers TOML with scope source.toml', () => {
        const entry = registry.langs.find(e => e.languageId === 'toml');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.toml');
    });

    it('registers Dockerfile with language id dockerfile and scope source.dockerfile', () => {
        const entry = registry.langs.find(e => e.languageId === 'dockerfile');
        expect(entry).to.exist;
        expect(entry!.scopeName).to.equal('source.dockerfile');
    });

    // ── Aggregate checks ─────────────────────────────────────────────────────

    it('registers at least 21 language IDs in total', () => {
        expect(registry.langs.length).to.be.at.least(21);
    });

    it('registers exactly 27 language IDs in total', () => {
        // 9 web + 6 systems/scripting + 12 additional = 27
        expect(registry.langs.length).to.equal(27);
    });

    it('has no duplicate language IDs', () => {
        const ids = registry.langs.map(e => e.languageId);
        const unique = new Set(ids);
        expect(unique.size).to.equal(ids.length,
            `Duplicate language IDs found: ${ids.filter((id, i) => ids.indexOf(id) !== i).join(', ')}`
        );
    });

    it('has no duplicate scope names', () => {
        const scopes = registry.langs.map(e => e.scopeName);
        const unique = new Set(scopes);
        expect(unique.size).to.equal(scopes.length,
            `Duplicate scope names found: ${scopes.filter((s, i) => scopes.indexOf(s) !== i).join(', ')}`
        );
    });

    it('registers a textmate grammar scope for every mapped language', () => {
        // Every languageId that gets mapLanguageIdToTextmateGrammar called
        // should have had registerTextmateGrammarScope called for its scope
        const registeredScopes = new Set(registry.scopes.map(s => s.scopeName));
        for (const lang of registry.langs) {
            expect(registeredScopes.has(lang.scopeName),
                `scope "${lang.scopeName}" for language "${lang.languageId}" was never registered`
            ).to.be.true;
        }
    });
});
